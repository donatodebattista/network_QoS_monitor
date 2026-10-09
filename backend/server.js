/**
 * Servidor de Referencia para Prueba de Throughput (QoS)
 * Implementado en Node.js puro sin dependencias externas.
 *
 * Endpoints:
 * - GET  /health           -> Verificación de estado del servidor
 * - GET  /download?size=N  -> Descarga N megabytes de datos sintéticos no comprimibles
 * - POST /upload           -> Recibe payload binario/stream y calcula bytes transferidos
 */

const http = require('http');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Buffer pre-generado de 64 KB de bytes pseudo-aleatorios para streaming eficiente
const CHUNK_SIZE = 64 * 1024; // 64 KB
const RANDOM_CHUNK = crypto.randomBytes(CHUNK_SIZE);

const server = http.createServer((req, res) => {
  // Configuración de encabezados CORS y prevención de caché HTTP
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Content-Length, X-Requested-With');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 1. Endpoint de verificación de salud
  if (pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'Network QoS Reference Backend',
        timestamp: Date.now(),
      })
    );
    return;
  }

  // 2. Endpoint de Descarga (Download test)
  if (pathname === '/download' && req.method === 'GET') {
    const sizeParam = parseFloat(parsedUrl.query.size) || 5; // Default 5 MB
    const totalBytes = Math.max(1, Math.min(sizeParam, 50)) * 1024 * 1024; // Limite entre 1MB y 50MB

    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': totalBytes,
    });

    let bytesSent = 0;

    function sendNextChunk() {
      while (bytesSent < totalBytes) {
        const remaining = totalBytes - bytesSent;
        const chunkSize = Math.min(remaining, CHUNK_SIZE);
        const chunk = chunkSize === CHUNK_SIZE ? RANDOM_CHUNK : RANDOM_CHUNK.subarray(0, chunkSize);

        bytesSent += chunkSize;
        const canContinue = res.write(chunk);

        if (!canContinue) {
          res.once('drain', sendNextChunk);
          return;
        }
      }
      res.end();
    }

    sendNextChunk();
    return;
  }

  // 3. Endpoint de Subida (Upload test)
  if (pathname === '/upload' && req.method === 'POST') {
    const startTime = Date.now();
    let bytesReceived = 0;

    req.on('data', chunk => {
      bytesReceived += chunk.length;
    });

    req.on('end', () => {
      const durationMs = Date.now() - startTime;
      const speedMbps =
        durationMs > 0
          ? ((bytesReceived * 8) / (durationMs / 1000) / 1000000).toFixed(2)
          : '0.00';

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          receivedBytes: bytesReceived,
          durationMs,
          serverCalculatedSpeedMbps: parseFloat(speedMbps),
        })
      );
    });

    req.on('error', err => {
      console.error('Error en lectura de upload:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });

    return;
  }

  // 404 por defecto
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
});

server.listen(PORT, HOST, () => {
  console.log(`\n======================================================`);
  console.log(` QoS Reference Backend corriendo en http://${HOST}:${PORT}`);
  console.log(` - Health check: GET  http://localhost:${PORT}/health`);
  console.log(` - Download:     GET  http://localhost:${PORT}/download?size=5`);
  console.log(` - Upload:       POST http://localhost:${PORT}/upload`);
  console.log(`======================================================\n`);
});
