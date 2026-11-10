// The gateway already checks the signature when verify_jwt is on. This
// checks it again inside the function so a local gateway that does not, and
// a burst of moves, do not each call GoTrue. A verified token is remembered
// until it expires. The anon key has no subject and does not count.

const cache = new Map<string, { id: string; exp: number }>();

function bytes(part: string) {
  const pad = part.length % 4 === 0 ? "" : "=".repeat(4 - (part.length % 4));
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function subject(token: string, secret: string) {
  const [header, payload, sig] = token.split(".");
  if (!header || !payload || !sig) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    bytes(sig),
    new TextEncoder().encode(`${header}.${payload}`),
  );
  if (!ok) return null;
  const body = JSON.parse(new TextDecoder().decode(bytes(payload)));
  if (!body?.sub || body.role !== "authenticated") return null;
  if (body.exp && body.exp * 1000 < Date.now()) return null;
  return { id: String(body.sub), exp: body.exp ? body.exp * 1000 : Date.now() + 60_000 };
}

export async function userIdFromAuth(header: string | null, anonKey: string, url: string) {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  const hit = cache.get(token);
  if (hit && hit.exp > Date.now() + 5_000) return hit.id;
  const secret = Deno.env.get("SUPABASE_JWT_SECRET") || Deno.env.get("JWT_SECRET") || "";
  if (secret) {
    const verified = await subject(token, secret);
    if (verified) {
      cache.set(token, verified);
      return verified.id;
    }
    return null;
  }
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.104.1");
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: header } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  cache.set(token, { id: data.user.id, exp: Date.now() + 60_000 });
  return data.user.id;
}
