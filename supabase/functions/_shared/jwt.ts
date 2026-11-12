// Who is calling. Checked inside the function, without a round trip to GoTrue
// on every move.
//
// Production signs session tokens with an asymmetric key (ES256 today). Those
// are verified against the project's public keys: SUPABASE_JWKS, which the
// platform injects into every function, and the project's
// /auth/v1/.well-known/jwks.json when a token names a key that set does not
// have yet (a rotation). A legacy HS256 token is only verified when a shared
// secret is configured, which is the local stack, never production. Anything
// else falls back to GoTrue's /user, remembered for at most a minute.
//
// A token must be signed, unexpired, issued to `authenticated`, and carry a
// subject. The anon key and the service role key have no subject and do not
// count. A verified token is remembered until it expires, in a bounded map.

import {
  createLocalJWKSet,
  createRemoteJWKSet,
  decodeProtectedHeader,
  jwtVerify,
} from "jsr:@panva/jose@6.2.17";
import type { JWTPayload, JWTVerifyGetKey } from "jsr:@panva/jose@6.2.17";

const ASYMMETRIC = ["ES256", "RS256", "EdDSA"];
const CACHE_MAX = 5_000;
const SKEW_S = 5;
const cache = new Map<string, { id: string; exp: number }>();

let localSet: JWTVerifyGetKey | null | undefined;
let remoteSet: JWTVerifyGetKey | null = null;
let remoteFor = "";

function platformKeys(): JWTVerifyGetKey | null {
  if (localSet !== undefined) return localSet;
  localSet = null;
  const raw = Deno.env.get("SUPABASE_JWKS") || "";
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const jwks = Array.isArray(parsed) ? { keys: parsed } : parsed;
    if (Array.isArray(jwks?.keys) && jwks.keys.length) localSet = createLocalJWKSet(jwks);
  } catch {
    console.error("jwt: SUPABASE_JWKS is not a JWK set");
  }
  return localSet;
}

function projectKeys(url: string): JWTVerifyGetKey | null {
  if (!url) return null;
  if (!remoteSet || remoteFor !== url) {
    const base = url.endsWith("/") ? url : `${url}/`;
    // jose refetches at most every 30 s on an unknown kid and keeps the set
    // for 10 minutes, matching the edge cache in front of the endpoint.
    remoteSet = createRemoteJWKSet(new URL("auth/v1/.well-known/jwks.json", base), {
      cooldownDuration: 30_000,
      cacheMaxAge: 600_000,
    });
    remoteFor = url;
  }
  return remoteSet;
}

function hsSecret() {
  // SUPABASE_* names are reserved for platform secrets on hosted projects, so
  // production never has these. The local CLI and the load-test stack do.
  return Deno.env.get("SUPABASE_JWT_SECRET") || Deno.env.get("JWT_SECRET") || "";
}

function accept(payload: JWTPayload) {
  if (typeof payload.sub !== "string" || !payload.sub) return null;
  if (payload.role !== "authenticated") return null;
  if (typeof payload.exp !== "number") return null;
  return { id: payload.sub, exp: payload.exp * 1000 };
}

async function verifyLocally(token: string, url: string) {
  let alg = "";
  try {
    alg = String(decodeProtectedHeader(token).alg || "");
  } catch {
    return { done: true, user: null };
  }
  const options = { requiredClaims: ["exp", "sub"], clockTolerance: SKEW_S };
  if (ASYMMETRIC.includes(alg)) {
    const sets = [platformKeys(), projectKeys(url)].filter(Boolean) as JWTVerifyGetKey[];
    for (const keys of sets) {
      try {
        const { payload } = await jwtVerify(token, keys, { ...options, algorithms: ASYMMETRIC });
        return { done: true, user: accept(payload) };
      } catch (err) {
        const code = (err as { code?: string })?.code || "";
        // Only a key we do not hold moves on to the next set. A bad signature,
        // an expired token, or a wrong claim is a final no.
        if (code !== "ERR_JWKS_NO_MATCHING_KEY" && code !== "ERR_JWKS_MULTIPLE_MATCHING_KEYS"
          && code !== "ERR_JWKS_TIMEOUT" && code !== "ERR_JWKS_INVALID") {
          return { done: true, user: null };
        }
      }
    }
    return { done: false, user: null };
  }
  if (alg === "HS256") {
    const secret = hsSecret();
    if (!secret) return { done: false, user: null };
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
        ...options,
        algorithms: ["HS256"],
      });
      return { done: true, user: accept(payload) };
    } catch {
      return { done: true, user: null };
    }
  }
  // "none" and anything unexpected.
  return { done: true, user: null };
}

function remember(token: string, entry: { id: string; exp: number }) {
  if (cache.size >= CACHE_MAX) {
    const now = Date.now();
    for (const [key, value] of cache) if (value.exp <= now) cache.delete(key);
    while (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }
  cache.set(token, entry);
}

export async function userIdFromAuth(header: string | null, anonKey: string, url: string) {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token || token.split(".").length !== 3) return null;
  const hit = cache.get(token);
  if (hit) {
    if (hit.exp > Date.now()) return hit.id;
    cache.delete(token);
  }
  const local = await verifyLocally(token, url);
  if (local.done) {
    if (local.user && local.user.exp > Date.now()) {
      remember(token, local.user);
      return local.user.id;
    }
    return null;
  }
  // No key we can check locally: ask GoTrue, and remember the answer briefly.
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.104.1");
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: header } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  let exp = Date.now() + 60_000;
  try {
    const claims = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof claims.exp === "number") exp = Math.min(exp, claims.exp * 1000);
  } catch { /* GoTrue said yes; keep the minute */ }
  remember(token, { id: data.user.id, exp });
  return data.user.id;
}

/** Constant-time string compare for shared secrets. Leaks only the length. */
export function sameSecret(given: string | null, expected: string) {
  if (!expected || typeof given !== "string") return false;
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
