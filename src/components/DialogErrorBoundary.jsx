import React from 'react';
import analytics from '../utils/analytics';

// Scoped error boundary for the lazy-loaded dialog chunks.
//
// Without it, a failed dynamic import — a flaky network opening the Shop, or a
// stale chunk hash still referenced by an open tab after a deploy — throws past
// Suspense (which only catches the *pending* promise, not a *rejected* one) up
// to the app-level ErrorBoundary, which wraps EVERYTHING. The entire UI, menu
// and in-progress game included, is then replaced by the full crash screen over
// a dialog the user merely tried to open, with no way back but a reload.
//
// This keeps the failure scoped: show a small dismissible notice and let the
// parent close the dialog, so the rest of the app stays usable. It resets when
// the open-dialog set changes, so a later open tries the chunk afresh.
class DialogErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Dialog failed to load:', error, info);
    // Not fatal: the app survives, so flag it as non-fatal telemetry (unlike
    // the app-level boundary, which reports true).
    analytics.trackError(error, 'dialog-lazy-chunk', false);
  }

  componentDidUpdate(prevProps) {
    // Dismissing the notice closes the dialog, which changes resetKey; clearing
    // the error here means the next open attempt re-mounts the chunk instead of
    // being stuck showing the failure forever.
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={this.props.onDismiss}
        >
          <div
            className="bg-night-800 border border-white/20 rounded-2xl p-6 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-label="That screen failed to load"
          >
            <div className="text-5xl mb-3">🧸📡</div>
            <h2 className="text-xl font-bold text-white mb-2">Couldn&apos;t open that</h2>
            <p className="text-white/70 text-sm mb-4">
              That screen failed to load — usually a network hiccup. Your game is fine; give it another try.
            </p>
            <button
              onClick={this.props.onDismiss}
              className="w-full bg-brass-500 hover:bg-brass-400 text-night-950 font-bold py-2 rounded-lg transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default DialogErrorBoundary;
