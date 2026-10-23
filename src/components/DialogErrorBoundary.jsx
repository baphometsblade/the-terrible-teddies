import React from 'react';
import { WifiOff } from 'lucide-react';
import analytics from '../utils/analytics';
import { RARITY_METAL } from '@/lib/rarity';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { SCRIM_PAD } from '@/lib/safeArea';

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
    // Move focus onto the notice's only control the moment it appears. It is
    // an alertdialog, and screen readers announce one when focus enters it —
    // rendered without focus, this one could appear silently, leaving a
    // keyboard player on whatever button opened the screen that failed.
    // A stable callback ref (not an inline arrow) so it fires on mount only,
    // rather than re-grabbing focus on every re-render. It also owns the two
    // document listeners below, which live exactly as long as the button.
    this.focusOnMount = (el) => {
      if (el) {
        this.okButton = el;
        el.focus();
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('focusin', this.onFocusIn);
      } else {
        this.okButton = null;
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('focusin', this.onFocusIn);
      }
    };
    // aria-modal promises the screen behind is out of reach, but nothing made
    // it so: Shift+Tab from OK landed on the menu under the scrim, invisible
    // and still operable. OK is the notice's only control, so Tab and
    // Shift+Tab both land on it, wherever focus was. On the document rather
    // than the card (as useDialog does), because focus can be outside the
    // card while it shows.
    this.onKeyDown = (e) => {
      if (e.key === 'Escape') {
        this.props.onDismiss?.();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        this.okButton?.focus();
      }
    };
    // Focus can also be moved behind the scrim without a key: a dialog open in
    // this boundary is unmounted by the failure, and useDialog's cleanup hands
    // focus back to whatever opened it. That cleanup is a passive effect, so
    // it runs after the ref above has focused OK and would win. Anything that
    // focuses outside the card while the notice shows is sent back to OK.
    this.onFocusIn = (e) => {
      const card = this.okButton?.closest('[role="alertdialog"]');
      if (card && !card.contains(e.target)) this.okButton.focus();
    };
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
        // Scrolls, with the card centred by my-auto rather than items-center:
        // a centred flex item taller than its box overflows at both ends.
        <div
          className={`fixed inset-0 z-50 dialog-scrim flex items-start justify-center ${SCRIM_PAD} overflow-y-auto`}
          onClick={this.props.onDismiss}
        >
          <div
            className="relative my-auto w-full max-w-sm overflow-hidden rounded-2xl dialog-panel px-6 pt-7 pb-6 text-center outline-none motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-300 [[data-motion=off]_&]:animate-none"
            onClick={(e) => e.stopPropagation()}
            // A click on the card's text focuses the card rather than <body>,
            // so focus stays inside the notice. Never a Tab stop.
            tabIndex={-1}
            role="alertdialog"
            aria-modal="true"
            aria-label="That screen failed to load"
            aria-describedby="dialog-load-failure-detail"
          >
            {/* A cold wash for the medallion: something went wrong, but
                nothing is lost. */}
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-40 pointer-events-none bg-[radial-gradient(ellipse_60%_80%_at_50%_0%,rgba(129,140,248,0.16),transparent_70%)]" />
            <div
              className="relative mx-auto mb-4 h-16 w-16 rounded-full p-[3px] shadow-[0_10px_24px_-10px_rgba(0,0,0,0.9)]"
              style={{ background: RARITY_METAL.common }}
              aria-hidden="true"
            >
              <div className="grid h-full w-full place-items-center rounded-full bg-night-900">
                <WifiOff className="h-7 w-7 text-plush-200" strokeWidth={1.9} />
              </div>
            </div>
            <h2 className="relative font-display text-2xl font-extrabold leading-tight text-plush-100 mb-2">Couldn&apos;t open that</h2>
            <p id="dialog-load-failure-detail" className="relative text-plush-200 text-sm leading-relaxed mb-6">
              That screen failed to load — usually a network hiccup. Your game is fine; give it another try.
            </p>
            <button
              type="button"
              ref={this.focusOnMount}
              onClick={this.props.onDismiss}
              className={`btn-brass relative w-full h-11 rounded-xl font-display text-base font-bold ${FOCUS_OUTLINE}`}
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
