import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";
import webpush from "npm:web-push@3.6.7";
import { deliverOutbox, outboxFromRequest } from "./deliver.js";

// Database webhooks call this with the service role JWT. config.toml keeps
// verify_jwt = true, so the gateway rejects a missing or bad token. A
// player's own JWT would still pass that gate, so this refuses any role
// other than service_role before it touches a subscription.

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const jwtRole = (req: Request) => {
  const header = req.headers.get("Authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "");
  const part = token.split(".")[1];
  if (!part) return "";
  try {
    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const parsed = JSON.parse(atob(padded));
    return String(parsed.role || "");
  } catch {
    return "";
  }
};

serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, reason: "method" }, 405);
  if (jwtRole(req) !== "service_role") return json({ ok: false, reason: "forbidden" }, 401);

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
