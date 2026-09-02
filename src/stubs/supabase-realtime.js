// Build-time stand-in for @supabase/realtime-js.
//
// supabase-js imports RealtimeClient at module top level and constructs it in
// the SupabaseClient constructor, so the whole websocket/presence engine ships
// in the entry chunk whether or not you use it. This app never opens a channel
// — its only `unsubscribe()` calls are on the AUTH state listener — so that was
// dead weight on every player's first paint. Aliased away in vite.config.js;
// see src/stubs/supabase-stubs.test.js, which fails if supabase-js ever starts
// importing something these stubs do not provide.
//
// Constructing must stay silent (supabase-js does it eagerly), so only the
// methods throw — and they throw loudly rather than no-op, because silently
// swallowing a channel subscription would be far worse than a clear error.
const unsupported = (method) => {
  throw new Error(
    `Supabase Realtime is not bundled in this app (RealtimeClient.${method}). ` +
      `It is aliased to a stub in vite.config.js to keep ~85 kB of unused ` +
      `websocket code out of the entry chunk. If you now need Realtime, remove ` +
      `that alias and the guard in src/stubs/supabase-stubs.test.js.`
  );
};

export class RealtimeClient {
  constructor() {}

  // Called by supabase-js's _handleTokenChanged on every auth change, so this
  // one sits on a live code path and must be a silent no-op, not a throw.
  setAuth() {}

  getChannels() { return []; }
  removeChannel() { return Promise.resolve('ok'); }
  removeAllChannels() { return Promise.resolve([]); }
  channel() { return unsupported('channel'); }
  connect() {}
  disconnect() {}
}

export default { RealtimeClient };
