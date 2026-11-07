import { useEffect } from 'react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { loadFeatureFlags } from '@/lib/featureFlags';
import { armWebVitals } from '@/lib/productEvents';
import { hasAnalyticsConsent } from '@/lib/consent';
import { supabase } from '@/utils/supabaseClient';
import { noteFailure, noteSuccess } from '@/lib/supabaseHealth';
import { isRetryableError, withRetry } from '@/lib/retry';

// Boot-time platform work that is not the game: flags, a once-a-visit
// activity ping, and web vitals once analytics are allowed. Failures are
// reported to the outage line and otherwise ignored.
const PlatformRuntime = () => {
  const { session } = useSupabaseAuth();

  useEffect(() => {
    loadFeatureFlags();
  }, []);

  useEffect(() => {
    if (hasAnalyticsConsent()) armWebVitals();
  }, []);

  useEffect(() => {
    if (!session?.access_token) return undefined;
    let live = true;
    withRetry(
      () => supabase.rpc('touch_player_activity'),
      { onFailure: noteFailure },
    ).then((result) => {
      if (!live) return;
      if (result?.error && isRetryableError(result.error)) noteFailure();
      else if (!result?.error) noteSuccess();
    });
    return () => { live = false; };
  }, [session?.access_token]);

  return null;
};

export default PlatformRuntime;
