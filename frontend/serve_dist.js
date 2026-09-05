import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const BACKEND_URL = 'http://127.0.0.1:8002';

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

const server = http.createServer((req, res) => {
  const url = req.url;

  // Proxy API requests to backend
  if (
    url.startsWith('/auth') ||
    url.startsWith('/seats') ||
    url.startsWith('/bookings') ||
    url.startsWith('/payments') ||
    url.startsWith('/admin')
  ) {
    const parsedBackendUrl = new URL(BACKEND_URL + url);
    const backendReq = http.request(
      {
        hostname: parsedBackendUrl.hostname,
        port: parsedBackendUrl.port,
        path: parsedBackendUrl.pathname + parsedBackendUrl.search,
        method: req.method,
        headers: {
          ...req.headers,
          host: parsedBackendUrl.host, // set correct backend host header
        },
      },
      (backendRes) => {
        res.writeHead(backendRes.statusCode, backendRes.headers);
        backendRes.pipe(res);
      }
    );

    req.pipe(backendReq);
    backendReq.on('error', (err) => {
      console.error('Proxy Error:', err);
      res.writeHead(502);
      res.end('Bad Gateway');
    });
    return;
  }

  // Serve static files
  let filePath = path.join(__dirname, 'dist', url === '/' ? 'index.html' : url);
  
  // Clean query strings/hash from path
  filePath = filePath.split('?')[0].split('#')[0];

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA router
      filePath = path.join(__dirname, 'dist', 'index.html');
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Production SPA Server running on port ${PORT}`);
});
