import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { getMeasurements, QoSMeasurementRecord } from '../../persistence';
import { getCurrentCoordinates } from '../../geo';

type MapViewMode = 'markers' | 'heatmap';
type MapFilterType = 'all' | 'wifi' | 'cellular';

export const QoSMapView: React.FC = () => {
  const webViewRef = useRef<any>(null);
  const [records, setRecords] = useState<QoSMeasurementRecord[]>([]);
  const [viewMode, setViewMode] = useState<MapViewMode>('markers');
  const [filterType, setFilterType] = useState<MapFilterType>('all');
  const [currentCoords, setCurrentCoords] = useState<{
    latitude: number;
    longitude: number;
  }>({
    latitude: -32.4812, // Concepción del Uruguay por defecto
    longitude: -58.2341,
  });
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [list, gps] = await Promise.all([
        getMeasurements(),
        getCurrentCoordinates().catch(() => null),
      ]);

      setRecords(list);

      if (gps) {
        setCurrentCoords({
          latitude: gps.latitude,
          longitude: gps.longitude,
        });
      } else {
        const withCoords = list.filter(r => r.latitude !== null && r.longitude !== null);
        if (withCoords.length > 0) {
          setCurrentCoords({
            latitude: withCoords[0].latitude!,
            longitude: withCoords[0].longitude!,
          });
        }
      }
    } catch (err) {
      console.warn('Error al cargar datos del mapa:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtrar registros con coordenadas válidas
  const geoRecords = useMemo(() => {
    return records
      .filter(
        (r): r is QoSMeasurementRecord & { latitude: number; longitude: number } =>
          r.latitude !== null && r.longitude !== null
      )
      .filter(r => {
        if (filterType === 'all') return true;
        return r.connectionType === filterType;
      });
  }, [records, filterType]);

  const getMarkerColor = (item: QoSMeasurementRecord): string => {
    if (item.connectionType === 'cellular') {
      const dbm = item.signalDbm ?? -999;
      if (dbm === -999) return '#9CA3AF'; // Gris
      if (dbm >= -85) return '#10B981'; // Verde (Excelente)
      if (dbm >= -105) return '#F59E0B'; // Ámbar (Moderado)
      return '#EF4444'; // Rojo (Pobre)
    }

    // Wi-Fi
    if (item.rttAvgMs !== null && item.rttAvgMs !== undefined) {
      if (item.rttAvgMs < 50) return '#10B981';
      if (item.rttAvgMs < 100) return '#3B82F6';
      return '#F59E0B';
    }
    return '#3B82F6';
  };

  const centerOnUser = async () => {
    try {
      const gps = await getCurrentCoordinates();
      setCurrentCoords({
        latitude: gps.latitude,
        longitude: gps.longitude,
      });
      // Inyectar comando a Leaflet sin recargar la vista
      webViewRef.current?.injectJavaScript(
        `if (window.centerMap) { window.centerMap(${gps.latitude}, ${gps.longitude}, 16); } true;`
      );
    } catch (err) {
      console.warn('No se pudo centrar en la ubicación actual:', err);
    }
  };

  // Generar HTML autocontenido de Leaflet + OpenStreetMap
  const leafletHtml = useMemo(() => {
    const pointsData = geoRecords.map(item => {
      const color = getMarkerColor(item);
      let title = item.connectionType === 'cellular'
        ? item.carrierName || 'Red Móvil'
        : 'Red Wi-Fi';
      if (item.cellularGeneration) {
        title += ` (${item.cellularGeneration})`;
      }

      const rows: string[] = [];
      if (item.signalDbm !== undefined) {
        rows.push(`<b>Señal:</b> ${item.signalDbm} dBm`);
      }
      if (item.signalLevel !== undefined) {
        rows.push(`<b>Barras:</b> ${item.signalLevel}/4`);
      }
      if (item.rttAvgMs !== null && item.rttAvgMs !== undefined) {
        rows.push(`<b>Latencia:</b> ${item.rttAvgMs} ms`);
      }
      if (item.jitterMs !== null && item.jitterMs !== undefined) {
        rows.push(`<b>Jitter:</b> ${item.jitterMs} ms`);
      }
      if (item.downloadSpeedMbps !== null && item.downloadSpeedMbps !== undefined) {
        rows.push(`<b>Descarga:</b> ${item.downloadSpeedMbps} Mbps`);
      }
      if (item.uploadSpeedMbps !== null && item.uploadSpeedMbps !== undefined) {
        rows.push(`<b>Subida:</b> ${item.uploadSpeedMbps} Mbps`);
      }
      rows.push(`<span style="color:#64748B;font-size:10px;">${item.isoDate.replace('T', ' ').substring(0, 19)}</span>`);

      return {
        lat: item.latitude,
        lng: item.longitude,
        color,
        title,
        html: rows.join('<br/>'),
      };
    });

    const pointsJson = JSON.stringify(pointsData);
    const initialLat = currentCoords.latitude;
    const initialLng = currentCoords.longitude;
    const isHeatmap = viewMode === 'heatmap';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map {
      height: 100%;
      width: 100%;
      margin: 0;
      padding: 0;
      background-color: #F8FAFC;
    }
    .custom-popup .leaflet-popup-content-wrapper {
      background: #FFFFFF;
      color: #0F172A;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      padding: 4px 6px;
    }
    .custom-popup .leaflet-popup-tip {
      background: #FFFFFF;
    }
    .popup-title {
      font-weight: 700;
      font-size: 12px;
      color: #1E293B;
      margin-bottom: 4px;
      border-bottom: 1px solid #E2E8F0;
      padding-bottom: 2px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: true,
      attributionControl: false
    }).setView([${initialLat}, ${initialLng}], 14);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    var points = ${pointsJson};
    var isHeat = ${isHeatmap};

    points.forEach(function(p) {
      var popupContent = '<div class="custom-popup">' +
        '<div class="popup-title">' + p.title + '</div>' +
        p.html +
        '</div>';

      if (isHeat) {
        // Modo Heatmap: halo difuso grande y núcleo brillante
        L.circle([p.lat, p.lng], {
          radius: 70,
          color: p.color,
          fillColor: p.color,
          fillOpacity: 0.35,
          weight: 1,
          opacity: 0.3
        }).addTo(map);

        L.circleMarker([p.lat, p.lng], {
          radius: 6,
          fillColor: p.color,
          color: '#FFFFFF',
          weight: 1.5,
          opacity: 1,
          fillOpacity: 0.85
        }).bindPopup(popupContent).addTo(map);
      } else {
        // Modo Pines: marcador de círculo nítido
        L.circleMarker([p.lat, p.lng], {
          radius: 9,
          fillColor: p.color,
          color: '#FFFFFF',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.95
        }).bindPopup(popupContent).addTo(map);
      }
    });

    window.centerMap = function(lat, lng, zoom) {
      map.setView([lat, lng], zoom || 15);
      L.circleMarker([lat, lng], {
        radius: 6,
        fillColor: '#3B82F6',
        color: '#FFFFFF',
        weight: 2,
        fillOpacity: 1
      }).bindPopup('<b>Ubicación Actual</b>').addTo(map);
    };
  </script>
</body>
</html>
    `;
  }, [geoRecords, currentCoords, viewMode]);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.badge}>MAPA & HEATMAP</Text>
          <Text style={styles.headerTitle}>Cobertura y Calidad (Etapa 5)</Text>
        </View>

        <TouchableOpacity onPress={centerOnUser} style={styles.centerButton}>
          <Text style={styles.centerButtonText}>Mi Ubicación</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      {/* Selectores de Modo y Filtro */}
      <View style={styles.controlsRow}>
        <View style={styles.modePills}>
          <TouchableOpacity
            onPress={() => setViewMode('markers')}
            style={[styles.pill, viewMode === 'markers' && styles.pillActive]}>
            <Text style={[styles.pillText, viewMode === 'markers' && styles.pillTextActive]}>
              Pines
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode('heatmap')}
            style={[styles.pill, viewMode === 'heatmap' && styles.pillActive]}>
            <Text style={[styles.pillText, viewMode === 'heatmap' && styles.pillTextActive]}>
              Calor (Heatmap)
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterPills}>
          <TouchableOpacity
            onPress={() => setFilterType('all')}
            style={[styles.miniPill, filterType === 'all' && styles.miniPillActive]}>
            <Text style={[styles.miniPillText, filterType === 'all' && styles.miniPillTextActive]}>
              Todo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilterType('cellular')}
            style={[styles.miniPill, filterType === 'cellular' && styles.miniPillActive]}>
            <Text style={[styles.miniPillText, filterType === 'cellular' && styles.miniPillTextActive]}>
              Móvil
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilterType('wifi')}
            style={[styles.miniPill, filterType === 'wifi' && styles.miniPillActive]}>
            <Text style={[styles.miniPillText, filterType === 'wifi' && styles.miniPillTextActive]}>
              Wi-Fi
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Contenedor del Mapa con WebView (Leaflet + OpenStreetMap) */}
      <View style={styles.mapContainer}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#4F46E5" />
          </View>
        )}
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: leafletHtml }}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          nestedScrollEnabled={true}
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Leyenda Semafórica */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.dotGreen]} />
          <Text style={styles.legendText}>Fuerte (&gt;-85dBm)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.dotAmber]} />
          <Text style={styles.legendText}>Media (-85 a -105)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.dotRed]} />
          <Text style={styles.legendText}>Débil (&lt;-105dBm)</Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerNote}>
          {geoRecords.length} puntos geo-referenciados en OpenStreetMap
        </Text>
        <TouchableOpacity onPress={loadData} style={styles.refreshLink}>
          <Text style={styles.refreshLinkText}>Actualizar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: '#FEF3C7',
    color: '#B45309',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  centerButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  centerButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 14,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modePills: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 2,
  },
  pill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  pillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  pillTextActive: {
    color: '#4F46E5',
  },
  filterPills: {
    flexDirection: 'row',
    gap: 4,
  },
  miniPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  miniPillActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  miniPillText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
  },
  miniPillTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  mapContainer: {
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    backgroundColor: '#F1F5F9',
  },
  webView: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 12,
    padding: 4,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotGreen: {
    backgroundColor: '#10B981',
  },
  dotAmber: {
    backgroundColor: '#F59E0B',
  },
  dotRed: {
    backgroundColor: '#EF4444',
  },
  legendText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  footerNote: {
    fontSize: 11,
    color: '#94A3B8',
  },
  refreshLink: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  refreshLinkText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4F46E5',
  },
});
