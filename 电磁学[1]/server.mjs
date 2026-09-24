import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const projects = new Set(['电磁学[1]', '电磁学[2]', '光学', '近代物理学']);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/') {
      response.writeHead(302, { Location: encodeURI('/电磁学[1]/index.html') }).end();
      return;
    }
    if (pathname === '/site.css') {
      const data = await readFile(resolve(root, 'site.css'));
      response.writeHead(200, { 'Content-Type': types['.css'] }).end(data);
      return;
    }
    const segments = pathname.split('/').filter(Boolean);
    if (!projects.has(segments[0])) {
      response.writeHead(404).end('Not found');
      return;
    }
    if (segments.length === 1 && !pathname.endsWith('/')) {
      response.writeHead(302, { Location: encodeURI(`${pathname}/`) }).end();
      return;
    }
    const file = resolve(root, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
    if (!file.startsWith(root + sep) || !types[extname(file)]) {
      response.writeHead(403).end();
      return;
    }
    const data = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    response.end(data);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(4173, '127.0.0.1', () => {
  console.log('大学物理交互模型：http://localhost:4173');
});
