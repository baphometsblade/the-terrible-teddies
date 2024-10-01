let posthog;

export const initPostHog = async () => {
  try {
    posthog = (await import('posthog-js')).default;
    posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
      api_host: 'https://app.posthog.com',
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      xhr_headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      config: {
        payload_size_limit: 1024 * 1024 // 1MB limit
      }
    });
    console.log('PostHog initialized successfully');
  } catch (error) {
    console.error('Failed to initialize PostHog:', error);
  }
};

export const captureEvent = (eventName, properties = {}) => {
  if (!posthog) {
    console.warn('PostHog not initialized, event not captured');
    return;
  }
  try {
    const payload = JSON.stringify({ event: eventName, properties });
    if (payload.length > 1024 * 1024) {
      console.warn('PostHog event payload too large, not sending');
      return;
    }
    posthog.capture(eventName, properties);
  } catch (error) {
    console.error('Error capturing PostHog event:', error);
  }
};