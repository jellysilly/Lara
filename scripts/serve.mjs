#!/usr/bin/env node
/**
 * Zero-dependency static server for the built app.
 *
 * Exists so Lara can be served anywhere Node runs — including Termux on a
 * phone, where installing a server package on demand is not a given.
 *
 *   node scripts/serve.mjs            → http://localhost:8080
 *   PORT=3000 HOST=0.0.0.0 node …     → reachable from the local network
 */

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const port = Number(process.env.PORT) || 8080;
const host = process.env.HOST || '127.0.0.1';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

if (!existsSync(join(root, 'index.html'))) {
  console.error('No build found in dist/.\nRun "npm run build" first.');
  process.exit(1);
}

/** Resolves a URL path inside dist/, refusing anything that escapes it. */
function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const candidate = resolve(join(root, normalize(decoded)));
  if (candidate !== root && !candidate.startsWith(root + sep)) return null;

  if (existsSync(candidate)) {
    const stats = statSync(candidate);
    if (stats.isFile()) return candidate;
    const index = join(candidate, 'index.html');
    if (existsSync(index)) return index;
  }
  // Single-page app: unknown paths fall back to the shell.
  return join(root, 'index.html');
}

const server = createServer((request, response) => {
  const file = resolveFile(request.url || '/');
  if (!file) {
    response.writeHead(403, { 'Content-Type': 'text/plain' }).end('Forbidden');
    return;
  }

  const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
  const immutable = file.includes(`${sep}assets${sep}`) && !file.endsWith('index.html');

  response.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  createReadStream(file)
    .on('error', () => response.destroy())
    .pipe(response);
});

server.listen(port, host, () => {
  console.log(`\n  Lara is serving dist/ on:\n`);
  console.log(`    http://localhost:${port}`);

  if (host === '0.0.0.0' || host === '::') {
    for (const addresses of Object.values(networkInterfaces())) {
      for (const address of addresses ?? []) {
        if (address.family === 'IPv4' && !address.internal) {
          console.log(`    http://${address.address}:${port}   (this network)`);
        }
      }
    }
  } else {
    console.log(`\n  Set HOST=0.0.0.0 to reach it from other devices on your network.`);
  }

  console.log('\n  Ctrl+C to stop.\n');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
