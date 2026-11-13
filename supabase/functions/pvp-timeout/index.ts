import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { servePvp } from "../_shared/pvp.ts";
import { withSentry } from "../_shared/sentry.ts";

// No Supabase JWT. The scheduler sends x-pvp-cron-secret (PVP_CRON_SECRET).
serve(withSentry("pvp-timeout", (req) => servePvp(req, "timeout")));
