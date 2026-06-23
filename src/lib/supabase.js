// Re-export the single canonical Supabase client. Spinning up a second
// createClient() on the same URL spawns a competing GoTrueClient whose auth
// listener races the first on token refresh — which can make getSession()
// momentarily return null mid-checkout and strand a paying customer. One
// client, one session, app-wide.
export { supabase } from '../utils/supabaseClient';
