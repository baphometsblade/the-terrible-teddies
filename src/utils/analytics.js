import posthog from 'posthog-js';

export const initializePostHog = () => {
  try {
    posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
      api_host: 'https://app.posthog.com',
      loaded: (posthog) => {
        if (import.meta.env.DEV) {
          posthog.opt_out_capturing();
        }
      },
    });
  } catch (error) {
    console.error('Failed to initialize PostHog:', error);
  }
};

export const trackEvent = (eventName, properties = {}) => {
  try {
    posthog.capture(eventName, properties);
  } catch (error) {
    console.error('Failed to track event:', error);
  }
};