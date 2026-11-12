import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";
import { playLog } from "../../../src/lib/replay/codec.js";
import { userIdFromAuth } from "../_shared/jwt.ts";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const service = createClient(url, serviceKey, { auth: { persistSession: false } });

function cors(origin: string | null) {
  const allowed = [
    Deno.env.get("ALLOWED_ORIGIN"),
    ...(Deno.env.get("DENO_ENV") !== "production"
      ? ["http://localhost:8080", "http://127.0.0.1:8090"]
      : []),
  ].filter(Boolean) as string[];
  const ok = origin && allowed.includes(origin) ? origin : (allowed[0] || "");
  return {
    "Access-Control-Allow-Origin": ok,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

async function userId(header: string | null) {
  return userIdFromAuth(header, anon, url);
}

serve(async (req) => {
  const headers = cors(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const user = await userId(req.headers.get("Authorization"));
    const body = await req.json().catch(() => ({}));
    const op = String(body.op || "open");
    const db = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
      auth: { persistSession: false },
    });
    if (op === "save") {
      if (!user) return json({ ok: false, error: "auth" }, 401, headers);
      const log = body.log;
      const walked = playLog(log);
      if (!walked.ok) return json({ ok: false, error: walked.error || "bad" }, 200, headers);
      const { data, error } = await service.rpc("replay_put", {
        p_owner: user,
        p_opponent: null,
        p_match: null,
        p_log: log,
      });
      if (error) return json({ ok: false, error: "server" }, 200, headers);
      return json(data, 200, headers);
    }
    const { data, error } = await db.rpc(
      op === "mine" ? "replay_mine"
        : op === "feed" ? "replay_feed"
          : op === "for-match" ? "replay_for_match"
            : op === "star" ? "replay_star"
              : op === "share" ? "replay_share"
                : "replay_open",
      op === "open" ? { p_id: body.id || null, p_code: body.code || "" }
        : op === "for-match" ? { p_match: body.matchId }
          : op === "star" ? { p_id: body.id, p_on: !!body.on }
            : op === "share" ? { p_id: body.id, p_privacy: body.privacy || "public" }
              : {},
    );
    if (error) return json({ ok: false, error: "server" }, 200, headers);
    return json(data, 200, headers);
  } catch (err) {
    console.error("replay", err);
    return json({ ok: false, error: "server" }, 500, headers);
  }
});

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
