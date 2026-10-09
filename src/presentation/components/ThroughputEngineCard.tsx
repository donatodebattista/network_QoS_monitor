import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {
  DEFAULT_THROUGHPUT_SERVERS,
  ThroughputProgress,
  ThroughputServerConfig,
  ThroughputSessionResult,
  executeFullThroughputTest,
} from '../../measurement-engine';
import NetInfo from '@react-native-community/netinfo';
import { getCellularQoSInfo } from '../../native-bridge';
import { getCurrentCoordinates } from '../../geo';
import { saveMeasurement, QoSMeasurementRecord } from '../../persistence';

export const ThroughputEngineCard: React.FC = () => {
  const [selectedServer, setSelectedServer] = useState<ThroughputServerConfig>(
    DEFAULT_THROUGHPUT_SERVERS[0]
  );
  const [localIp, setLocalIp] = useState<string>('192.168.1.99:3000');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<ThroughputProgress>({
    phase: 'idle',
    instantSpeedMbps: 0,
    progressPercent: 0,
    transferredBytes: 0,
  });
  const [result, setResult] = useState<ThroughputSessionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<{ isAborted: boolean; currentXhr?: XMLHttpRequest }>({
    isAborted: false,
  });

  const getEffectiveServer = (): ThroughputServerConfig => {
    if (selectedServer.isCustom) {
      let cleanHost = localIp.trim();
      if (!cleanHost.startsWith('http://') && !cleanHost.startsWith('https://')) {
        cleanHost = `http://${cleanHost}`;
      }
      cleanHost = cleanHost.replace(/\/+$/, '');
      return {
        id: 'local',
        name: `Local (${cleanHost.replace(/^https?:\/\//, '')})`,
        downloadUrl: `${cleanHost}/download?size=5`,
        uploadUrl: `${cleanHost}/upload`,
        isCustom: true,
      };
    }
    return selectedServer;
  };

  const startTest = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    abortRef.current = { isAborted: false };
    setProgress({
      phase: 'downloading',
      instantSpeedMbps: 0,
      progressPercent: 0,
      transferredBytes: 0,
    });

    const targetServer = getEffectiveServer();

    try {
      const sessionResult = await executeFullThroughputTest(
        targetServer,
        currentProgress => {
          setProgress(currentProgress);
        },
        abortRef.current
      );
      setResult(sessionResult);

      // Auto-guardar medición de Throughput en persistencia
      try {
        const [netState, cellularInfo, coords] = await Promise.all([
          NetInfo.fetch(),
          getCellularQoSInfo().catch(() => null),
          getCurrentCoordinates().catch(() => null),
        ]);

        const record: QoSMeasurementRecord = {
          id: `speed_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
          downloadSpeedMbps: sessionResult.download?.speedMbps ?? null,
          uploadSpeedMbps: sessionResult.upload?.speedMbps ?? null,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          accuracy: coords?.accuracy ?? null,
        };

        await saveMeasurement(record);
      } catch (saveErr) {
        console.warn('Error al auto-guardar medición de velocidad:', saveErr);
      }
    } catch (err: unknown) {
      if (err instanceof Error && !abortRef.current.isAborted) {
        setError(err.message);
      }
    } finally {
      setIsRunning(false);
      setProgress(prev => ({ ...prev, phase: 'idle' }));
    }
  };

  const stopTest = () => {
    abortRef.current.isAborted = true;
    if (abortRef.current.currentXhr) {
      abortRef.current.currentXhr.abort();
    }
    setIsRunning(false);
    setProgress(prev => ({ ...prev, phase: 'idle' }));
  };

  const getPhaseBadgeText = () => {
    switch (progress.phase) {
      case 'downloading':
        return 'PROBANDO DESCARGA';
      case 'uploading':
        return 'PROBANDO SUBIDA';
      case 'completed':
        return 'COMPLETADO';
      default:
        return 'EN ESPERA';
    }
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.badge}>THROUGHPUT</Text>
          <Text style={styles.headerTitle}>Test de Velocidad</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Selector de Servidor */}
      <Text style={styles.sectionLabel}>Servidor de Prueba:</Text>
      <View style={styles.serversRow}>
        {DEFAULT_THROUGHPUT_SERVERS.map(srv => {
          const isSelected = selectedServer.id === srv.id;
          return (
            <TouchableOpacity
              key={srv.id}
              disabled={isRunning}
              onPress={() => setSelectedServer(srv)}
              style={[
                styles.serverPill,
                isSelected && styles.serverPillActive,
              ]}>
              <Text
                style={[
                  styles.serverPillText,
                  isSelected && styles.serverPillTextActive,
                ]}>
                {srv.id === 'cloudflare' ? 'Cloudflare CDN' : 'Servidor Local'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Input para Servidor Local configurable */}
      {selectedServer.isCustom && (
        <View style={styles.localInputContainer}>
          <Text style={styles.inputLabel}>IP / Host del backend (PC):</Text>
          <TextInput
            style={styles.textInput}
            value={localIp}
            onChangeText={setLocalIp}
            editable={!isRunning}
            placeholder="192.168.1.99:3000"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.presetsRow}>
            <TouchableOpacity
              disabled={isRunning}
              style={[
                styles.presetPill,
                localIp === '192.168.1.99:3000' && styles.presetPillActive,
              ]}
              onPress={() => setLocalIp('192.168.1.99:3000')}>
              <Text
                style={[
                  styles.presetPillText,
                  localIp === '192.168.1.99:3000' && styles.presetPillTextActive,
                ]}>
                Wi-Fi: 192.168.1.99
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={isRunning}
              style={[
                styles.presetPill,
                localIp === 'localhost:3000' && styles.presetPillActive,
              ]}
              onPress={() => setLocalIp('localhost:3000')}>
              <Text
                style={[
                  styles.presetPillText,
                  localIp === 'localhost:3000' && styles.presetPillTextActive,
                ]}>
                USB: localhost:3000
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.inputHint}>
            Ejecuta `npm run server` en tu PC para levantar el backend de referencia.
          </Text>
        </View>
      )}

      {/* Tacómetro / Medición en Vivo */}
      {isRunning && (
        <View style={styles.liveSpeedContainer}>
          <View style={styles.phaseBadgeContainer}>
            <Text style={styles.phaseBadgeText}>{getPhaseBadgeText()}</Text>
          </View>
          <Text style={styles.liveSpeedValue}>
            {progress.instantSpeedMbps.toFixed(1)}
          </Text>
          <Text style={styles.liveSpeedUnit}>Mbps</Text>

          {/* Barra de Progreso */}
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progress.progressPercent}%` },
              ]}
            />
          </View>
          <Text style={styles.progressPercentText}>
            {progress.progressPercent}%
          </Text>
        </View>
      )}

      {/* Botón de Acción */}
      <TouchableOpacity
        onPress={isRunning ? stopTest : startTest}
        style={[styles.actionButton, isRunning && styles.stopButton]}>
        {isRunning ? (
          <View style={styles.buttonContent}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Cancelar Prueba</Text>
          </View>
        ) : (
          <Text style={styles.actionButtonText}>
            Iniciar Test de Velocidad (Mbps)
          </Text>
        )}
      </TouchableOpacity>

      {/* Error */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <Text style={styles.errorHint}>
            Si usas Servidor Local, verifica que esté corriendo en tu PC y que tu teléfono esté en la misma red Wi-Fi.
          </Text>
        </View>
      )}

      {/* Resultados Finales */}
      {result && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsHeader}>Resultados de Throughput:</Text>
          <View style={styles.metricsGrid}>
            <SpeedResultBox
              title="Descarga (Download)"
              speedMbps={result.download?.speedMbps ?? 0}
              bytes={result.download?.transferredBytes ?? 0}
              isDownload
            />
            <SpeedResultBox
              title="Subida (Upload)"
              speedMbps={result.upload?.speedMbps ?? 0}
              bytes={result.upload?.transferredBytes ?? 0}
              isDownload={false}
            />
          </View>
        </View>
      )}
    </View>
  );
};

