// cd supabase/functions/_shared && deno test --no-check --allow-env --allow-net --no-lock sentry_test.ts
// Not part of vitest (no Deno in CI). Run before deploying sentry.ts.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { buildEnvelope, captureEdgeError, parseDsn, parseStack, redact, withSentry } from "./sentry.ts";

Deno.test("parses a DSN into the envelope endpoint and key", () => {
  assertEquals(parseDsn("https://abc123@o9.ingest.us.sentry.io/42"), {
    key: "abc123", endpoint: "https://o9.ingest.us.sentry.io/api/42/envelope/",
  });
  assertEquals(parseDsn(""), null);
  assertEquals(parseDsn("http://abc@x/1"), null);
});

Deno.test("redacts tokens, keys, emails and push endpoints", () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
  const out = redact(`a ${jwt} Bearer abcdefghijkl sb_secret_xyz123 apikey=k1 mark@example.com https://fcm.googleapis.com/fcm/send/abc`);
  assertEquals(out, "a [jwt] Bearer [redacted] [supabase-key] apikey=[redacted] [email] [push-endpoint]");
});

Deno.test("turns a V8 stack into oldest-first frames under functions/", () => {
  const frames = parseStack([
    "Error: boom",
    "    at handleAction (file:///home/deno/functions/_shared/pvp.ts:120:11)",
    "    at async answer (file:///home/deno/functions/_shared/pvp.ts:690:11)",
    "    at https://deno.land/std@0.168.0/http/server.ts:10:3",
  ].join("\n"));
  assertEquals(frames.length, 3);
  assertEquals(frames[2], { function: "handleAction", filename: "functions/_shared/pvp.ts", lineno: 120, colno: 11, in_app: true });
  assertEquals(frames[0].in_app, false);
});

Deno.test("builds a well-formed envelope with no identity in it", () => {
  const { eventId, body } = buildEnvelope(new Error("user mark@example.com sent Bearer abcdefghijkl"), "pvp-action", {}, 1_700_000_000_000);
  const [header, item, payload] = body.trim().split("\n");
  assertEquals(JSON.parse(header).event_id, eventId);
  assertEquals(JSON.parse(item), { type: "event", length: new TextEncoder().encode(payload).length });
  const event = JSON.parse(payload);
  assertEquals(event.exception.values[0].value, "user [email] sent Bearer [redacted]");
  assertEquals(event.tags.function, "pvp-action");
  assert(event.exception.values[0].stacktrace.frames.length > 0);
  assertEquals(event.user, undefined);
  assert(!/mark@example|abcdefghijkl/.test(body));
});

Deno.test("sends nothing without a DSN, and posts the envelope with one", async () => {
  const seen: Array<{ url: string; auth: string | null; body: string }> = [];
  const server = Deno.serve({ port: 0, onListen: () => {} }, async (req) => {
    seen.push({ url: new URL(req.url).pathname, auth: req.headers.get("x-sentry-auth"), body: await req.text() });
    return new Response("{}");
  });
  const port = (server.addr as Deno.NetAddr).port;
  const realFetch = globalThis.fetch;
  // The DSN must be https; point that host at the local server.
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
    realFetch(String(input).replace("https://ingest.test", `http://127.0.0.1:${port}`), init);
  try {
    Deno.env.delete("SENTRY_DSN");
    await captureEdgeError(new Error("x"), "pvp-queue");
    assertEquals(seen.length, 0);
    Deno.env.set("SENTRY_DSN", "https://abc123@ingest.test/7");
    await captureEdgeError(new Error("pvp exploded"), "pvp-queue");
    assertEquals(seen.length, 1);
    assertEquals(seen[0].url, "/api/7/envelope/");
    assert(seen[0].auth?.includes("sentry_key=abc123"));
    assert(seen[0].body.includes("pvp exploded"));

    const res = await withSentry("send-push", () => { throw new Error("kaboom"); })(new Request("http://x/"));
    assertEquals(res.status, 500);
    await new Promise((r) => setTimeout(r, 200));
    assertEquals(seen.length, 2);
    assert(seen[1].body.includes('"uncaught":"true"'));
  } finally {
    globalThis.fetch = realFetch;
    Deno.env.delete("SENTRY_DSN");
    await server.shutdown();
  }
});
