/**
 * Card-art monitor: a local dashboard for watching generation runs.
 *
 *   npm run art:monitor            # serves http://127.0.0.1:8877
 *   npm run art:generate -- --monitor   # same dashboard, inline with a run
 *
 * Shows a live list of what's generating (both the Fooocus/A1111 runner and
 * the python diffusers runner report progress to a shared status file) plus
 * a clickable gallery of every finished file in public/cards — click any
 * card to open the full-size image.
 *
 * Env: ART_MONITOR_PORT (default 8877), ART_DIR (default public/cards)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

export const STATUS_PATH = path.join(os.tmpdir(), 'card-art-status.json');

const readStatus = () => {
  try {
    return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
  } catch {
    return null;
  }
};

const listFiles = (dir) => {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => /^\d+\.webp$/.test(f))
      .map((f) => {
        const st = fs.statSync(path.join(dir, f));
        return { id: Number(f.replace('.webp', '')), file: f, kb: +(st.size / 1024).toFixed(1), mtime: st.mtimeMs };
      })
      .sort((a, b) => a.id - b.id);
  } catch {
    return [];
  }
};

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Card Art Monitor 🧸</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; margin: 0; }
  body { font: 14px/1.5 system-ui, sans-serif; background: linear-gradient(#1a1226, #120c1c); color: #ece6f2; min-height: 100vh; padding: 24px; }
  h1 { font-size: 22px; background: linear-gradient(90deg, #fde68a, #f59e0b); -webkit-background-clip: text; background-clip: text; color: transparent; margin-bottom: 4px; }
  .sub { color: #9b8ab3; font-size: 12px; margin-bottom: 16px; }
  .chips { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
  .chip { background: #241a3599; border: 1px solid #52436866; border-radius: 10px; padding: 6px 12px; font-weight: 600; }
  .chip b { color: #fbbf24; }
  .bar { height: 8px; background: #120c1c; border-radius: 99px; overflow: hidden; margin-bottom: 20px; border: 1px solid #52436844; }
  .bar > div { height: 100%; background: linear-gradient(90deg, #d97706, #fbbf24); width: 0%; transition: width .6s; }
  .cur { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; color: #fde68a; font-weight: 600; }
  .dot { width: 10px; height: 10px; border-radius: 99px; background: #fbbf24; animation: pulse 1s infinite alternate; }
  @keyframes pulse { from { opacity: .3 } to { opacity: 1 } }
  .cols { display: grid; grid-template-columns: minmax(280px, 380px) 1fr; gap: 24px; align-items: start; }
  @media (max-width: 760px) { .cols { grid-template-columns: 1fr; } }
  ul { list-style: none; }
  li { display: flex; gap: 8px; align-items: center; padding: 4px 8px; border-radius: 8px; }
  li:nth-child(odd) { background: #241a3555; }
  li .meta { margin-left: auto; color: #9b8ab3; font-size: 12px; white-space: nowrap; }
  li a { color: #ece6f2; text-decoration: none; }
  li a:hover { color: #fbbf24; text-decoration: underline; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 10px; }
  .grid a { display: block; border: 2px solid #524368; border-radius: 10px; overflow: hidden; background: #241a35; transition: transform .15s, border-color .15s; }
  .grid a:hover { transform: scale(1.05); border-color: #fbbf24; }
  .grid img { width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block; }
  .grid .cap { font-size: 10px; text-align: center; padding: 2px 4px; color: #b6a8ca; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  h2 { font-size: 14px; color: #b6a8ca; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 8px; }
  .empty { color: #9b8ab3; font-style: italic; padding: 12px 0; }
</style></head><body>
<h1>🧸 Card Art Monitor</h1>
<div class="sub">watching <code id="dir"></code> — refreshes every 1.5s</div>
<div class="chips">
  <div class="chip">files on disk <b id="c-files">0</b></div>
  <div class="chip">run done <b id="c-done">–</b></div>
  <div class="chip">failed <b id="c-failed">–</b></div>
  <div class="chip" id="c-state">idle</div>
</div>
<div class="bar"><div id="bar"></div></div>
<div class="cur" id="cur" hidden><span class="dot"></span><span id="cur-name"></span></div>
<div class="cols">
  <section>
    <h2>Generation queue</h2>
    <ul id="list"><li class="empty">No active run. Start one with <code>npm run art:generate</code>.</li></ul>
  </section>
  <section>
    <h2>Finished files (click to open)</h2>
    <div class="grid" id="grid"></div>
    <div class="empty" id="grid-empty" hidden>Nothing generated yet.</div>
  </section>
</div>
<script>
const ICONS = { pending: '⏳', generating: '🎨', done: '✅', failed: '❌' };
async function tick() {
  try {
    const s = await (await fetch('/status.json')).json();
    document.getElementById('dir').textContent = s.dir;
    document.getElementById('c-files').textContent = s.files.length;
    const run = s.run;
    const items = run?.items ?? [];
    const done = items.filter(i => i.state === 'done').length;
    const failed = items.filter(i => i.state === 'failed').length;
    document.getElementById('c-done').textContent = run ? done + '/' + items.length : '–';
    document.getElementById('c-failed').textContent = run ? failed : '–';
    document.getElementById('c-state').textContent = run?.finishedAt ? 'run finished' : run ? 'generating…' : 'idle';
    document.getElementById('bar').style.width = items.length ? (100 * (done + failed) / items.length) + '%' : '0%';
    const cur = items.find(i => i.state === 'generating');
    document.getElementById('cur').hidden = !cur;
    if (cur) document.getElementById('cur-name').textContent = '#' + cur.id + ' ' + cur.name;
    const list = document.getElementById('list');
    if (items.length) {
      list.innerHTML = items.map(i => {
        const label = '#' + i.id + ' ' + i.name;
        const link = i.state === 'done' ? '<a href="/files/' + i.id + '.webp" target="_blank">' + label + '</a>' : label;
        const meta = [i.kb && i.kb + ' KB', i.ms && (i.ms / 1000).toFixed(0) + 's'].filter(Boolean).join(' · ');
        return '<li><span>' + (ICONS[i.state] ?? '·') + '</span><span>' + link + '</span><span class="meta">' + meta + '</span></li>';
      }).join('');
    }
    const names = Object.fromEntries(items.map(i => [i.id, i.name]));
    const grid = document.getElementById('grid');
    document.getElementById('grid-empty').hidden = s.files.length > 0;
    grid.innerHTML = s.files.map(f =>
      '<a href="/files/' + f.file + '" target="_blank" title="#' + f.id + '">' +
      '<img loading="lazy" src="/files/' + f.file + '?v=' + f.mtime + '" alt="card ' + f.id + '">' +
      '<div class="cap">#' + f.id + (names[f.id] ? ' ' + names[f.id] : '') + '</div></a>'
    ).join('');
  } catch { /* server restarting — keep polling */ }
}
tick();
setInterval(tick, 1500);
</script></body></html>`;

export function startMonitor({ dir, port = Number(process.env.ART_MONITOR_PORT ?? 8877) } = {}) {
  const absDir = path.resolve(dir ?? process.env.ART_DIR ?? 'public/cards');
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(PAGE);
    }
    if (url.pathname === '/status.json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(JSON.stringify({ dir: absDir, run: readStatus(), files: listFiles(absDir) }));
    }
    if (url.pathname.startsWith('/files/')) {
      const name = path.basename(url.pathname); // no traversal
      const file = path.join(absDir, name);
      if (/^[\w.-]+\.(webp|png|jpg)$/.test(name) && fs.existsSync(file)) {
        res.setHeader('Content-Type', name.endsWith('.webp') ? 'image/webp' : 'image/png');
        return fs.createReadStream(file).pipe(res);
      }
    }
    res.statusCode = 404;
    res.end('not found');
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      console.log(`🧸 art monitor: http://127.0.0.1:${port}  (watching ${absDir})`);
      resolve(server);
    });
  });
}

// Progress reporting shared by the generator runners.
export function statusWriter(items) {
  const state = {
    startedAt: Date.now(),
    finishedAt: null,
    items: items.map((c) => ({ id: c.id, name: c.name, state: 'pending', kb: null, ms: null })),
  };
  const flush = () => fs.writeFileSync(STATUS_PATH, JSON.stringify(state));
  flush();
  return {
    generating(id) {
      const it = state.items.find((i) => i.id === id);
      if (it) it.state = 'generating';
      flush();
    },
    done(id, kb, ms) {
      const it = state.items.find((i) => i.id === id);
      if (it) Object.assign(it, { state: 'done', kb, ms });
      flush();
    },
    failed(id) {
      const it = state.items.find((i) => i.id === id);
      if (it) it.state = 'failed';
      flush();
    },
    finish() {
      state.finishedAt = Date.now();
      flush();
    },
  };
}

// CLI entry: keep serving until Ctrl-C.
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const argOf = (f) => {
    const i = process.argv.indexOf(f);
    return i >= 0 ? process.argv[i + 1] : null;
  };
  startMonitor({ dir: argOf('--dir'), port: argOf('--port') ? Number(argOf('--port')) : undefined });
}
