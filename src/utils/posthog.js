import posthog from 'posthog-js';

export const initPostHog = () => {
  if (typeof window !== 'undefined' && import.meta.env.VITE_POSTHOG_KEY) {
    posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com',
      loaded: (posthog) => {
        if (import.meta.env.DEV) {
          // In development, let's be verbose
          posthog.debug();
        }
      },
      autocapture: false,
      disable_session_recording: true,
      capture_pageview: false,
    });
  } else {
    console.warn('PostHog not initialized: Missing VITE_POSTHOG_KEY or running on server');
  }
};

export const captureEvent = (eventName, properties = {}) => {
  if (typeof window !== 'undefined' && posthog.isFeatureEnabled('analytics')) {
    posthog.capture(eventName, properties);
  } else {
    console.log(`Event not captured (analytics disabled or server-side): ${eventName}`, properties);
  }
};