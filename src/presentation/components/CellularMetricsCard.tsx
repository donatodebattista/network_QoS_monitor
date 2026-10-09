import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  CellularQoSData,
  getCellularQoSInfo,
  requestCellularPermissions,
} from '../../native-bridge';

export const CellularMetricsCard: React.FC = () => {
  const [data, setData] = useState<CellularQoSData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const qos = await getCellularQoSInfo();
      setData(qos);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Error desconocido al obtener telemetría celular.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRequestPermissions = async () => {
    try {
      setLoading(true);
      await requestCellularPermissions();
      await fetchMetrics();
    } catch (err) {
      console.warn('Error solicitando permisos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const getSignalQualityColor = (dbm: number) => {
    if (dbm === -999) return '#9CA3AF'; // Desconocido / Gris
    if (dbm >= -80) return '#10B981'; // Excelente / Verde
    if (dbm >= -95) return '#3B82F6'; // Buena / Azul
    if (dbm >= -105) return '#F59E0B'; // Moderada / Ámbar
    return '#EF4444'; // Pobre / Rojo
  };

  const getSignalQualityLabel = (dbm: number, level: number) => {
    if (dbm === -999 && level === -1) return 'No disponible';
    if (level === 4 || dbm >= -80) return 'Excelente';
    if (level === 3 || dbm >= -95) return 'Buena';
    if (level === 2 || dbm >= -105) return 'Aceptable';
    if (level === 1 || dbm >= -115) return 'Pobre';
    return 'Muy débil';
  };

  const needsPermissions =
    data && (!data.hasLocationPermission || !data.hasPhoneStatePermission);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.badge}>NATIVO</Text>
          <Text style={styles.headerTitle}>Telemetría Celular</Text>
        </View>

        <TouchableOpacity
          onPress={fetchMetrics}
          disabled={loading}
          style={styles.refreshButton}>
          {loading ? (
            <ActivityIndicator size="small" color="#4F46E5" />
          ) : (
            <Text style={styles.refreshButtonText}>Actualizar</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHint}>
            Para acceder a las métricas de celdas y tipo de red celular se requieren permisos de Android.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={handleRequestPermissions}>
            <Text style={styles.permissionButtonText}>Solicitar Permisos Ahora</Text>
          </TouchableOpacity>
        </View>
      ) : !data ? (
        <ActivityIndicator size="small" color="#4F46E5" />
      ) : (
        <View style={styles.content}>
          {/* Fila principal de intensidad de señal */}
          <View style={styles.signalSummaryBox}>
            <View>
              <Text style={styles.signalLabel}>Intensidad de Señal</Text>
              <Text
                style={[
                  styles.signalQuality,
                  { color: getSignalQualityColor(data.signalDbm) },
                ]}>
                {getSignalQualityLabel(data.signalDbm, data.signalLevel)}
              </Text>
            </View>

            <View style={styles.signalValues}>
              <Text style={styles.dbmText}>
                {data.signalDbm !== -999 ? `${data.signalDbm} dBm` : 'N/D'}
              </Text>
              {data.asuLevel !== -1 && (
                <Text style={styles.asuText}>{data.asuLevel} ASU</Text>
              )}
            </View>
          </View>

          {/* Barras de señal visuales */}
          <View style={styles.signalBarsContainer}>
            {[1, 2, 3, 4].map(barIndex => {
              const active = data.signalLevel >= barIndex;
              return (
                <View
                  key={barIndex}
                  style={[
                    styles.signalBar,
                    { height: 6 + barIndex * 4 },
                    active && {
                      backgroundColor: getSignalQualityColor(data.signalDbm),
                    },
                  ]}
                />
              );
            })}
            <Text style={styles.levelText}>
              {data.signalLevel >= 0 ? `Nivel: ${data.signalLevel}/4` : 'Nivel: N/D'}
            </Text>
          </View>

          {/* Métricas detalladas */}
          <View style={styles.detailsList}>
            <MetricRow label="Operador Red" value={data.operatorName} />
            <MetricRow label="Operador SIM" value={data.simOperatorName} />
            <MetricRow label="Tipo de Red Móvil" value={data.networkType} />
            <MetricRow
              label="Itinerancia (Roaming)"
              value={data.isRoaming ? 'Activa' : 'Inactiva'}
            />
            {data.cellId !== null && (
              <MetricRow label="Cell ID (CI/NCI)" value={String(data.cellId)} />
            )}
            {data.tac !== null && (
              <MetricRow label="TAC / LAC" value={String(data.tac)} />
            )}
          </View>

          {/* Banner de permisos si faltan */}
          {needsPermissions && (
            <View style={styles.permissionBanner}>
              <Text style={styles.permissionText}>
                Faltan permisos para obtener identificación de celdas o tipo de red exacto.
              </Text>
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={handleRequestPermissions}>
                <Text style={styles.permissionButtonText}>Otorgar Permisos</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const MetricRow: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}:</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

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
    backgroundColor: '#EEF2FF',
    color: '#4F46E5',
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
    color: '#4F46E5',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 14,
  },
  content: {
    gap: 14,
  },
  signalSummaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
  },
  signalLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  signalQuality: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  signalValues: {
    alignItems: 'flex-end',
  },
  dbmText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  asuText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  signalBarsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    paddingHorizontal: 4,
  },
  signalBar: {
    width: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  levelText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailsList: {
    gap: 8,
    paddingTop: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '600',
  },
  permissionBanner: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 8,
  },
  permissionText: {
    fontSize: 12,
    color: '#B45309',
    lineHeight: 16,
  },
  permissionButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#4F46E5',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginTop: 4,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  errorContainer: {
    padding: 14,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    gap: 8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
  errorHint: {
    color: '#7F1D1D',
    fontSize: 12,
  },
});
