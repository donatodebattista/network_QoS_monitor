import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  GeoLocationData,
  getCurrentCoordinates,
  hasLocationPermission,
  requestLocationPermission,
} from '../../geo';

export const LocationCard: React.FC = () => {
  const [location, setLocation] = useState<GeoLocationData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocation = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const coords = await getCurrentCoordinates();
      setLocation(coords);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Error al obtener la posición geográfica.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleGrantPermission = async () => {
    const granted = await requestLocationPermission();
    if (granted) {
      fetchLocation();
    }
  };

  useEffect(() => {
    hasLocationPermission().then(permitted => {
      if (permitted) {
        fetchLocation();
      } else {
        setLoading(false);
        setError('Permiso de ubicación GPS requerido');
      }
    });
  }, [fetchLocation]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.badge}>GPS / GEO</Text>
          <Text style={styles.headerTitle}>Geolocalización</Text>
        </View>

        <TouchableOpacity
          onPress={fetchLocation}
          disabled={loading}
          style={styles.refreshButton}>
          {loading ? (
            <ActivityIndicator size="small" color="#0284C7" />
          ) : (
            <Text style={styles.refreshButtonText}>Actualizar GPS</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={handleGrantPermission}>
            <Text style={styles.permissionButtonText}>Habilitar GPS</Text>
          </TouchableOpacity>
        </View>
      ) : !location ? (
        <ActivityIndicator size="small" color="#0284C7" />
      ) : (
        <View style={styles.content}>
          {/* Fila de Coordenadas principales */}
          <View style={styles.coordsBox}>
            <View style={styles.coordCol}>
              <Text style={styles.coordLabel}>Latitud</Text>
              <Text style={styles.coordValue}>
                {location.latitude.toFixed(6)}°
              </Text>
            </View>
            <View style={styles.coordDivider} />
            <View style={styles.coordCol}>
              <Text style={styles.coordLabel}>Longitud</Text>
              <Text style={styles.coordValue}>
                {location.longitude.toFixed(6)}°
              </Text>
            </View>
          </View>

          {/* Detalles de sensor */}
          <View style={styles.detailsList}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Precisión GPS:</Text>
              <Text style={styles.detailValue}>± {location.accuracy} m</Text>
            </View>
            {location.altitude !== null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Altitud:</Text>
                <Text style={styles.detailValue}>{location.altitude} m snm</Text>
              </View>
            )}
            {location.speed !== null && location.speed > 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Velocidad:</Text>
                <Text style={styles.detailValue}>
                  {(location.speed * 3.6).toFixed(1)} km/h
                </Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Proveedor:</Text>
              <Text style={styles.detailValue}>
                {location.provider ? location.provider.toUpperCase() : 'GPS'}
              </Text>
            </View>
          </View>
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
    backgroundColor: '#E0F2FE',
    color: '#0369A1',
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
  refreshButton: {
    flexShrink: 0,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  refreshButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284C7',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 14,
  },
  content: {
    gap: 12,
  },
  coordsBox: {
    flexDirection: 'row',
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  coordCol: {
    flex: 1,
    alignItems: 'center',
  },
  coordDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#BAE6FD',
  },
  coordLabel: {
    fontSize: 11,
    color: '#0369A1',
    fontWeight: '600',
    marginBottom: 2,
  },
  coordValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0C4A6E',
  },
  detailsList: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '600',
  },
  errorContainer: {
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    gap: 8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
  permissionButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#0284C7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
