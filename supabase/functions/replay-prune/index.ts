import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";

// Drops ordinary replays past each player's last 50. Starred and shared stay.
// The scheduler sends x-pvp-cron-secret. replay_put also prunes on the way in.
const secret = Deno.env.get("PVP_CRON_SECRET") || "";
const service = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

serve(async (req) => {
  if (!secret || req.headers.get("x-pvp-cron-secret") !== secret) {
    return new Response(JSON.stringify({ ok: false, error: "auth" }), { status: 401 });
  }
  const { data, error } = await service.rpc("replay_prune", { p_owner: null });
  if (error) return new Response(JSON.stringify({ ok: false, error: "server" }), { status: 500 });
  return new Response(JSON.stringify({ ok: true, pruned: data }), { status: 200 });
});
