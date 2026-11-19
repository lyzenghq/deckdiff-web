// SPDX-License-Identifier: GPL-2.0-only
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, extname} from 'node:path';
import {CardService} from './lib/cards.mjs';

const root = fileURLToPath(new URL('./public/', import.meta.url));
export function createApp({cards = new CardService()} = {}) {
  const files = new Set(['index.html', 'styles.css', 'app.mjs', 'decks.mjs', 'clipboard.mjs', 'card-loader.mjs', 'i18n.mjs', 'favicon.svg', 'LICENSE']);
  const types = {'.html': 'text/html', '.css': 'text/css', '.mjs': 'text/javascript', '.svg': 'image/svg+xml'};
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' https:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
    const json = (status, value) => { res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(value)); };
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(405, {error: '只支持 GET 请求。'});
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/health') return json(200, {ok: true, provider: cards.provider});
      if (url.pathname === '/api/cards') {
        const raw = url.searchParams.get('ids') || '';
        const locale = url.searchParams.get('locale') || 'zh_CN';
        const refresh = url.searchParams.get('refresh') || '0';
        if (!['0','1'].includes(refresh)) return json(400, {error: '刷新参数无效。'});
        if (!/^\d+(,\d+)*$/.test(raw) || !['zh_CN', 'en_US'].includes(locale) || raw.split(',').length > 200) return json(400, {error: '卡牌 ID 或语言参数无效。'});
        const ids = raw.split(',').map(Number);
        if (ids.some(id => !Number.isSafeInteger(id) || id < 1 || id > 0x7fffffff)) return json(400, {error: '卡牌 ID 超出范围。'});
        try { return json(200, await cards.load(ids, locale, {refresh: refresh === '1'})); }
        catch (error) {
          const timeout = error.name === 'TimeoutError' || [408,504].includes(error.status) || /TIMEOUT|TIMEDOUT/.test(error.cause?.code || error.code || '');
          const code = error.code === 'API_CONFIGURATION' ? 'API_CONFIGURATION' : timeout ? 'API_TIMEOUT' : 'API_UNAVAILABLE';
          console.error('[official cards]', error.message, error.cause?.code || '');
          return json(timeout ? 504 : 502, {code});
        }
      }
      const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (!files.has(name)) return json(404, {error: '页面不存在。'});
      const body = await readFile(name === 'LICENSE' ? new URL('./LICENSE', import.meta.url) : resolve(root, name));
      const contentType = name === 'LICENSE' ? 'text/plain' : types[extname(name)];
      res.writeHead(200, {'Content-Type': `${contentType}; charset=utf-8`, 'Cache-Control': 'no-cache'});
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { json(500, {error: '服务器无法处理请求。'}); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3210), host = process.env.HOST || '127.0.0.1';
  const app = createApp();
  app.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已被占用。请设置其他 PORT。` : error.message); process.exitCode = 1; });
  app.listen(port, host, () => console.log(`DeckDIFF Web ready: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`));
}