const SpeedResultBox: React.FC<{
  title: string;
  speedMbps: number;
  bytes: number;
  isDownload: boolean;
}> = ({ title, speedMbps, bytes, isDownload }) => {
  const mbFormatted = (bytes / (1024 * 1024)).toFixed(1);
  return (
    <View style={styles.speedBox}>
      <Text style={styles.speedBoxTitle}>{title}</Text>
      <View style={styles.speedBoxValueRow}>
        <Text
          style={[
            styles.speedBoxValue,
            isDownload ? styles.colorGreen : styles.colorBlue,
          ]}>
          {speedMbps.toFixed(1)}
        </Text>
        <Text style={styles.speedBoxUnit}>Mbps</Text>
      </View>
      <Text style={styles.speedBoxSubtext}>{mbFormatted} MB transferidos</Text>
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
  },
  badge: {
    backgroundColor: '#DCFCE7',
    color: '#15803D',
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
  serversRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  serverPill: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  serverPillActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  serverPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  serverPillTextActive: {
    color: '#059669',
  },
  localInputContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#111827',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  presetPill: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  presetPillActive: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  presetPillText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600',
  },
  presetPillTextActive: {
    color: '#059669',
  },
  inputHint: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 6,
  },
  liveSpeedContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 14,
  },
  phaseBadgeContainer: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 8,
  },
  phaseBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  liveSpeedValue: {
    fontSize: 44,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -1,
  },
  liveSpeedUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: -4,
    marginBottom: 12,
  },
  progressBarBackground: {
    width: '85%',
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  progressPercentText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 4,
  },
  actionButton: {
    backgroundColor: '#059669',
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
  errorContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    gap: 4,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  errorHint: {
    fontSize: 11,
    color: '#7F1D1D',
  },
  resultsContainer: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 10,
  },
  resultsHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  speedBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  speedBoxTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  speedBoxValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginVertical: 4,
  },
  speedBoxValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  speedBoxUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  speedBoxSubtext: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  colorGreen: {
    color: '#059669',
  },
  colorBlue: {
    color: '#2563EB',
  },
});
