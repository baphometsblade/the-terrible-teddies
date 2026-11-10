// Local stand-in for Kong. Docker on this VM has no iptables, so the CLI's
// bridge DNS does not resolve. PostgREST, GoTrue, Realtime and this proxy all
// listen on the host. The functions are the same source the edge runtime runs.
import http from 'node:http';
import { request as httpRequest } from 'node:http';

const routes = [
  ['/rest/v1', 3000],
  ['/auth/v1', 9999],
  ['/realtime/v1', 4000],
  ['/functions/v1', 8000],
];

function targetFor(url) {
  const match = routes.find(([prefix]) => url.startsWith(prefix));
  if (!match) return null;
  const [prefix, port] = match;
  let path = url.slice(prefix.length) || '/';
  const headers = { host: `127.0.0.1:${port}` };
  if (prefix === '/realtime/v1') {
    path = `/socket${path}`;
    // Realtime picks the tenant from the Host label. Host networking has no
    // container DNS name, so the seeded tenant is named here.
    headers.host = 'realtime-dev.supabase-realtime';
  }
  return { port, path, headers };
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  const target = targetFor(url);
  if (!target) {
    res.writeHead(404);
    res.end('no route');
    return;
  }
  const { port, path } = target;
  const headers = { ...req.headers, ...target.headers };
  const proxied = httpRequest({ host: '127.0.0.1', port, path, method: req.method, headers }, (upstream) => {
    res.writeHead(upstream.statusCode || 502, upstream.headers);
    upstream.pipe(res);
  });
  proxied.on('error', () => {
    res.writeHead(502);
    res.end('upstream down');
  });
  req.pipe(proxied);
});

server.on('upgrade', (req, socket, head) => {
  const url = req.url || '/';
  const target = targetFor(url);
  if (!target) {
    socket.destroy();
    return;
  }
  const { port, path } = target;
  const proxied = httpRequest({
    host: '127.0.0.1', port, path, method: req.method, headers: { ...req.headers, ...target.headers },
  });
  proxied.on('upgrade', (upstream, upstreamSocket, upstreamHead) => {
    socket.write(`HTTP/1.1 ${upstream.statusCode} ${upstream.statusMessage}\r\n`);
    for (const [key, value] of Object.entries(upstream.headers)) {
      const values = Array.isArray(value) ? value : [value];
      for (const item of values) if (item) socket.write(`${key}: ${item}\r\n`);
    }
    socket.write('\r\n');
    if (upstreamHead.length) socket.write(upstreamHead);
    if (head.length) upstreamSocket.write(head);
    upstreamSocket.pipe(socket);
    socket.pipe(upstreamSocket);
  });
  proxied.on('error', () => socket.destroy());
  proxied.end();
});

server.listen(54321, '127.0.0.1', () => {
  console.log('gateway on 127.0.0.1:54321');
});
