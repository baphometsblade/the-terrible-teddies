// Serves the four Pub Brawl functions on one port for the local gateway.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { servePvp } from "../supabase/functions/_shared/pvp.ts";

serve((req) => {
  const name = new URL(req.url).pathname.split("/").filter(Boolean).pop() || "";
  if (name === "pvp-queue") return servePvp(req, "queue");
  if (name === "pvp-action") return servePvp(req, "action");
  if (name === "pvp-invite") return servePvp(req, "invite");
  if (name === "pvp-timeout") return servePvp(req, "timeout");
  return new Response(JSON.stringify({ ok: false, error: "missing" }), { status: 404 });
}, { port: 8000 });
