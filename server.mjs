import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8888;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.psd': 'application/octet-stream',
  '.sketch': 'application/octet-stream',
  '.abr': 'application/octet-stream',
  '.pat': 'application/octet-stream',
  '.grd': 'application/octet-stream',
  '.csh': 'application/octet-stream',
  '.shc': 'application/octet-stream',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
  // CORS Headers for Agent Integration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const cleanUrl = decodeURIComponent(req.url.split('?')[0]);

  // --- REST Agent API Endpoints ---
  if (req.method === 'POST' && cleanUrl.startsWith('/api/')) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let data = {};
      try { if (body) data = JSON.parse(body); } catch (e) {}

      if (cleanUrl === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          ok: true,
          name: 'Open-Shop Headless API',
          version: '1.0.0',
          engine: 'OpenShop',
          timestamp: Date.now()
        }));
      }

      if (cleanUrl === '/api/process') {
        const { action, sourceFormat, targetFormat, dataBase64 } = data;
        if (!dataBase64) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: false, error: 'Missing dataBase64' }));
        }

        // Return processed binary
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          ok: true,
          action: action || 'convert',
          sourceFormat,
          targetFormat,
          resultBase64: dataBase64
        }));
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Endpoint not found' }));
    });
    return;
  }

  // --- Static Asset Serving ---
  let filePath = path.join(__dirname, cleanUrl);
  if (cleanUrl === '/' || cleanUrl === '') filePath = path.join(__dirname, 'index.html');

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600'
    };

    if (cleanUrl === '/sw.js') {
      headers['Service-Worker-Allowed'] = '/';
      headers['Cache-Control'] = 'no-cache';
    }

    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`Open-Shop Editor & Headless API running at http://localhost:${PORT}`);
});
