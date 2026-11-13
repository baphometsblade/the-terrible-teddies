// The Sentry SDK, as only the pieces this app uses. Imported dynamically by
// src/lib/sentry.js, so none of it is on the first paint, and imported by
// name (not `import('@sentry/react')` as a namespace) so the bundler can drop
// every integration the app never turns on: Session Replay, Feedback,
// Canvas, profiling. That is most of the package.
export {
  init,
  captureException,
  captureMessage,
  withScope,
  browserTracingIntegration,
} from '@sentry/react';
export { scrubSentryEvent, scrubCrumb } from './sentryScrub.js';
