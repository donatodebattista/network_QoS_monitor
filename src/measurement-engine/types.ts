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
