import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";
import webpush from "npm:web-push@3.6.7";
import { serviceRoleAuthorizedAny } from "./auth.js";
import { deliverOutbox, outboxFromRequest } from "./deliver.js";

// Database webhooks call this with the service role key. config.toml keeps
// verify_jwt = true, so the gateway rejects a missing or bad token. The
// function also compares the bearer, in constant time, to
// SUPABASE_SERVICE_ROLE_KEY. Decoding the payload is not a check: a forged
// token can claim role=service_role, and a deploy with --no-verify-jwt
// would otherwise let it through.

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, reason: "method" }, 405);
  // The platform now injects the new sb_secret_ key as
  // SUPABASE_SERVICE_ROLE_KEY. That value is not a JWT, so it cannot pass
  // the gateway's verify_jwt check. The database webhook therefore sends
  // the legacy service_role JWT, stored as PUSH_SERVICE_ROLE_JWT. The
  // supabase-js client below still uses SUPABASE_SERVICE_ROLE_KEY, which
  // is the working admin key on this project.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const webhookJwt = Deno.env.get("PUSH_SERVICE_ROLE_JWT") ?? "";
  if (!serviceRoleAuthorizedAny(req.headers.get("Authorization"), [webhookJwt, serviceKey])) {
    return json({ ok: false, reason: "forbidden" }, 401);
  }

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "";
  if (!publicKey || !privateKey || !subject) {
    return json({ ok: false, reason: "unconfigured" }, 503);
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: "missing" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let record = outboxFromRequest(body);
  const outboxId = body && typeof body === "object" && "outbox_id" in body
    ? String((body as { outbox_id?: string }).outbox_id || "")
    : "";
  if (!record && outboxId) {
    const { data } = await supabase.from("push_outbox").select("*").eq("id", outboxId).maybeSingle();
    record = data;
  }
  if (!record) return json({ ok: false, reason: "missing" }, 400);
  if (record.sent_at) return json({ ok: true, sent: 0, reason: "sent" });

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const result = await deliverOutbox(record, {
    listSubscriptions: async (userId: string) => {
      const { data } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", userId);
      return data || [];
    },
    send: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) =>
      webpush.sendNotification(sub, payload),
    dropSubscription: (endpoint: string) =>
      supabase.rpc("drop_push_endpoint", { p_endpoint: endpoint }),
    markSent: (id: string) => supabase.rpc("mark_push_sent", { p_id: id }),
  });

  return json({ ok: true, ...result });
});
