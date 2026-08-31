import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fs.realpathSync(path.dirname(fileURLToPath(import.meta.url)));
const PORT = process.env.PORT || 8888;
const HOST = process.env.HOST || '127.0.0.1';
const MAX_API_BODY_BYTES = 10 * 1024 * 1024;

const noStoreExtensions = new Set(['.html', '.js', '.mjs', '.css', '.json']);

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

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(message);
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function isWithinRoot(candidatePath) {
  const relativePath = path.relative(__dirname, candidatePath);
  return relativePath === '' || (
    relativePath !== '..' &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}

function hasDotfileSegment(urlPath) {
  return urlPath.split(/[\\/]+/).some(segment => segment.startsWith('.'));
}

function resolveStaticFile(cleanUrl) {
  if (cleanUrl.includes('\0') || hasDotfileSegment(cleanUrl)) {
    return { error: 403 };
  }

  const relativeUrl = cleanUrl.replace(/^[\\/]+/, '') || 'index.html';
  const candidatePath = path.resolve(__dirname, relativeUrl);
  if (!isWithinRoot(candidatePath)) return { error: 403 };

  let realPath;
  try {
    realPath = fs.realpathSync(candidatePath);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return { error: 404 };
    throw error;
  }

  if (!isWithinRoot(realPath)) return { error: 403 };

  const stats = fs.statSync(realPath);
  if (!stats.isFile()) return { error: 404 };
  return { filePath: realPath };
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  let cleanUrl;
  try {
    cleanUrl = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    return sendText(res, 400, '400 Bad Request');
  }

  // --- REST Agent API Endpoints ---
  if (req.method === 'POST' && cleanUrl.startsWith('/api/')) {
    const contentLength = Number(req.headers['content-length']);
    if (Number.isFinite(contentLength) && contentLength > MAX_API_BODY_BYTES) {
      res.setHeader('Connection', 'close');
      sendJson(res, 413, { ok: false, error: 'Request body too large' });
      return req.destroy();
    }

    let bodyBytes = 0;
    const chunks = [];
    let rejected = false;

    req.on('data', chunk => {
      if (rejected) return;
      bodyBytes += chunk.length;
      if (bodyBytes > MAX_API_BODY_BYTES) {
        rejected = true;
        res.setHeader('Connection', 'close');
        sendJson(res, 413, { ok: false, error: 'Request body too large' });
        return req.destroy();
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (rejected) return;

      const body = Buffer.concat(chunks).toString('utf8');
      let data = {};
      try {
        if (body) data = JSON.parse(body);
      } catch {
        return sendJson(res, 400, { ok: false, error: 'Invalid JSON body' });
      }

      if (cleanUrl === '/api/status') {
        return sendJson(res, 200, {
          ok: true,
          name: 'Open-Shop Headless API',
          version: '1.0.0',
          engine: 'OpenShop',
          timestamp: Date.now()
        });
      }

      if (cleanUrl === '/api/process') {
        const { dataBase64 } = data;
        if (!dataBase64) {
          return sendJson(res, 400, { ok: false, error: 'Missing dataBase64' });
        }

        return sendJson(res, 501, {
          ok: false,
          error: 'Headless file conversion is not implemented. Use the browser editor to export the document.'
        });
      }

      sendJson(res, 404, { ok: false, error: 'Endpoint not found' });
    });
    return;
  }

  // --- Static Asset Serving ---
  let resolved;
  try {
    resolved = resolveStaticFile(cleanUrl);
  } catch {
    return sendText(res, 500, '500 Internal Server Error');
  }

  if (resolved.error) {
    return sendText(
      res,
      resolved.error,
      resolved.error === 403 ? '403 Forbidden' : '404 Not Found'
    );
  }

  const ext = path.extname(resolved.filePath).toLowerCase();
  const headers = {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    'Cache-Control': noStoreExtensions.has(ext) ? 'no-store' : 'public, max-age=3600'
  };

  if (cleanUrl === '/sw.js') {
    headers['Service-Worker-Allowed'] = '/';
    headers['Cache-Control'] = 'no-cache';
  }

  res.writeHead(200, headers);
  fs.createReadStream(resolved.filePath).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`Open-Shop Editor & Headless API running at http://${HOST}:${PORT}`);
});
