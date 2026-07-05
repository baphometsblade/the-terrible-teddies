import posthog from 'posthog-js';

const isProduction = import.meta.env?.PROD;
const isBrowser = typeof window !== 'undefined';

export const initializePostHog = () => {
  try {
    const key = import.meta.env?.VITE_POSTHOG_KEY;
    if (!key || !isBrowser) return;

    posthog.init(key, {
      api_host: 'https://app.posthog.com',
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
