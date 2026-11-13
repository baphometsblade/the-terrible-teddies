import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { servePvp } from "../_shared/pvp.ts";
import { withSentry } from "../_shared/sentry.ts";

serve(withSentry("pvp-invite", (req) => servePvp(req, "invite")));
