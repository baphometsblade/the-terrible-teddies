// cd supabase/functions/_shared && deno test --no-check --allow-env --allow-net --no-lock jwt_test.ts
// Not part of vitest (no Deno in CI). Run before deploying jwt.ts.
import { assertEquals } from "jsr:@std/assert@1";
import { exportJWK, generateKeyPair, SignJWT } from "jsr:@panva/jose@6.2.17";
import { sameSecret, userIdFromAuth } from "./jwt.ts";

const platform = await generateKeyPair("ES256", { extractable: true });
const rotated = await generateKeyPair("ES256", { extractable: true });
const stranger = await generateKeyPair("ES256", { extractable: true });
const pub = async (key: CryptoKey, kid: string) => ({ ...(await exportJWK(key)), kid, alg: "ES256", use: "sig" });

Deno.env.set("SUPABASE_JWKS", JSON.stringify({ keys: [await pub(platform.publicKey, "k1")] }));
Deno.env.set("JWT_SECRET", "local-only-secret-local-only-secret!!");

// The project's JWKS endpoint, holding a key SUPABASE_JWKS has not caught up with.
const jwks = { keys: [await pub(platform.publicKey, "k1"), await pub(rotated.publicKey, "k2")] };
const server = Deno.serve({ port: 0, onListen: () => {} }, (req) =>
  new URL(req.url).pathname === "/auth/v1/.well-known/jwks.json"
    ? Response.json(jwks)
    : new Response("no", { status: 404 }));
const url = `http://127.0.0.1:${server.addr.port}`;

const now = () => Math.floor(Date.now() / 1000);
const claims = (over: Record<string, unknown> = {}) => ({
  sub: crypto.randomUUID(), role: "authenticated", aud: "authenticated", ...over,
});
async function es(key: CryptoKey, kid: string, body: Record<string, unknown>, exp: number | null = now() + 600) {
  let jwt = new SignJWT(body).setProtectedHeader({ alg: "ES256", kid, typ: "JWT" }).setIssuedAt();
  if (exp !== null) jwt = jwt.setExpirationTime(exp);
  return await jwt.sign(key);
}
async function hs(secret: string, body: Record<string, unknown>) {
  return await new SignJWT(body).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuedAt()
    .setExpirationTime(now() + 600).sign(new TextEncoder().encode(secret));
}
const call = (token: string) => userIdFromAuth(`Bearer ${token}`, "anon", url);

Deno.test("accepts an ES256 session token signed by the platform key", async () => {
  const body = claims();
  assertEquals(await call(await es(platform.privateKey, "k1", body)), body.sub);
});

Deno.test("fetches the project JWKS for a rotated kid", async () => {
  const body = claims();
  assertEquals(await call(await es(rotated.privateKey, "k2", body)), body.sub);
});

Deno.test("refuses a forged signature under a known kid", async () => {
  assertEquals(await call(await es(stranger.privateKey, "k1", claims())), null);
});

Deno.test("refuses expired, exp-less, anon and subject-less tokens", async () => {
  assertEquals(await call(await es(platform.privateKey, "k1", claims(), now() - 2)), null);
  assertEquals(await call(await es(platform.privateKey, "k1", claims(), null)), null);
  assertEquals(await call(await es(platform.privateKey, "k1", claims({ role: "anon" }))), null);
  assertEquals(await call(await es(platform.privateKey, "k1", { role: "authenticated" })), null);
});

Deno.test("refuses alg none and junk", async () => {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const none = `${b64({ alg: "none", typ: "JWT" })}.${b64({ ...claims(), exp: now() + 600 })}.`;
  assertEquals(await call(none), null);
  assertEquals(await call(`${none}x`), null);
  assertEquals(await call("not-a-token"), null);
  assertEquals(await userIdFromAuth(null, "anon", url), null);
  assertEquals(await userIdFromAuth("Basic abc", "anon", url), null);
});

Deno.test("HS256 only with the configured secret", async () => {
  const body = claims();
  assertEquals(await call(await hs("local-only-secret-local-only-secret!!", body)), body.sub);
  assertEquals(await call(await hs("some-other-secret-some-other-secret", claims())), null);
});

Deno.test("a cached token stops counting when it expires", async () => {
  const body = claims();
  const token = await es(platform.privateKey, "k1", body, now() + 2);
  assertEquals(await call(token), body.sub);
  await new Promise((r) => setTimeout(r, 2_100));
  assertEquals(await call(token), null);
});

Deno.test("sameSecret", () => {
  assertEquals(sameSecret("abc", "abc"), true);
  assertEquals(sameSecret("abd", "abc"), false);
  assertEquals(sameSecret("ab", "abc"), false);
  assertEquals(sameSecret("abcd", "abc"), false);
  assertEquals(sameSecret(null, "abc"), false);
  assertEquals(sameSecret("", ""), false);
});

Deno.test({ name: "stop the JWKS server", sanitizeOps: false, sanitizeResources: false, fn: () => server.shutdown() });
