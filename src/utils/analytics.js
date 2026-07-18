import posthog from 'posthog-js';

const isProduction = import.meta.env?.PROD;
const isBrowser = typeof window !== 'undefined';

export const initializePostHog = () => {
  try {
    const key = import.meta.env?.VITE_POSTHOG_KEY;
    if (!key || !isBrowser) return;

    posthog.init(key, {
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
  } catch (error) {
    console.error('Failed to initialize PostHog:', error);
  }
};

export const trackEvent = (eventName, properties = {}) => {
  try {
    if (posthog && posthog.capture) {
      posthog.capture(eventName, properties);
    }
  } catch (error) {
    console.error('Failed to track event:', error);
  }
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
      if (isBrowser && userId && posthog?.identify) posthog.identify(userId, traits);
    } catch (error) {
      console.error('Failed to identify user:', error);
    }
  },

  // Clear the identity on logout so the next (possibly different) user's events
  // aren't merged into the previous person's profile.
  reset: () => {
    try {
      if (isBrowser && posthog?.reset) posthog.reset();
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
