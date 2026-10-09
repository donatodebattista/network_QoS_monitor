import {
  ThroughputMetric,
  ThroughputProgressCallback,
  ThroughputServerConfig,
  ThroughputSessionResult,
} from './types';

export const DEFAULT_THROUGHPUT_SERVERS: ThroughputServerConfig[] = [
  {
    id: 'cloudflare',
    name: 'Cloudflare CDN (Global)',
    downloadUrl: 'https://speed.cloudflare.com/__down?bytes=5000000', // 5 MB
    uploadUrl: 'https://speed.cloudflare.com/__up',
  },
  {
    id: 'local',
    name: 'Servidor Local (Node.js)',
    downloadUrl: 'http://192.168.1.99:3000/download?size=5',
    uploadUrl: 'http://192.168.1.99:3000/upload',
    isCustom: true,
  },
];

/**
 * Ejecuta una prueba de throughput de descarga (Download) midiendo bytes y tiempo transcurrido.
 */
export function executeDownloadTest(
  downloadUrl: string,
  onProgress?: ThroughputProgressCallback,
  abortRef?: { isAborted: boolean; currentXhr?: XMLHttpRequest }
): Promise<ThroughputMetric> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    if (abortRef) {
      abortRef.currentXhr = xhr;
    }

    // Agregar cache-buster para evitar lectura desde la caché HTTP local
    const separator = downloadUrl.includes('?') ? '&' : '?';
    const targetUrl = `${downloadUrl}${separator}_nocache=${Date.now()}`;

    xhr.open('GET', targetUrl);
    try {
      xhr.responseType = 'blob';
    } catch {
      // Ignorar fallback si la plataforma no soporta blob en XHR
    }
    xhr.timeout = 30000; // 30 segundos máx

    let startTime = Date.now();
    let lastProgressTime = startTime;
    let bytesReceived = 0;

    xhr.onloadstart = () => {
      startTime = Date.now();
      lastProgressTime = startTime;
      if (onProgress) {
        onProgress({
          phase: 'downloading',
          instantSpeedMbps: 0,
          progressPercent: 0,
          transferredBytes: 0,
        });
      }
    };

    xhr.onprogress = event => {
      if (abortRef?.isAborted) {
        xhr.abort();
        return;
      }

      bytesReceived = event.loaded;
      const now = Date.now();
      const elapsedTotalSec = (now - startTime) / 1000;

      if (elapsedTotalSec > 0.05) {
        const instantMbps = (event.loaded * 8) / elapsedTotalSec / 1000000;
        const total = event.total > 0 ? event.total : 5000000;
        const percent = Math.min(99, Math.round((event.loaded / total) * 100));

        if (now - lastProgressTime > 80 && onProgress) {
          lastProgressTime = now;
          onProgress({
            phase: 'downloading',
            instantSpeedMbps: Math.max(0.1, Math.round(instantMbps * 10) / 10),
            progressPercent: percent,
            transferredBytes: event.loaded,
            totalExpectedBytes: event.total > 0 ? event.total : undefined,
          });
        }
      }
    };

    xhr.onload = () => {
      const durationMs = Math.max(50, Date.now() - startTime);
      const durationSec = durationMs / 1000;

      let totalBytes = bytesReceived;
      if (!totalBytes && xhr.response && typeof xhr.response.size === 'number') {
        totalBytes = xhr.response.size;
      }
      if (!totalBytes) {
        try {
          const cl = xhr.getResponseHeader('Content-Length');
          if (cl) totalBytes = parseInt(cl, 10);
        } catch {
          // fallback
        }
      }
      if (!totalBytes) {
        totalBytes = 5000000;
      }

      const finalMbps = (totalBytes * 8) / durationSec / 1000000;

      if (onProgress) {
        onProgress({
          phase: 'downloading',
          instantSpeedMbps: Math.max(0.1, Math.round(finalMbps * 10) / 10),
          progressPercent: 100,
          transferredBytes: totalBytes,
        });
      }

      resolve({
        speedMbps: Math.round(finalMbps * 10) / 10,
        transferredBytes: totalBytes,
        durationMs,
      });
    };

    xhr.onerror = () => {
      reject(new Error(`Fallo en la conexión de descarga (${targetUrl})`));
    };

    xhr.ontimeout = () => {
      reject(new Error('Tiempo de espera agotado en la prueba de descarga'));
    };

    xhr.onabort = () => {
      reject(new Error('Prueba de descarga cancelada'));
    };

    startTime = Date.now();
    xhr.send();
  });
}

/**
 * Genera un payload de subida controlado.
 */
