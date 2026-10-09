export interface PingTarget {
  id: string;
  name: string;
  host: string;
  port: number;
}

export interface SingleProbeResult {
  sequence: number;
  rttMs: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

export interface PingSessionStats {
  minRttMs: number | null;
  avgRttMs: number | null;
  maxRttMs: number | null;
  jitterMs: number | null;
}

export interface PingSessionResult {
  target: PingTarget;
  totalProbes: number;
  successfulProbes: number;
  failedProbes: number;
  packetLossPercent: number;
  minRttMs: number | null;
  avgRttMs: number | null;
  maxRttMs: number | null;
  jitterMs: number | null;
  probes: SingleProbeResult[];
  startTime: number;
  endTime: number;
}

export type PingProgressCallback = (
  currentProbe: SingleProbeResult,
  progressIndex: number,
  totalProbes: number,
  partialStats: PingSessionStats
) => void;

// --- Throughput Types ---

export interface ThroughputMetric {
  speedMbps: number;
  transferredBytes: number;
  durationMs: number;
}

export type ThroughputPhase = 'idle' | 'downloading' | 'uploading' | 'completed' | 'error';

export interface ThroughputProgress {
  phase: ThroughputPhase;
  instantSpeedMbps: number;
  progressPercent: number;
  transferredBytes: number;
  totalExpectedBytes?: number;
}

export type ThroughputProgressCallback = (progress: ThroughputProgress) => void;

export interface ThroughputSessionResult {
  download: ThroughputMetric | null;
  upload: ThroughputMetric | null;
  serverUrl: string;
  timestamp: number;
}

export interface ThroughputServerConfig {
  id: string;
  name: string;
  downloadUrl: string;
  uploadUrl: string;
  isCustom?: boolean;
}
