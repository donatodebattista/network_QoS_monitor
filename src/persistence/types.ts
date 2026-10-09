export interface QoSMeasurementRecord {
  id: string;
  timestamp: number;
  isoDate: string;

  // 1. Conectividad general
  connectionType: string; // 'wifi' | 'cellular' | 'none'
  isInternetReachable: boolean;

  // 2. Telefonía Celular (Nativo)
  carrierName?: string;
  simOperator?: string;
  cellularGeneration?: string; // '4G LTE' | '5G NR'
  signalDbm?: number;
  signalLevel?: number; // 0 - 4
  cellId?: number | null;
  tac?: number | null;

  // 3. Sondas TCP / Latencia
  pingTargetHost?: string;
  rttAvgMs?: number | null;
  rttMinMs?: number | null;
  rttMaxMs?: number | null;
  jitterMs?: number | null;
  packetLossPercent?: number;

  // 4. Throughput
  downloadSpeedMbps?: number | null;
  uploadSpeedMbps?: number | null;

  // 5. Georreferenciación (GPS)
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  altitude?: number | null;
}

export interface MeasurementFilter {
  connectionType?: 'all' | 'wifi' | 'cellular';
  startDate?: number;
  endDate?: number;
}

export interface HistorySummary {
  totalRecords: number;
  wifiCount: number;
  cellularCount: number;
  avgLatency: number | null;
  avgDownload: number | null;
  avgUpload: number | null;
}
