// Account linking. Discord is the login that can suggest pals. X is a handle
// and a share link. Neither call reads a follower list.
//
// Buttons stay hidden until GET /auth/v1/settings says the provider is on.
// Manual linking is a dashboard switch; when it is off, linkIdentity fails
// and the screen says so without pretending the click worked.

import { supabase, supabaseAnonKey, supabaseUrl } from '../supabase.js';
import {
  DISCORD_PROVIDER, DISCORD_SCOPES, PENDING_LINK_KEY, X_PROVIDER, X_SCOPES,
  enabledPlatforms, guildIdsFromPayload, setPresenceHidden,
} from './friends.js';

export const LINK_SPEC = Object.freeze({
  discord: Object.freeze({ provider: DISCORD_PROVIDER, scopes: DISCORD_SCOPES }),
  x: Object.freeze({ provider: X_PROVIDER, scopes: X_SCOPES }),
});

const plainLinkError = (error) => {
  const msg = String(error?.message || error?.msg || '');
  if (/manual linking/i.test(msg)) return 'Linking is not switched on for this bar yet.';
  return 'The bar could not open that login.';
};

export const loadAuthProviders = async (fetchImpl = fetch) => {
  try {
    const res = await fetchImpl(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseAnonKey },
    });
    if (!res.ok) return enabledPlatforms(null);
    return enabledPlatforms(await res.json());
  } catch {
    return enabledPlatforms(null);
  }
};

const identitiesOf = (data) => {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.identities)) return data.identities;
  return [];
};

export const linkedFlags = (data) => {
  const list = identitiesOf(data);
  return {
    discord: list.some((row) => row && row.provider === DISCORD_PROVIDER),
    x: list.some((row) => row && (row.provider === X_PROVIDER || row.provider === 'x')),
  };
};

/**
 * Start a link. The browser is sent only after GoTrue returns a URL, and
 * only if `assign` is the real navigation. Tests pass a stand-in.
 */
export async function linkPlatform(platform, { auth = supabase.auth, assign, storage } = {}) {
  const spec = LINK_SPEC[platform];
  if (!spec) return { ok: false, reason: 'missing' };
  const store = storage || (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
  try { store?.setItem(PENDING_LINK_KEY, platform); } catch { /* private mode */ }
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const { data, error } = await auth.linkIdentity({
    provider: spec.provider,
    options: {
      scopes: spec.scopes,
      redirectTo: origin ? `${origin}/?link=${platform}` : undefined,
      skipBrowserRedirect: true,
    },
  });
  if (error || !data?.url) {
    try { store?.removeItem(PENDING_LINK_KEY); } catch { /* ignore */ }
    return { ok: false, reason: 'link', message: plainLinkError(error) };
  }
  const go = assign || ((url) => window.location.assign(url));
  go(data.url);
  return { ok: true, url: data.url };
}

export async function unlinkPlatform(platform, { auth = supabase.auth } = {}) {
  const spec = LINK_SPEC[platform];
  if (!spec) return { ok: false, reason: 'missing' };
  const { data, error } = await auth.getUserIdentities();
  if (error) return { ok: false, reason: 'link', message: 'The bar could not read that login.' };
  const identity = identitiesOf(data).find((row) => (
    row && (row.provider === spec.provider || (platform === 'x' && row.provider === 'x'))
  ));
  if (!identity) return { ok: false, reason: 'missing' };
  const dropped = await auth.unlinkIdentity(identity);
  if (dropped?.error) {
    const msg = String(dropped.error.message || '');
    if (/at least 2|last identity|single identity/i.test(msg)) {
      return { ok: false, reason: 'last', message: 'That login is how you get in. Add another before you drop it.' };
    }
    return { ok: false, reason: 'link', message: 'The bar could not drop that login.' };
  }
  await syncLinks();
  return { ok: true };
}

export const syncLinks = () => supabase.rpc('sync_links').then(({ data, error }) => {
  if (error) return { ok: false, reason: 'unavailable' };
  return data && typeof data === 'object' ? data : { ok: false, reason: 'unavailable' };
});

export async function fetchDiscordGuildIds(token, fetchImpl = fetch) {
  if (!token) return [];
  try {
    const res = await fetchImpl('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    return guildIdsFromPayload(await res.json());
  } catch {
    return [];
  }
}

/** Hash the guild list on the server. The ids are not kept here. */
export async function syncDiscordGuilds(token, fetchImpl = fetch) {
  const ids = await fetchDiscordGuildIds(token, fetchImpl);
  const { data, error } = await supabase.rpc('remember_guilds', { p_guild_ids: ids });
  if (error) return { ok: false, reason: 'unavailable' };
  return data && typeof data === 'object' ? data : { ok: false, reason: 'unavailable' };
}

export async function loadMyLinks() {
  const { data, error } = await supabase.rpc('my_links');
  if (error || !data || typeof data !== 'object') return { ok: false, reason: 'unavailable' };
  if (data.ok) setPresenceHidden(Boolean(data.appear_offline));
  return data;
}
