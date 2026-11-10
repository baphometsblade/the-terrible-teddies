/* Terrible Teddies shell.
   Installability wants a fetch handler. This one is network-first for
   navigations and does not cache scripts, styles or images: a cached bundle
   after a deploy is a stale game. Nothing else is intercepted, so an image
   or a chunk loads exactly as it would with no worker. */
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

var OFFLINE = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width, initial-scale=1">'
  + '<title>Terrible Teddies</title>'
  + '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#100e0c;color:#f7f1e8;font-family:system-ui,sans-serif;text-align:center;padding:24px}'
  + 'h1{font-size:1.4rem;margin:0 0 8px}p{color:#cbb59a;margin:0 0 16px}'
  + 'a{display:inline-block;font-weight:700;background:#fbbf24;color:#100e0c;text-decoration:none;border-radius:12px;padding:12px 20px;min-height:44px;line-height:20px}</style>'
  + '</head><body><div><h1>Could not reach the bar</h1>'
  + '<p>Check your connection, then reload.</p>'
  + '<a href="/">Reload</a></div></body></html>';

self.addEventListener('fetch', function (event) {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(function () {
    return new Response(OFFLINE, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }));
});
