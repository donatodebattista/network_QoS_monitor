import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { getCellularQoSInfo } from '../../native-bridge';
import { getCurrentCoordinates } from '../../geo';
import { executeSingleProbe, DEFAULT_PING_TARGETS } from '../../measurement-engine';
import {
  QoSMeasurementRecord,
  HistorySummary,
  saveMeasurement,
  getMeasurements,
  deleteMeasurement,
  clearAllMeasurements,
  getHistorySummary,
  exportToJSON,
  exportToCSV,
} from '../../persistence';

export const MeasurementHistoryCard: React.FC = () => {
  const [records, setRecords] = useState<QoSMeasurementRecord[]>([]);
  const [summary, setSummary] = useState<HistorySummary | null>(null);
  const [filter, setFilter] = useState<'all' | 'wifi' | 'cellular'>('all');
  const [saving, setSaving] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const reloadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const [list, sum] = await Promise.all([
        getMeasurements(filter === 'all' ? undefined : { connectionType: filter }),
        getHistorySummary(),
      ]);
      setRecords(list);
      setSummary(sum);
    } catch (err) {
      console.warn('Error al cargar historial:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    reloadHistory();
  }, [reloadHistory]);

  const handleCaptureSnapshot = async () => {
    try {
      setSaving(true);

      // 1. Obtener estado de red, telefonía, GPS y sonda rápida de latencia
      const [netState, cellularInfo, coords, probeResult] = await Promise.all([
        NetInfo.fetch(),
        getCellularQoSInfo().catch(() => null),
        getCurrentCoordinates().catch(() => null),
        executeSingleProbe(
          DEFAULT_PING_TARGETS[0].host,
          DEFAULT_PING_TARGETS[0].port,
          1,
          1500
        ).catch(() => null),
      ]);

      const now = new Date();
      const record: QoSMeasurementRecord = {
        id: `qos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
        isoDate: now.toLocaleString(),
        connectionType: netState.type || 'unknown',
        isInternetReachable: Boolean(netState.isInternetReachable),

        // Celular
        carrierName: cellularInfo?.operatorName || (netState.type === 'cellular' ? 'Celular' : undefined),
        cellularGeneration: cellularInfo?.networkType || undefined,
        signalDbm: cellularInfo && cellularInfo.signalDbm !== -999 ? cellularInfo.signalDbm : undefined,
        signalLevel: cellularInfo && cellularInfo.signalLevel !== -1 ? cellularInfo.signalLevel : undefined,
        cellId: cellularInfo?.cellId ?? null,
        tac: cellularInfo?.tac ?? null,

        // Sonda de Latencia instantánea
        pingTargetHost: probeResult?.success ? DEFAULT_PING_TARGETS[0].host : undefined,
        rttAvgMs: probeResult?.success ? probeResult.rttMs : null,

        // GPS
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        accuracy: coords?.accuracy ?? null,
        altitude: coords?.altitude ?? null,
      };

      await saveMeasurement(record);
      await reloadHistory();

      Alert.alert(
        'Medición Registrada',
        `Se guardó la sesión georreferenciada con éxito.\nCoordenadas: ${
          coords ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}` : 'Sin GPS'
        }`
      );
    } catch {
      Alert.alert('Error', 'No se pudo guardar la medición');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteMeasurement(id);
    await reloadHistory();
  };

  const handleClearAll = () => {
    Alert.alert(
      'Vaciar Historial',
      '¿Estás seguro de que deseas eliminar todas las mediciones guardadas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await clearAllMeasurements();
            await reloadHistory();
          },
        },
      ]
    );
  };

  const handleExportCSV = async () => {
    const csv = await exportToCSV();
    Alert.alert(
      'Exportación CSV Generada',
      `Se generó el reporte CSV (${records.length} registros).\n\nPrimeras líneas:\n${csv
        .split('\n')
        .slice(0, 3)
        .join('\n')}...`
    );
  };

  const handleExportJSON = async () => {
    const json = await exportToJSON();
    Alert.alert(
      'Exportación JSON Generada',
      `Se generó el archivo JSON (${records.length} registros, ${json.length} bytes).\n\nEstructura exportable lista para backup o analítica.`
    );
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.badge}>PERSISTENCIA</Text>
          <Text style={styles.headerTitle}>Historial QoS & GPS</Text>
        </View>

        <TouchableOpacity
          onPress={handleCaptureSnapshot}
          disabled={saving}
          style={styles.captureButton}>
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.captureButtonText}>+ Guardar Sesión</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      {/* Resumen Estadístico (RF-05 / RF-09) */}
      {summary && summary.totalRecords > 0 && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.totalRecords}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.wifiCount}</Text>
            <Text style={styles.summaryLabel}>Wi-Fi</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.cellularCount}</Text>
            <Text style={styles.summaryLabel}>Celular</Text>
          </View>
        </View>
      )}

      {/* Filtros */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          onPress={() => setFilter('all')}
          style={[styles.filterPill, filter === 'all' && styles.filterPillActive]}>
          <Text
            style={[
              styles.filterPillText,
              filter === 'all' && styles.filterPillTextActive,
            ]}>
            Todas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFilter('wifi')}
          style={[styles.filterPill, filter === 'wifi' && styles.filterPillActive]}>
          <Text
            style={[
              styles.filterPillText,
              filter === 'wifi' && styles.filterPillTextActive,
            ]}>
            Wi-Fi
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFilter('cellular')}
          style={[
            styles.filterPill,
            filter === 'cellular' && styles.filterPillActive,
          ]}>
          <Text
            style={[
              styles.filterPillText,
              filter === 'cellular' && styles.filterPillTextActive,
            ]}>
            Celular
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lista de Registros */}
      {loading ? (
        <ActivityIndicator size="small" color="#4F46E5" />
      ) : records.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay mediciones guardadas aún.</Text>
          <Text style={styles.emptySubtext}>
            Presiona "+ Guardar Sesión" para correlacionar y almacenar los datos de red con tu ubicación GPS actual.
          </Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {records.slice(0, 10).map(item => (
            <View key={item.id} style={styles.recordItem}>
              <View style={styles.recordHeader}>
                <View style={styles.recordBadgeContainer}>
                  <Text style={styles.recordTypeBadge}>
                    {item.connectionType.toUpperCase()}
                  </Text>
                  {item.cellularGeneration && (
                    <Text style={styles.recordGenerationBadge}>
                      {item.cellularGeneration}
                    </Text>
                  )}
                </View>
                <Text style={styles.recordDate}>{item.isoDate}</Text>
              </View>

              <View style={styles.recordDetails}>
                {item.carrierName && (
                  <Text style={styles.recordCarrier}>
                    Operador: {item.carrierName}
                    {item.signalDbm ? ` (${item.signalDbm} dBm)` : ''}
                  </Text>
                )}

                <View style={styles.geoRow}>
                  <Text style={styles.geoIcon}>📍</Text>
                  <Text style={styles.geoText}>
                    {item.latitude !== null && item.longitude !== null
                      ? `${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)} (±${item.accuracy}m)`
                      : 'Sin coordenadas GPS'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => handleDelete(item.id)}
                style={styles.deleteButton}>
                <Text style={styles.deleteButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Acciones de Exportación (RF-08) */}
      {records.length > 0 && (
        <View style={styles.exportActionsContainer}>
          <View style={styles.exportButtonsRow}>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={handleExportCSV}>
              <Text style={styles.exportButtonText}>Exportar CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={handleExportJSON}>
              <Text style={styles.exportButtonText}>Exportar JSON</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.clearAllButton}
            onPress={handleClearAll}>
            <Text style={styles.clearAllButtonText}>Vaciar Historial</Text>
          </TouchableOpacity>
        </View>
      )}
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
    flex: 1,
    marginRight: 12,
  },
  badge: {
    backgroundColor: '#F3E8FF',
    color: '#7E22CE',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  captureButton: {
    flexShrink: 0,
    backgroundColor: '#7E22CE',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  captureButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 14,
  },
  summaryContainer: {
    flexDirection: 'row',
    backgroundColor: '#FAF5FF',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#6B21A8',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#9333EA',
    fontWeight: '500',
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  filterPillActive: {
    backgroundColor: '#7E22CE',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  emptyContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 6,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  listContainer: {
    gap: 10,
  },
  recordItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingRight: 20,
  },
  recordBadgeContainer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  recordTypeBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F46E5',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recordGenerationBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recordDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  recordDetails: {
    gap: 4,
  },
  recordCarrier: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  geoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  geoIcon: {
    fontSize: 11,
  },
  geoText: {
    fontSize: 11,
    color: '#6B7280',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 6,
  },
  deleteButtonText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '700',
  },
  exportActionsContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 10,
  },
  exportButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  exportButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  exportButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  clearAllButton: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  clearAllButtonText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },
});
