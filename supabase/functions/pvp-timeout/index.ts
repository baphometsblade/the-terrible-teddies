import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { servePvp } from "../_shared/pvp.ts";

// No Supabase JWT. The scheduler sends x-pvp-cron-secret (PVP_CRON_SECRET).
serve((req) => servePvp(req, "timeout"));
