import * as Sentry from "@sentry/react";

let lastErrorTime = 0;
const errorCooldown = 5000; // 5 seconds

export const initializeSentry = () => {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [new Sentry.BrowserTracing()],
    tracesSampleRate: 1.0,
  });
};

export const reportError = (error) => {
  const now = Date.now();
  if (now - lastErrorTime > errorCooldown) {
    Sentry.captureException(error);
    lastErrorTime = now;
  }
};