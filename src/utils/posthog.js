import posthog from 'posthog-js';

export const initPostHog = () => {
  if (typeof window !== 'undefined') {
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
  }
};

export const captureEvent = (eventName, properties = {}) => {
  if (typeof window !== 'undefined' && posthog.isFeatureEnabled('analytics')) {
    posthog.capture(eventName, properties);
  } else {
    console.log(`Event not captured (analytics disabled): ${eventName}`, properties);
  }
};