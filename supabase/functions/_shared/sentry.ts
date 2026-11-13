// Error capture for the Edge Functions: a minimal Sentry envelope reporter.
//
// Not @sentry/deno: it pulls a large module graph into every cold start and
// patches globals, and these functions need exactly one thing from it, "send
// this exception, with its stack, and nothing that identifies anyone". That
// is one POST of a documented format:
// https://develop.sentry.dev/sdk/data-model/envelopes/
//
// Off unless SENTRY_DSN is set (a function secret; the SUPABASE_ prefix is
// reserved on prod, so it is not SENTRY_-anything-SUPABASE). Never throws,
// never delays the response by more than the send's short timeout, and is
// handed to EdgeRuntime.waitUntil when the runtime has it, so the player's
// answer goes out first.

type Dsn = { endpoint: string; key: string };

const DSN_RE = /^https:\/\/([0-9a-f]+)@([\w.-]+)\/(\d+)$/i;

export function parseDsn(raw: string | undefined | null): Dsn | null {
  const m = DSN_RE.exec(String(raw ?? "").trim());
  if (!m) return null;
  return { key: m[1], endpoint: `https://${m[2]}/api/${m[3]}/envelope/` };
}

const REDACTIONS: Array<[RegExp, string]> = [
  [/\beyJ[\w-]{6,}\.[\w-]{6,}\.[\w-]{6,}/g, "[jwt]"],
  [/\b(Bearer|Basic)\s+[\w.~+/=-]{8,}/gi, "$1 [redacted]"],
  [/\bsb_(secret|publishable)_[\w-]+/g, "[supabase-key]"],
  [/((?:access|refresh|id|auth)?[_-]?token|apikey|api[_-]?key|password|secret|authorization|p256dh|auth_key)(["']?\s*[:=]\s*["']?)[^\s"'&,;}]+/gi, "$1$2[redacted]"],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[email]"],
  // Push endpoints are bearer URLs for one browser.
  [/https:\/\/[\w.-]*(?:push|notify|fcm|wns)[\w.-]*\/[^\s"']+/gi, "[push-endpoint]"],
];

export function redact(text: unknown): string {
  let out = String(text ?? "");
  for (const [re, to] of REDACTIONS) out = out.replace(re, to);
  return out.slice(0, 2000);
}

type Frame = { function?: string; filename?: string; lineno?: number; colno?: number; in_app?: boolean };

// V8 stack lines ("    at fn (file:///.../pvp.ts:12:5)" or "    at file:///...:12:5"),
// oldest first as Sentry expects. Paths are cut to the functions tree.
export function parseStack(stack: string | undefined): Frame[] {
  const frames: Frame[] = [];
  for (const line of String(stack ?? "").split("\n")) {
    const m = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?\s*$/.exec(line);
    if (!m) continue;
    const file = m[2].replace(/^.*?\/functions\//, "functions/");
    frames.push({
      function: m[1] || "<anonymous>",
      filename: file,
      lineno: Number(m[3]),
      colno: Number(m[4]),
      in_app: !/deno\.land|esm\.sh|jsr:|npm:|ext:|node:/.test(m[2]),
    });
  }
  return frames.reverse().slice(-50);
}

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

export function buildEnvelope(error: unknown, fn: string, tags: Record<string, string> = {}, now = Date.now()) {
  const err = error instanceof Error ? error : new Error(redact(error));
  const eventId = hex(crypto.getRandomValues(new Uint8Array(16)));
  const event = {
    event_id: eventId,
    timestamp: now / 1000,
    platform: "javascript",
    level: "error",
    logger: "edge",
    environment: Deno.env.get("SENTRY_ENVIRONMENT") || "production",
    release: Deno.env.get("SENTRY_RELEASE") || undefined,
    transaction: fn,
    tags: { function: fn, runtime: "supabase-edge", region: Deno.env.get("SB_REGION") || "unknown", ...tags },
    exception: {
      values: [{
        type: err.name || "Error",
        value: redact(err.message),
        stacktrace: { frames: parseStack(err.stack) },
        mechanism: { type: "edge-function", handled: true },
      }],
    },
    sdk: { name: "terrible-teddies.edge", version: "1.0.0" },
  };
  const header = JSON.stringify({ event_id: eventId, sent_at: new Date(now).toISOString() });
  const payload = JSON.stringify(event);
  const item = JSON.stringify({ type: "event", length: new TextEncoder().encode(payload).length });
  return { eventId, body: `${header}\n${item}\n${payload}\n` };
}

declare const EdgeRuntime: { waitUntil?: (p: Promise<unknown>) => void } | undefined;

/** Report an exception from an Edge Function. Fire-and-forget; never throws. */
export function captureEdgeError(error: unknown, fn: string, tags: Record<string, string> = {}): Promise<void> {
  try {
    const dsn = parseDsn(Deno.env.get("SENTRY_DSN"));
    if (!dsn) return Promise.resolve();
    const { body } = buildEnvelope(error, fn, tags);
    const send = fetch(dsn.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=terrible-teddies.edge/1.0.0, sentry_key=${dsn.key}`,
      },
      body,
      signal: AbortSignal.timeout(2500),
    }).then((r) => { r.body?.cancel(); }).catch(() => {});
    try {
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(send);
    } catch {
      // No waitUntil here: the promise still runs.
    }
    return send;
  } catch {
    return Promise.resolve();
  }
}

/** A Deno.serve / std serve handler that reports anything it throws, then answers 500. */
export function withSentry(fn: string, handler: (req: Request) => Response | Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req);
    } catch (err) {
      console.error(fn, err);
      captureEdgeError(err, fn, { uncaught: "true" });
      return new Response(JSON.stringify({ ok: false, error: "server" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
}
