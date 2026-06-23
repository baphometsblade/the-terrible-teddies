// Re-export the single canonical Supabase client so Stripe checkout reads the
// exact same auth session as the rest of the app (see utils/supabaseClient.js).
import { supabase } from '../../utils/supabaseClient';

export { supabase };