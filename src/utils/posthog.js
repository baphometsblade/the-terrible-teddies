import posthog from 'posthog-js';

export const initPostHog = () => {
  const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
  if (posthogKey) {
    try {
      posthog.init(posthogKey, {
        api_host: 'https://app.posthog.com',
        loaded: (loadedPostHog) => {
          console.log('PostHog loaded successfully');
        },
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        xhr_headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
      });
    } catch (error) {
      console.error('Error initializing PostHog:', error);
    }
  } else {
    console.warn('PostHog key not found in environment variables');
  }
};

export const captureEvent = (eventName, properties = {}) => {
  if (posthog && typeof posthog.capture === 'function') {
    try {
      console.log('Capturing PostHog event:', eventName, properties);
      posthog.capture(eventName, properties);
    } catch (error) {
      console.error('Error capturing PostHog event:', error);
    }
  } else {
    console.warn('PostHog not initialized or capture function not available, event not captured:', eventName);
  }
};