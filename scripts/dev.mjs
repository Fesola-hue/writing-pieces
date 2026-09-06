import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './content.mjs';

const portArg = process.argv.find((arg) => arg.startsWith('--port='));
const hostArg = process.argv.find((arg) => arg.startsWith('--host='));
const port = Number(portArg?.split('=')[1] || process.env.PORT || 4173);
const host = hostArg?.split('=')[1] || process.env.PREVIEW_HOST || '127.0.0.1';
const dist = path.join(ROOT, 'dist');

const build = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build.mjs')], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status || 1);

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((request, response) => {
  const urlPath = decodeURIComponent(new URL(request.url, `http://${host}:${port}`).pathname);
  let filePath = path.resolve(dist, `.${urlPath}`);
  if (!filePath.startsWith(dist)) { response.writeHead(403).end('Forbidden'); return; }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
  if (!fs.existsSync(filePath)) { response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found'); return; }
  response.writeHead(200, { 'content-type': mime[path.extname(filePath)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(filePath).pipe(response);
});
server.listen(port, host, () => console.log(`Writing preview ready at http://${host}:${port}`));
