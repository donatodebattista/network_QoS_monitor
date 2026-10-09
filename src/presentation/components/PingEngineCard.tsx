import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {
  DEFAULT_PING_TARGETS,
  PingTarget,
  PingSessionResult,
  PingSessionStats,
  SingleProbeResult,
  executePingSession,
} from '../../measurement-engine';
import NetInfo from '@react-native-community/netinfo';
import { getCellularQoSInfo } from '../../native-bridge';
import { getCurrentCoordinates } from '../../geo';
import { saveMeasurement, QoSMeasurementRecord } from '../../persistence';

export const PingEngineCard: React.FC = () => {
  const [selectedTarget, setSelectedTarget] = useState<PingTarget>(
    DEFAULT_PING_TARGETS[0]
  );
  const [probeCount, setProbeCount] = useState<number>(10);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [partialStats, setPartialStats] = useState<PingSessionStats | null>(null);
  const [probesList, setProbesList] = useState<SingleProbeResult[]>([]);
  const [finalResult, setFinalResult] = useState<PingSessionResult | null>(null);

  const abortControllerRef = useRef<{ isAborted: boolean }>({ isAborted: false });

  const startTest = async () => {
    setIsRunning(true);
    abortControllerRef.current = { isAborted: false };
    setProgress({ current: 0, total: probeCount });
    setPartialStats(null);
    setProbesList([]);
    setFinalResult(null);

    try {
      const result = await executePingSession(
        selectedTarget,
        probeCount,
        200,
        (currentProbe, progressIndex, total, currentStats) => {
          setProgress({ current: progressIndex, total });
          setPartialStats(currentStats);
          setProbesList(prev => [...prev, currentProbe]);
        },
        abortControllerRef.current
      );
      setFinalResult(result);

      // Auto-guardar en persistencia para series temporales e historial
      try {
        const [netState, cellularInfo, coords] = await Promise.all([
          NetInfo.fetch(),
          getCellularQoSInfo().catch(() => null),
          getCurrentCoordinates().catch(() => null),
        ]);

        const record: QoSMeasurementRecord = {
          id: `ping_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          timestamp: Date.now(),
          isoDate: new Date().toLocaleString(),
          connectionType: netState.type || 'unknown',
          isInternetReachable: Boolean(netState.isInternetReachable),
          carrierName: cellularInfo?.operatorName || (netState.type === 'cellular' ? 'Celular' : undefined),
          cellularGeneration: cellularInfo?.networkType || undefined,
          signalDbm: cellularInfo && cellularInfo.signalDbm !== -999 ? cellularInfo.signalDbm : undefined,
          signalLevel: cellularInfo && cellularInfo.signalLevel !== -1 ? cellularInfo.signalLevel : undefined,
          cellId: cellularInfo?.cellId ?? null,
          tac: cellularInfo?.tac ?? null,
          pingTargetHost: selectedTarget.host,
          rttAvgMs: result.avgRttMs,
          rttMinMs: result.minRttMs,
          rttMaxMs: result.maxRttMs,
          jitterMs: result.jitterMs,
          packetLossPercent: result.packetLossPercent,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          accuracy: coords?.accuracy ?? null,
        };

        await saveMeasurement(record);
      } catch (saveErr) {
        console.warn('Error al auto-guardar medición de ping:', saveErr);
      }
    } catch (error) {
      console.warn('Error en la sesión de ping:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const stopTest = () => {
    abortControllerRef.current.isAborted = true;
    setIsRunning(false);
  };

  const getRttColor = (rtt: number | null) => {
    if (rtt === null) return '#9CA3AF';
    if (rtt < 50) return '#10B981'; // Excelente / Verde
    if (rtt < 100) return '#3B82F6'; // Buena / Azul
    if (rtt < 180) return '#F59E0B'; // Moderada / Ámbar
    return '#EF4444'; // Pobre / Rojo
  };

  const getRttStyle = (success: boolean, rtt: number) => {
    if (!success) return styles.colorRed;
    if (rtt < 50) return styles.colorGreen;
    if (rtt < 100) return styles.colorBlue;
    if (rtt < 180) return styles.colorAmber;
    return styles.colorRed;
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.badge}>TCP SOCKETS</Text>
          <Text style={styles.headerTitle}>Sondas de Ping y Jitter (Etapa 3)</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Selector de Host */}
      <Text style={styles.sectionLabel}>Host de Referencia:</Text>
      <View style={styles.targetsContainer}>
        {DEFAULT_PING_TARGETS.map(target => {
          const isSelected = selectedTarget.id === target.id;
          return (
            <TouchableOpacity
              key={target.id}
              disabled={isRunning}
              onPress={() => setSelectedTarget(target)}
              style={[
                styles.targetPill,
                isSelected && styles.targetPillActive,
              ]}>
              <Text
                style={[
                  styles.targetPillText,
                  isSelected && styles.targetPillTextActive,
                ]}>
                {target.name.split(' ')[0]}
              </Text>
              <Text
                style={[
                  styles.targetHostSubtext,
                  isSelected && styles.targetHostSubtextActive,
                ]}>
                {target.host}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selector de Cantidad de Sondas */}
      <View style={styles.probesCountRow}>
        <Text style={styles.sectionLabel}>Cantidad de sondas:</Text>
        <View style={styles.countPillsContainer}>
          {[5, 10, 20].map(count => (
            <TouchableOpacity
              key={count}
              disabled={isRunning}
              onPress={() => setProbeCount(count)}
              style={[
                styles.countPill,
                probeCount === count && styles.countPillActive,
              ]}>
              <Text
                style={[
                  styles.countPillText,
                  probeCount === count && styles.countPillTextActive,
                ]}>
                {count}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Botón de Acción */}
      <TouchableOpacity
        onPress={isRunning ? stopTest : startTest}
        style={[styles.actionButton, isRunning && styles.stopButton]}>
        {isRunning ? (
          <View style={styles.buttonContent}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.actionButtonText}>
              Detener Test ({progress.current}/{progress.total})
            </Text>
          </View>
        ) : (
          <Text style={styles.actionButtonText}>Iniciar Test de Latencia</Text>
        )}
      </TouchableOpacity>

      {/* Barra de Progreso */}
      {isRunning && (
        <View style={styles.progressBarBackground}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${(progress.current / progress.total) * 100}%` },
            ]}
          />
        </View>
      )}

      {/* Métricas en Tiempo Real / Finales */}
      {(partialStats || finalResult) && (
        <View style={styles.resultsContainer}>
          <View style={styles.metricsGrid}>
            <MetricBox
              title="RTT Promedio"
              value={
                (finalResult?.avgRttMs ?? partialStats?.avgRttMs) !== null
                  ? `${finalResult?.avgRttMs ?? partialStats?.avgRttMs} ms`
                  : 'N/D'
              }
              valueColor={getRttColor(finalResult?.avgRttMs ?? partialStats?.avgRttMs ?? null)}
            />
            <MetricBox
              title="Jitter (RFC 3550)"
              value={
                (finalResult?.jitterMs ?? partialStats?.jitterMs) !== null
                  ? `${finalResult?.jitterMs ?? partialStats?.jitterMs} ms`
                  : 'N/D'
              }
              valueColor="#4F46E5"
            />
            <MetricBox
              title="Mín / Máx"
              value={
                (finalResult?.minRttMs ?? partialStats?.minRttMs) !== null
                  ? `${finalResult?.minRttMs ?? partialStats?.minRttMs} / ${
                      finalResult?.maxRttMs ?? partialStats?.maxRttMs
                    } ms`
                  : 'N/D'
              }
              valueColor="#1F2937"
            />
            <MetricBox
              title="Pérdida de Paquetes"
              value={
                finalResult
                  ? `${finalResult.packetLossPercent}% (${finalResult.failedProbes}/${finalResult.totalProbes})`
                  : `${probesList.filter(p => !p.success).length} fallos`
              }
              valueColor={
                finalResult?.packetLossPercent && finalResult.packetLossPercent > 0
                  ? '#EF4444'
                  : '#10B981'
              }
            />
          </View>

          {/* Historial de sondas individuales */}
          <Text style={styles.probesHistoryLabel}>Sondas registradas:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.probesScroll}>
            {probesList.map(p => (
              <View
                key={p.sequence}
                style={[
                  styles.probeChip,
                  !p.success && styles.probeChipError,
                ]}>
                <Text style={styles.probeChipSeq}>#{p.sequence}</Text>
                <Text
                  style={[
                    styles.probeChipRtt,
                    getRttStyle(p.success, p.rttMs),
                  ]}>
                  {p.success ? `${p.rttMs}ms` : 'Timeout'}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const MetricBox: React.FC<{
  title: string;
  value: string;
  valueColor: string;
}> = ({ title, value, valueColor }) => (
  <View style={styles.metricBox}>
    <Text style={styles.metricBoxTitle}>{title}</Text>
    <Text style={[styles.metricBoxValue, { color: valueColor }]}>{value}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: '#E0E7FF',
    color: '#3730A3',
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
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 14,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 8,
  },
  targetsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  targetPill: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  targetPillActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  targetPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  targetPillTextActive: {
    color: '#4F46E5',
  },
  targetHostSubtext: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  targetHostSubtextActive: {
    color: '#6366F1',
  },
  probesCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  countPillsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  countPill: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  countPillActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  countPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  countPillTextActive: {
    color: '#FFFFFF',
  },
  actionButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    backgroundColor: '#DC2626',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
  },
  resultsContainer: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricBox: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  metricBoxTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  metricBoxValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  probesHistoryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 4,
  },
  probesScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
  },
  probeChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  probeChipError: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  probeChipSeq: {
    fontSize: 9,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  probeChipRtt: {
    fontSize: 11,
    fontWeight: '700',
  },
  colorGreen: {
    color: '#10B981',
  },
  colorBlue: {
    color: '#3B82F6',
  },
  colorAmber: {
    color: '#F59E0B',
  },
  colorRed: {
    color: '#EF4444',
  },
});