function generateUploadPayload(sizeBytes: number): string {
  const chunkSize = 16384; // 16 KB
  const chunk = 'X'.repeat(chunkSize);
  const count = Math.ceil(sizeBytes / chunkSize);
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    parts.push(chunk);
  }
  return parts.join('').substring(0, sizeBytes);
}

/**
 * Ejecuta una prueba de throughput de subida (Upload) transmitiendo bytes al endpoint de echo.
 */
export function executeUploadTest(
  uploadUrl: string,
  payloadSizeBytes = 2000000, // 2 MB por defecto
  onProgress?: ThroughputProgressCallback,
  abortRef?: { isAborted: boolean; currentXhr?: XMLHttpRequest }
): Promise<ThroughputMetric> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    if (abortRef) {
      abortRef.currentXhr = xhr;
    }

    const payload = generateUploadPayload(payloadSizeBytes);
    const targetUrl = `${uploadUrl}${uploadUrl.includes('?') ? '&' : '?'}_nocache=${Date.now()}`;

    xhr.open('POST', targetUrl);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.timeout = 30000;

    let startTime = Date.now();
    let lastProgressTime = startTime;
    let bytesSent = 0;

    xhr.onloadstart = () => {
      startTime = Date.now();
      lastProgressTime = startTime;
      if (onProgress) {
        onProgress({
          phase: 'uploading',
          instantSpeedMbps: 0,
          progressPercent: 0,
          transferredBytes: 0,
          totalExpectedBytes: payloadSizeBytes,
        });
      }
    };

    if (xhr.upload) {
      xhr.upload.onprogress = event => {
        if (abortRef?.isAborted) {
          xhr.abort();
          return;
        }

        bytesSent = event.loaded;
        const now = Date.now();
        const elapsedTotalSec = (now - startTime) / 1000;

        if (elapsedTotalSec > 0.05) {
          const instantMbps = (event.loaded * 8) / elapsedTotalSec / 1000000;
          const total = event.total > 0 ? event.total : payloadSizeBytes;
          const percent = Math.min(99, Math.round((event.loaded / total) * 100));

          if (now - lastProgressTime > 80 && onProgress) {
            lastProgressTime = now;
            onProgress({
              phase: 'uploading',
              instantSpeedMbps: Math.max(0.1, Math.round(instantMbps * 10) / 10),
              progressPercent: percent,
              transferredBytes: event.loaded,
              totalExpectedBytes: total,
            });
          }
        }
      };
    }

    xhr.onload = () => {
      const durationMs = Math.max(50, Date.now() - startTime);
      const durationSec = durationMs / 1000;
      const totalBytes = bytesSent > 0 ? bytesSent : payloadSizeBytes;
      const finalMbps = (totalBytes * 8) / durationSec / 1000000;

      if (onProgress) {
        onProgress({
          phase: 'uploading',
          instantSpeedMbps: Math.max(0.1, Math.round(finalMbps * 10) / 10),
          progressPercent: 100,
          transferredBytes: totalBytes,
        });
      }

      resolve({
        speedMbps: Math.round(finalMbps * 10) / 10,
        transferredBytes: totalBytes,
        durationMs,
      });
    };

    xhr.onerror = () => {
      reject(new Error(`Fallo en la conexión de subida (${targetUrl})`));
    };

    xhr.ontimeout = () => {
      reject(new Error('Tiempo de espera agotado en la prueba de subida'));
    };

    xhr.onabort = () => {
      reject(new Error('Prueba de subida cancelada'));
    };

    startTime = Date.now();
    xhr.send(payload);
  });
}

/**
 * Orquesta la prueba completa de Throughput (Descarga seguida de Subida).
 */
export async function executeFullThroughputTest(
  server: ThroughputServerConfig,
  onProgress?: ThroughputProgressCallback,
  abortRef?: { isAborted: boolean; currentXhr?: XMLHttpRequest }
): Promise<ThroughputSessionResult> {
  const downloadResult = await executeDownloadTest(
    server.downloadUrl,
    onProgress,
    abortRef
  );

  if (abortRef?.isAborted) {
    throw new Error('Prueba cancelada por el usuario');
  }

  // Pequeña pausa de estabilización de socket (300ms)
  await new Promise<void>(res => setTimeout(() => res(), 300));

  const uploadResult = await executeUploadTest(
    server.uploadUrl,
    2000000,
    onProgress,
    abortRef
  );

  if (onProgress) {
    onProgress({
      phase: 'completed',
      instantSpeedMbps: 0,
      progressPercent: 100,
      transferredBytes: downloadResult.transferredBytes + uploadResult.transferredBytes,
    });
  }

  return {
    download: downloadResult,
    upload: uploadResult,
    serverUrl: server.name,
    timestamp: Date.now(),
  };
}
