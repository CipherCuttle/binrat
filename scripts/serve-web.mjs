import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', 'web');
const rootPrefix = `${root}${sep}`;
const port = Number(process.env.PORT ?? 4173);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

createServer((request, response) => {
  let pathname;
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    pathname = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }).end('bad request');
    return;
  }

  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^[/\\]+/, '');
  const safe = normalize(requested);
  const file = join(root, safe);

  if (file !== root && !file.startsWith(rootPrefix)) {
    response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' }).end('forbidden');
    return;
  }

  try {
    if (!statSync(file).isFile()) throw new Error('not file');
    response.writeHead(200, {
      'content-type': types[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store'
    });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`BINRAT fixture shell: http://localhost:${port}`);
});
