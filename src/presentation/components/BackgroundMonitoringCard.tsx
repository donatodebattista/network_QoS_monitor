import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  startPeriodicSampling,
  stopPeriodicSampling,
  executeQoSSampleCycle,
  getSamplerStats,
  SamplerStats,
  DegradationThresholds,
} from '../../measurement-engine';
import {
  showQoSNotification,
  requestNotificationPermission,
} from '../../native-bridge';

export const BackgroundMonitoringCard: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [intervalMinutes, setIntervalMinutes] = useState<number>(15);
  const [criticalDbm, setCriticalDbm] = useState<number>(-115);
  const [maxLatency, setMaxLatency] = useState<number>(250);
  const [executing, setExecuting] = useState<boolean>(false);
  const [stats, setStats] = useState<SamplerStats>(getSamplerStats());

  const refreshStats = useCallback(() => {
    setStats(getSamplerStats());
  }, []);

  useEffect(() => {
    const timer = setInterval(refreshStats, 3000);
    return () => clearInterval(timer);
  }, [refreshStats]);

  const toggleMonitoring = async (val: boolean) => {
    if (val) {
      // Solicitar permiso de notificaciones en Android 13+
      const hasPerm = await requestNotificationPermission();
      if (!hasPerm) {
        Alert.alert(
          'Permiso de Notificaciones',
          'Para emitir alertas de degradación en tiempo real se requiere conceder el permiso de notificaciones.'
        );
      }

      const thresholds: DegradationThresholds = {
        criticalSignalDbm: criticalDbm,
        maxLatencyMs: maxLatency,
        notifyOnDisconnect: true,
      };

      startPeriodicSampling(intervalMinutes, thresholds, () => {
        refreshStats();
      });
      setEnabled(true);
      refreshStats();
    } else {
      stopPeriodicSampling();
      setEnabled(false);
      refreshStats();
    }
  };

  const handleManualCycle = async () => {
    try {
      setExecuting(true);
      const thresholds: DegradationThresholds = {
        criticalSignalDbm: criticalDbm,
        maxLatencyMs: maxLatency,
        notifyOnDisconnect: true,
      };

      const result = await executeQoSSampleCycle(thresholds);
      refreshStats();

      if (result.degraded) {
        Alert.alert(
          '⚠️ Degradación Detectada',
          `Se detectó y notificó la siguiente condición:\n${result.degradationReason}`
        );
      } else {
        Alert.alert(
          'Muestra Registrada',
          `Ciclo completado con éxito. Estado de red óptimo.\nRTT: ${
            result.record.rttAvgMs !== null ? `${result.record.rttAvgMs} ms` : 'N/A'
          } | Señal: ${
            result.record.signalDbm !== undefined ? `${result.record.signalDbm} dBm` : 'N/A'
          }`
        );
      }
    } catch {
      Alert.alert('Error', 'No se pudo completar el ciclo de muestreo');
    } finally {
      setExecuting(false);
    }
  };

  const handleTestNotification = async () => {
    const granted = await requestNotificationPermission();
    if (!granted) {
      Alert.alert('Permiso Requerido', 'No se otorgó permiso para notificaciones.');
      return;
    }

    const sent = await showQoSNotification({
      title: '🚨 Prueba de Alerta QoS (Etapa 6)',
      message: 'Notificación nativa verificada. El sistema alertará aquí ante caídas de cobertura o alta latencia.',
      isWarning: true,
    });

    if (sent) {
      Alert.alert('Alerta Emitida', 'Revisa la barra de notificaciones de tu teléfono.');
    }
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.badge}>MUESTREO & ALERTAS</Text>
          <Text style={styles.headerTitle}>Monitoreo en Segundo Plano (Etapa 6)</Text>
        </View>

        <Switch
          value={enabled}
          onValueChange={toggleMonitoring}
          trackColor={{ false: '#D1D5DB', true: '#C7D2FE' }}
          thumbColor={enabled ? '#4F46E5' : '#9CA3AF'}
        />
      </View>

      <Text style={styles.subtitle}>
        Muestreo periódico continuo de telemetría y alertas locales ante degradación de QoS.
      </Text>

      <View style={styles.divider} />

      {/* Intervalo de Muestreo */}
      <Text style={styles.sectionLabel}>Intervalo de Muestreo:</Text>
      <View style={styles.intervalRow}>
        {[5, 15, 30, 60].map(mins => {
          const isSelected = intervalMinutes === mins;
          return (
            <TouchableOpacity
              key={mins}
              disabled={enabled}
              onPress={() => setIntervalMinutes(mins)}
              style={[
                styles.intervalPill,
                isSelected && styles.intervalPillActive,
                enabled && styles.pillDisabled,
              ]}>
              <Text
                style={[
                  styles.intervalPillText,
                  isSelected && styles.intervalPillTextActive,
                ]}>
                {mins} min
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Umbrales de Alerta */}
      <View style={styles.thresholdsContainer}>
        <Text style={styles.sectionLabel}>Umbrales de Degradación Crítica:</Text>

        <View style={styles.thresholdRow}>
          <Text style={styles.thresholdLabel}>Señal RSRP Crítica:</Text>
          <View style={styles.thresholdOptions}>
            {[-110, -115, -120].map(dbm => (
              <TouchableOpacity
                key={dbm}
                disabled={enabled}
                onPress={() => setCriticalDbm(dbm)}
                style={[
                  styles.miniOption,
                  criticalDbm === dbm && styles.miniOptionActive,
                  enabled && styles.pillDisabled,
                ]}>
                <Text
                  style={[
                    styles.miniOptionText,
                    criticalDbm === dbm && styles.miniOptionTextActive,
                  ]}>
                  {dbm} dBm
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.thresholdRow}>
          <Text style={styles.thresholdLabel}>Latencia Máxima:</Text>
          <View style={styles.thresholdOptions}>
            {[180, 250, 350].map(ms => (
              <TouchableOpacity
                key={ms}
                disabled={enabled}
                onPress={() => setMaxLatency(ms)}
                style={[
                  styles.miniOption,
                  maxLatency === ms && styles.miniOptionActive,
                  enabled && styles.pillDisabled,
                ]}>
                <Text
                  style={[
                    styles.miniOptionText,
                    maxLatency === ms && styles.miniOptionTextActive,
                  ]}>
                  {ms} ms
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Estado del Servicio */}
      <View style={styles.statusBox}>
        <View style={styles.statusRow}>
          <View style={styles.statusIndicator}>
            <View
              style={[
                styles.statusDot,
                stats.running ? styles.dotGreen : styles.dotGray,
              ]}
            />
            <Text style={styles.statusText}>
              {stats.running ? 'Servicio Activo en Background' : 'Servicio en Pausa'}
            </Text>
          </View>
          <Text style={styles.sampleCountText}>
            {stats.totalSamples} muestras tomadas
          </Text>
        </View>

        <View style={styles.detailsRow}>
          <Text style={styles.detailLabel}>Última toma:</Text>
          <Text style={styles.detailValue}>{stats.lastSampleTime || 'Ninguna'}</Text>
        </View>
        <View style={styles.detailsRow}>
          <Text style={styles.detailLabel}>Última alerta:</Text>
          <Text style={styles.detailValue}>
            {stats.lastDegradation || 'Sin alertas registradas'}
          </Text>
        </View>
      </View>

      {/* Botones de Acción */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          onPress={handleManualCycle}
          disabled={executing}
          style={styles.actionButtonSecondary}>
          {executing ? (
            <ActivityIndicator size="small" color="#4F46E5" />
          ) : (
            <Text style={styles.actionButtonSecondaryText}>Ejecutar Ciclo Ahora</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleTestNotification}
          style={styles.actionButtonPrimary}>
          <Text style={styles.actionButtonPrimaryText}>Probar Notificación</Text>
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
    backgroundColor: '#F3E8FF',
    color: '#7E22CE',
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
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 14,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  intervalRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  intervalPill: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  intervalPillActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  intervalPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  intervalPillTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  pillDisabled: {
    opacity: 0.5,
  },
  thresholdsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  thresholdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  thresholdLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  thresholdOptions: {
    flexDirection: 'row',
    gap: 4,
  },
  miniOption: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  miniOptionActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  miniOptionText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  miniOptionTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  statusBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotGreen: {
    backgroundColor: '#10B981',
  },
  dotGray: {
    backgroundColor: '#94A3B8',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  sampleCountText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  detailLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  detailValue: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButtonSecondary: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  actionButtonPrimary: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
