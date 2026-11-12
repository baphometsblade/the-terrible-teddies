import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { servePvp } from "../_shared/pvp.ts";

serve((req) => servePvp(req, "queue"));
