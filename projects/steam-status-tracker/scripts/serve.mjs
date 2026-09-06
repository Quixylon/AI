import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../public/', import.meta.url));
const args = process.argv.slice(2);
const port = Number(process.env.PORT || (args.includes('--port') ? args[args.indexOf('--port') + 1] : 4173));
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg' };
const preview = '<!doctype html><html><head><title>Проверка адаптивности</title><style>body{margin:0;background:#28313b;color:#fff;font:14px system-ui}header{height:48px;display:flex;align-items:center;gap:12px;padding:0 16px}button{padding:7px 14px}iframe{display:block;margin:0 auto;border:0;width:100%;height:1000px}</style></head><body><header><span>Размер страницы</span><button data-width="100%">ПК</button><button data-width="390px">Телефон 390</button><button data-width="320px">Телефон 320</button><button data-width="768px">Планшет 768</button></header><iframe title="Сайт" src="/"></iframe><script>document.querySelectorAll("button").forEach(b=>b.onclick=()=>document.querySelector("iframe").style.width=b.dataset.width)</script></body></html>';
createServer(async (request, response) => {
  try {
    if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
    const route = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (route === '/__preview') { response.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' }); response.end(preview); return; }
    let file = path.resolve(root, '.' + route);
    if (file !== root.slice(0,-1) && !file.startsWith(root)) { response.writeHead(403); response.end(); return; }
    const info = await stat(file);
    if (info.isDirectory()) file = path.join(file, 'index.html');
    const content = await readFile(file);
    response.writeHead(200, { 'Content-Type':types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(port, '0.0.0.0', () => console.log(`Site available on port ${port}`));
