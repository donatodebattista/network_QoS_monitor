import TcpSocket from 'react-native-tcp-socket';
import {
  PingTarget,
  SingleProbeResult,
  PingSessionStats,
  PingSessionResult,
  PingProgressCallback,
} from './types';

export const DEFAULT_PING_TARGETS: PingTarget[] = [
  {
    id: 'cloudflare',
    name: 'Cloudflare (1.1.1.1)',
    host: '1.1.1.1',
    port: 443,
  },
  {
    id: 'google',
    name: 'Google DNS (8.8.8.8)',
    host: '8.8.8.8',
    port: 443,
  },
  {
    id: 'opendns',
    name: 'OpenDNS (208.67.222.222)',
    host: '208.67.222.222',
    port: 443,
  },
];

/**
 * Calcula estadísticas de latencia (min, avg, max, jitter RFC 3550).
 */
export function calculateStats(probes: SingleProbeResult[]): PingSessionStats {
  const successful = probes.filter(p => p.success);
  if (successful.length === 0) {
    return { minRttMs: null, avgRttMs: null, maxRttMs: null, jitterMs: null };
  }

  const rtts = successful.map(p => p.rttMs);
  const min = Math.min(...rtts);
  const max = Math.max(...rtts);
  const sum = rtts.reduce((acc, val) => acc + val, 0);
  const avg = Math.round((sum / rtts.length) * 10) / 10;

  // Jitter según RFC 3550
  let jitter = 0;
  for (let i = 1; i < successful.length; i++) {
    const diff = Math.abs(successful[i].rttMs - successful[i - 1].rttMs);
    jitter = jitter + (diff - jitter) / 16;
  }

  return {
    minRttMs: Math.round(min * 10) / 10,
    avgRttMs: avg,
    maxRttMs: Math.round(max * 10) / 10,
    jitterMs: Math.round(jitter * 10) / 10,
  };
}

/**
 * Ejecuta una sonda individual de handshake TCP hacia el host y puerto especificados.
 */
export function executeSingleProbe(
  host: string,
  port: number,
  sequence: number,
  timeoutMs = 2500
): Promise<SingleProbeResult> {
  return new Promise(resolve => {
    let resolved = false;
    const startTime = Date.now();

    const cleanupAndResolve = (result: SingleProbeResult, socket?: any) => {
      if (resolved) return;
      resolved = true;
      try {
        if (socket) {
          socket.destroy();
        }
      } catch {
        // Ignorar errores al destruir el socket
      }
      resolve(result);
    };

    let client: any = null;

    // Timeout de seguridad en caso de que el socket no dispare timeout nativo
    const safetyTimer = setTimeout(() => {
      cleanupAndResolve(
        {
          sequence,
          rttMs: timeoutMs,
          timestamp: Date.now(),
          success: false,
          error: 'Timeout (excedió tiempo de espera)',
        },
        client
      );
    }, timeoutMs + 100);

    try {
      client = TcpSocket.createConnection(
        {
          host,
          port,
        },
        () => {
          clearTimeout(safetyTimer);
          const rtt = Date.now() - startTime;
          cleanupAndResolve(
            {
              sequence,
              rttMs: Math.max(1, rtt),
              timestamp: Date.now(),
              success: true,
            },
            client
          );
        }
      );

      client.setTimeout(timeoutMs);

      client.on('error', (err: any) => {
        clearTimeout(safetyTimer);
        cleanupAndResolve(
          {
            sequence,
            rttMs: Date.now() - startTime,
            timestamp: Date.now(),
            success: false,
            error: err?.message || 'Error de socket TCP',
          },
          client
        );
      });

      client.on('timeout', () => {
        clearTimeout(safetyTimer);
        cleanupAndResolve(
          {
            sequence,
            rttMs: timeoutMs,
            timestamp: Date.now(),
            success: false,
            error: 'Timeout TCP',
          },
          client
        );
      });
    } catch (err: any) {
      clearTimeout(safetyTimer);
      cleanupAndResolve(
        {
          sequence,
          rttMs: 0,
          timestamp: Date.now(),
          success: false,
          error: err?.message || 'Error al crear conexión TCP',
        },
        client
      );
    }
  });
}

/**
 * Orquesta una sesión completa de sondeo RTT con ráfagas consecutivas.
 */
export async function executePingSession(
  target: PingTarget,
  probeCount = 10,
  intervalMs = 200,
  onProgress?: PingProgressCallback,
  abortController?: { isAborted: boolean }
): Promise<PingSessionResult> {
  const startTime = Date.now();
  const probes: SingleProbeResult[] = [];

  for (let i = 1; i <= probeCount; i++) {
    if (abortController?.isAborted) {
      break;
    }

    const probe = await executeSingleProbe(target.host, target.port, i);
    probes.push(probe);

    const partialStats = calculateStats(probes);
    if (onProgress) {
      onProgress(probe, i, probeCount, partialStats);
    }

    if (i < probeCount && !abortController?.isAborted) {
      await new Promise<void>(res => setTimeout(() => res(), intervalMs));
    }
  }

  const endTime = Date.now();
  const successful = probes.filter(p => p.success).length;
  const failed = probes.length - successful;
  const lossPercent = probes.length > 0 ? Math.round((failed / probes.length) * 100) : 0;
  const finalStats = calculateStats(probes);

  return {
    target,
    totalProbes: probes.length,
    successfulProbes: successful,
    failedProbes: failed,
    packetLossPercent: lossPercent,
    minRttMs: finalStats.minRttMs,
    avgRttMs: finalStats.avgRttMs,
    maxRttMs: finalStats.maxRttMs,
    jitterMs: finalStats.jitterMs,
    probes,
    startTime,
    endTime,
  };
}
