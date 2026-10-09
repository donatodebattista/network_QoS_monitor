import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  QoSMeasurementRecord,
  MeasurementFilter,
  HistorySummary,
} from './types';

const STORAGE_KEY = '@network_qos_measurements_v1';

/**
 * Guarda una nueva medición de calidad de red en el almacenamiento persistente.
 */
export async function saveMeasurement(
  record: QoSMeasurementRecord
): Promise<void> {
  const existing = await getMeasurements();
  const updated = [record, ...existing];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

/**
 * Obtiene las mediciones almacenadas, ordenadas de más reciente a más antigua,
 * con soporte para filtrado opcional.
 */
export async function getMeasurements(
  filter?: MeasurementFilter
): Promise<QoSMeasurementRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    let list: QoSMeasurementRecord[] = JSON.parse(raw);

    if (filter) {
      if (filter.connectionType && filter.connectionType !== 'all') {
        list = list.filter(item => item.connectionType === filter.connectionType);
      }
      if (filter.startDate) {
        list = list.filter(item => item.timestamp >= filter.startDate!);
      }
      if (filter.endDate) {
        list = list.filter(item => item.timestamp <= filter.endDate!);
      }
    }

    return list;
  } catch (error) {
    console.warn('Error al leer historial de mediciones:', error);
    return [];
  }
}

/**
 * Elimina una medición puntual por su ID.
 */
export async function deleteMeasurement(id: string): Promise<void> {
  const existing = await getMeasurements();
  const updated = existing.filter(item => item.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

/**
 * Vacía todo el historial de mediciones guardado.
 */
export async function clearAllMeasurements(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/**
 * Calcula un resumen estadístico agregado del historial (RF-05 / RF-09).
 */
export async function getHistorySummary(): Promise<HistorySummary> {
  const list = await getMeasurements();
  if (list.length === 0) {
    return {
      totalRecords: 0,
      wifiCount: 0,
      cellularCount: 0,
      avgLatency: null,
      avgDownload: null,
      avgUpload: null,
    };
  }

  const wifiCount = list.filter(m => m.connectionType === 'wifi').length;
  const cellularCount = list.filter(m => m.connectionType === 'cellular').length;

  const validLatency = list
    .map(m => m.rttAvgMs)
    .filter((v): v is number => typeof v === 'number');
  const avgLatency =
    validLatency.length > 0
      ? Math.round(
          (validLatency.reduce((a, b) => a + b, 0) / validLatency.length) * 10
        ) / 10
      : null;

  const validDownload = list
    .map(m => m.downloadSpeedMbps)
    .filter((v): v is number => typeof v === 'number');
  const avgDownload =
    validDownload.length > 0
      ? Math.round(
          (validDownload.reduce((a, b) => a + b, 0) / validDownload.length) * 10
        ) / 10
      : null;

  const validUpload = list
    .map(m => m.uploadSpeedMbps)
    .filter((v): v is number => typeof v === 'number');
  const avgUpload =
    validUpload.length > 0
      ? Math.round(
          (validUpload.reduce((a, b) => a + b, 0) / validUpload.length) * 10
        ) / 10
      : null;

  return {
    totalRecords: list.length,
    wifiCount,
    cellularCount,
    avgLatency,
    avgDownload,
    avgUpload,
  };
}

/**
 * Exporta el historial completo a formato JSON formateado (RF-08).
 */
export async function exportToJSON(): Promise<string> {
  const list = await getMeasurements();
  return JSON.stringify(list, null, 2);
}

/**
 * Exporta el historial completo a formato CSV tabular delimitado por comas (RF-08).
 */
export async function exportToCSV(): Promise<string> {
  const list = await getMeasurements();
  const headers = [
    'id',
    'timestamp',
    'isoDate',
    'connectionType',
    'isInternetReachable',
    'carrierName',
    'cellularGeneration',
    'signalDbm',
    'signalLevel',
    'cellId',
    'tac',
    'pingTargetHost',
    'rttAvgMs',
    'rttMinMs',
    'rttMaxMs',
    'jitterMs',
    'packetLossPercent',
    'downloadSpeedMbps',
    'uploadSpeedMbps',
    'latitude',
    'longitude',
    'accuracy',
    'altitude',
  ];

  const escapeCsv = (val: unknown) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = list.map(item => [
    escapeCsv(item.id),
    escapeCsv(item.timestamp),
    escapeCsv(item.isoDate),
    escapeCsv(item.connectionType),
    escapeCsv(item.isInternetReachable ? 'true' : 'false'),
    escapeCsv(item.carrierName),
    escapeCsv(item.cellularGeneration),
    escapeCsv(item.signalDbm),
    escapeCsv(item.signalLevel),
    escapeCsv(item.cellId),
    escapeCsv(item.tac),
    escapeCsv(item.pingTargetHost),
    escapeCsv(item.rttAvgMs),
    escapeCsv(item.rttMinMs),
    escapeCsv(item.rttMaxMs),
    escapeCsv(item.jitterMs),
    escapeCsv(item.packetLossPercent),
    escapeCsv(item.downloadSpeedMbps),
    escapeCsv(item.uploadSpeedMbps),
    escapeCsv(item.latitude),
    escapeCsv(item.longitude),
    escapeCsv(item.accuracy),
    escapeCsv(item.altitude),
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
