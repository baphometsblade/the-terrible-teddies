const isProduction = import.meta.env?.PROD;
const isBrowser = typeof window !== 'undefined';

// posthog-js is NOT imported statically, deliberately.
//
// It is 225 kB — 36.6% of the production entry chunk, more than the entire
// src/ tree, and single-handedly what pushed the bundle past vite's 600 kB
// warning. A static import put every byte of it on the boot path for every
// visitor, parsed and executed before React could render the login screen.
// And it does nothing at all unless VITE_POSTHOG_KEY is set — which CLAUDE.md
// documents as optional — so a keyless deploy shipped 225 kB of pure inertia.
//
// Loading it dynamically AFTER the key check means a keyless deploy never
// fetches it at all, and a keyed one fetches it off the critical path.
let ph = null;
let loading = null;

// Calls made before the SDK finishes loading would otherwise vanish, and that
// is most of them — the import races app startup, and trackError in particular
// exists to catch crashes that happen early. Queue them and flush on load.
// Bounded, so a load that never resolves (offline, blocked by an ad blocker,
// CSP) leaks a fixed 50 entries rather than growing for the whole session.
const MAX_PENDING = 50;
const pending = [];

const send = (method, args) => {
  try {
    if (ph) {
      ph[method]?.(...args);
    } else if (pending.length < MAX_PENDING) {
      pending.push([method, args]);
    }
  } catch (error) {
    console.error(`Failed to send analytics ${method}:`, error);
  }
};

export const initializePostHog = async () => {
  try {
    const key = import.meta.env?.VITE_POSTHOG_KEY;
    // Key check FIRST: this is what keeps the 225 kB off a keyless deploy.
    if (!key || !isBrowser || loading) return;

    loading = import('posthog-js');
    const mod = await loading;
    const client = mod.default ?? mod;

    client.init(key, {
      // The canonical US ingestion host. posthog-js silently rewrites the old
      // 'https://app.posthog.com' to this value internally, so configuring the
      // old host would make every real request target a host the CSP's
      // connect-src doesn't allow — silently dropping ALL analytics and crash
      // reports in production. csp.test.js pins this to vercel.json.
      api_host: 'https://us.i.posthog.com',
      loaded: (ph) => {
        if (import.meta.env?.DEV) {
          ph.opt_out_capturing();
        }
      },
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      cross_subdomain_cookie: false,
      secure_cookie: true,
    });

    ph = client;
    // Drain anything recorded while the module was in flight.
    for (const [method, args] of pending.splice(0)) send(method, args);
  } catch (error) {
    console.error('Failed to initialize PostHog:', error);
  }
};

export const trackEvent = (eventName, properties = {}) => {
  send('capture', [eventName, properties]);
};

const logEvent = (eventName, params = {}) => {
  if (!isBrowser) return;

  if (!isProduction) {
    console.log(`[Analytics] ${eventName}`, params);
  }

  if (window.gtag) {
    window.gtag('event', eventName, params);
  }

  if (window.fbq) {
    window.fbq('trackCustom', eventName, params);
  }

  trackEvent(eventName, params);
};

export const analytics = {
  init: (gaId) => {
    if (!isBrowser || !gaId || !isProduction) return;
  },

  // Tie subsequent events to a stable user so purchases, funnels, and retention
  // are measured per-user rather than per-device. Pass the Supabase user UUID
  // (an opaque id, not PII) as the distinct id — keep email/PII out of analytics.
  identify: (userId, traits = {}) => {
    try {
      if (isBrowser && userId) send('identify', [userId, traits]);
    } catch (error) {
      console.error('Failed to identify user:', error);
    }
  },

  // Clear the identity on logout so the next (possibly different) user's events
  // aren't merged into the previous person's profile.
  reset: () => {
    try {
      if (isBrowser) send('reset', []);
    } catch (error) {
      console.error('Failed to reset analytics identity:', error);
    }
  },

  trackPageView: (pagePath) => {
    logEvent('page_view', { page_path: pagePath });
  },

  trackPurchase: ({ itemId, itemName, price, currency, quantity = 1 }) => {
    logEvent('purchase', {
      transaction_id: `txn_${Date.now()}`,
      value: price,
      currency: currency === 'gems' || currency === 'coins' ? 'USD' : currency,
      items: [{ item_id: itemId, item_name: itemName, price, quantity }],
    });
  },

  trackInGamePurchase: ({ itemId, itemName, cost, currency }) => {
    logEvent('spend_virtual_currency', {
      item_id: itemId,
      item_name: itemName,
      virtual_currency_name: currency,
      value: cost,
    });
  },

  // Real-money checkout started (user clicked a gem bundle, before Stripe
  // redirect). The middle of the funnel between trackShopView (view_item_list)
  // and trackPurchase (purchase) — without it, checkout abandonment at Stripe
  // is invisible.
  trackBeginCheckout: ({ bundleId, gems, price }) => {
    logEvent('begin_checkout', {
      currency: 'USD',
      value: price,
      items: [{ item_id: bundleId, item_name: `${gems} gems`, price, quantity: 1 }],
    });
  },

  trackBattleComplete: ({ won, difficulty, duration, damageDealt }) => {
    logEvent(won ? 'level_success' : 'level_fail', {
      difficulty,
      duration_seconds: duration,
      damage_dealt: damageDealt,
    });
  },

  trackLevelUp: (newLevel) => {
    logEvent('level_up', { level: newLevel });
  },

  trackCardUnlocked: ({ cardId, cardName, rarity }) => {
    logEvent('unlock_achievement', {
      achievement_id: `card_${cardId}`,
      card_name: cardName,
      rarity,
    });
  },

  trackShopView: (tab) => {
    logEvent('view_item_list', { item_list_name: `shop_${tab}` });
  },

  trackTutorialComplete: () => {
    logEvent('tutorial_complete');
  },

  trackError: (error, context, fatal = false) => {
    logEvent('exception', {
      description: error?.toString?.() || String(error),
      fatal,
      context,
    });
  },
};

export default analytics;
