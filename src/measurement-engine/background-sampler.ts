import NetInfo from '@react-native-community/netinfo';
import { getCellularQoSInfo } from '../native-bridge';
import { getCurrentCoordinates } from '../geo';
import { executeSingleProbe, DEFAULT_PING_TARGETS } from './ping-engine';
import { saveMeasurement, QoSMeasurementRecord } from '../persistence';
import { showQoSNotification } from '../native-bridge/notification-bridge';

export interface DegradationThresholds {
  criticalSignalDbm: number; // Defecto: -115 dBm
  maxLatencyMs: number; // Defecto: 250 ms
  notifyOnDisconnect: boolean; // Defecto: true
}

export const DEFAULT_THRESHOLDS: DegradationThresholds = {
  criticalSignalDbm: -115,
  maxLatencyMs: 250,
  notifyOnDisconnect: true,
};

export interface SampleCycleResult {
  record: QoSMeasurementRecord;
  degraded: boolean;
  degradationReason: string | null;
}

export interface SamplerStats {
  running: boolean;
  totalSamples: number;
  lastSampleTime: string | null;
  lastDegradation: string | null;
}

// Variables de estado del temporizador en memoria
let intervalTimer: ReturnType<typeof setInterval> | null = null;
let sampleCounter = 0;
let lastSampleTimeString: string | null = null;
let lastDegradationString: string | null = null;
let currentThresholds: DegradationThresholds = { ...DEFAULT_THRESHOLDS };

/**
 * Ejecuta un ciclo completo de medición de QoS y evalúa degradación de servicio.
 */
export async function executeQoSSampleCycle(
  thresholds: DegradationThresholds = currentThresholds
): Promise<SampleCycleResult> {
  const [netState, cellularInfo, coords, probeResult] = await Promise.all([
    NetInfo.fetch(),
    getCellularQoSInfo().catch(() => null),
    getCurrentCoordinates().catch(() => null),
    executeSingleProbe(
      DEFAULT_PING_TARGETS[0].host,
      DEFAULT_PING_TARGETS[0].port,
      1,
      2500
    ).catch(() => null),
  ]);

  const now = new Date();
  const record: QoSMeasurementRecord = {
    id: `bg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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

    // Sonda de Latencia
    pingTargetHost: DEFAULT_PING_TARGETS[0].host,
    rttAvgMs: probeResult?.success ? probeResult.rttMs : null,
    rttMinMs: probeResult?.success ? probeResult.rttMs : null,
    rttMaxMs: probeResult?.success ? probeResult.rttMs : null,

    // GPS
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    accuracy: coords?.accuracy ?? null,
    altitude: coords?.altitude ?? null,
  };

  // Guardar en persistencia (AsyncStorage)
  await saveMeasurement(record);
  sampleCounter++;
  lastSampleTimeString = now.toLocaleTimeString();

  // Evaluación de reglas de degradación severa (RF-07)
  let degraded = false;
  let degradationReason: string | null = null;

  if (thresholds.notifyOnDisconnect && (!netState.isConnected || netState.isInternetReachable === false)) {
    degraded = true;
    degradationReason = 'Sin acceso a Internet / Desconectado de la red.';
  } else if (
    record.signalDbm !== undefined &&
    record.signalDbm <= thresholds.criticalSignalDbm
  ) {
    degraded = true;
    degradationReason = `Señal celular crítica: ${record.signalDbm} dBm (Umbral: ${thresholds.criticalSignalDbm} dBm).`;
  } else if (
    record.rttAvgMs !== null &&
    record.rttAvgMs !== undefined &&
    record.rttAvgMs >= thresholds.maxLatencyMs
  ) {
    degraded = true;
    degradationReason = `Latencia RTT excesiva: ${record.rttAvgMs} ms (Umbral: ${thresholds.maxLatencyMs} ms).`;
  }

  if (degraded && degradationReason) {
    lastDegradationString = degradationReason;
    await showQoSNotification({
      title: '⚠️ Alerta de Degradación de Red',
      message: `${degradationReason} Operador: ${record.carrierName || record.connectionType.toUpperCase()}`,
      isWarning: true,
    });
  }

  return {
    record,
    degraded,
    degradationReason,
  };
}

/**
 * Inicia el temporizador de muestreo periódico.
 */
export function startPeriodicSampling(
  intervalMinutes: number,
  thresholds: DegradationThresholds = DEFAULT_THRESHOLDS,
  onCycleComplete?: (result: SampleCycleResult) => void
): void {
  stopPeriodicSampling();

  currentThresholds = thresholds;
  const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;

  // Ejecución inmediata inicial
  executeQoSSampleCycle(thresholds).then(result => {
    onCycleComplete?.(result);
  });

  intervalTimer = setInterval(async () => {
    try {
      const result = await executeQoSSampleCycle(currentThresholds);
      onCycleComplete?.(result);
    } catch (err) {
      console.warn('Error en ciclo de muestreo:', err);
    }
  }, intervalMs);
}

/**
 * Detiene el temporizador de muestreo periódico.
 */
export function stopPeriodicSampling(): void {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
}

/**
 * Devuelve el estado actual del muestreador.
 */
export function getSamplerStats(): SamplerStats {
  return {
    running: intervalTimer !== null,
    totalSamples: sampleCounter,
    lastSampleTime: lastSampleTimeString,
    lastDegradation: lastDegradationString,
  };
}
