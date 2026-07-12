const http = require('http');
const fs = require('fs');
const path = require('path');
const { loadPlatformConfig } = require('../config/load-platform-config');

const rootDir = __dirname;
const platformConfig = loadPlatformConfig({ override: false }).config;
const configuredPortalUrl = new URL(platformConfig.ADMIN_PORTAL_URL);
const defaultPort = configuredPortalUrl.port || (configuredPortalUrl.protocol === 'https:' ? '443' : '80');
const port = Number.parseInt(process.env.PORT || defaultPort, 10);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': contentTypes[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);

  if (pathname === '/config.js') {
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(`window.MYFIXER_ADMIN_CONFIG = ${JSON.stringify({
      API_BASE_URL: platformConfig.API_BASE_URL,
      SOCKET_URL: platformConfig.SOCKET_URL,
      ADMIN_PORTAL_URL: platformConfig.ADMIN_PORTAL_URL,
      APP_ENV: platformConfig.APP_ENV,
    })};`);
    return;
  }

  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(rootDir, requestedPath));

  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  sendFile(res, filePath);
});

server.listen(port, () => {
  console.log(`MyFixer admin portal running at http://localhost:${port}`);
});
