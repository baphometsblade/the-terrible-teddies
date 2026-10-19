import React from 'react';
import { HeartCrack, RotateCcw, RotateCw, Trash2, ChevronRight } from 'lucide-react';
import analytics from '../utils/analytics';
import { RARITY_METAL } from '@/lib/rarity';
import { FOCUS_OUTLINE } from '@/lib/focus';

// Plain <button>s on the materials. Focus is an outline: a Tailwind ring is a
// box-shadow, and on btn-brass / btn-glass it would replace the material's own
// rim light and depth.
const ACTION =
  `w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl px-6 font-display text-base font-bold ${FOCUS_OUTLINE}`;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, errorCount: 0 };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState((prev) => ({
      error,
      errorInfo,
      errorCount: prev.errorCount + 1,
    }));

    // Fatal render crashes are the highest-value error to surface — route
    // through the same PostHog pipe as every other tracked event, so a crash
    // in production is actually visible instead of only reaching a browser
    // console no one is watching.
    analytics.trackError(error, 'react-error-boundary', true);
  }

  // A crash replaces the whole tree, so whatever had focus is destroyed and
  // focus falls to <body>: a screen-reader user was told nothing. Focus moves
  // to the heading instead, so "Oh no!" is announced, with the message under
  // it as the heading's description, and Try Again is the next Tab. The
  // heading rather than Try Again so the announcement says what happened, not
  // just what to press, and so a repeat of the Enter that crashed it cannot
  // press a button straight away. A stable callback ref (a class field, not an
  // inline arrow), so it fires when the crash screen mounts, not on every
  // re-render.
  focusOnMount = (el) => {
    if (el) el.focus();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleClearData = () => {
    if (confirm('This will clear all your game data and reload. Continue?')) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env?.DEV;
      return (
        <div className="relative min-h-screen bar-backdrop flex items-start justify-center px-4 py-10 overflow-x-hidden">
          <div className="fixed inset-0 grain pointer-events-none" aria-hidden="true" />

          {/* my-auto rather than items-center on the parent: centred, but a
              card taller than the screen (the developer details open on a
              phone) still starts at the top instead of overflowing it. */}
          <main className="relative my-auto w-full max-w-md rounded-2xl dialog-panel px-6 py-8 sm:px-8 overflow-hidden">
            {/* A cold wash for the medallion to sit in — the same light the
                defeat screen uses. */}
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-48 pointer-events-none bg-[radial-gradient(ellipse_60%_80%_at_50%_0%,rgba(129,140,248,0.16),transparent_70%)]" />

            <div className="relative text-center mb-7">
              <div
                className="mx-auto mb-5 h-20 w-20 rounded-full p-[3px] shadow-[0_10px_24px_-10px_rgba(0,0,0,0.9)]"
                style={{ background: RARITY_METAL.common }}
                aria-hidden="true"
              >
                <div className="grid h-full w-full place-items-center rounded-full bg-night-900">
                  <HeartCrack className="h-9 w-9 text-plush-200" strokeWidth={1.75} />
                </div>
              </div>
              {/* tabIndex -1: focusable from script only, never a Tab stop.
                  No outline, since it is a heading, not a control. */}
              <h1
                ref={this.focusOnMount}
                tabIndex={-1}
                aria-describedby="crash-screen-detail"
                className="font-display text-4xl font-extrabold leading-tight text-plush-100 mb-2 focus:outline-none"
              >
                Oh no!
              </h1>
              <p id="crash-screen-detail" className="text-plush-200 leading-relaxed">
                Something went wrong with the teddies. Don&apos;t worry — your progress is safe.
              </p>
            </div>

            <div className="relative space-y-3">
              <button
                type="button"
                onClick={this.handleReset}
                className={`btn-brass ${ACTION}`}
              >
                <RotateCcw aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.4} />
                Try Again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className={`btn-glass ${ACTION}`}
              >
                <RotateCw aria-hidden="true" className="h-[18px] w-[18px] text-plush-300" strokeWidth={2.4} />
                Reload Game
              </button>
              {this.state.errorCount > 2 && (
                // The destructive one: the glass material tinted red, so it
                // reads as a different kind of button rather than a third
                // equal choice. The utilities refine the material's border.
                <button
                  type="button"
                  onClick={this.handleClearData}
                  className={`btn-glass ${ACTION} text-red-200 border-red-400/30 hover:border-red-400/60`}
                >
                  <Trash2 aria-hidden="true" className="h-[18px] w-[18px] text-red-300" strokeWidth={2.4} />
                  Clear Data & Restart
                </button>
              )}
            </div>

            {isDev && this.state.error && (
              <details className="group relative mt-6 rounded-xl bg-night-950/70 border border-white/5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.45)] text-xs text-plush-200">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2.5 label-caps text-plush-300 hover:text-plush-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-300 [&::-webkit-details-marker]:hidden">
                  <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open:rotate-90" strokeWidth={2.6} />
                  Developer Info
                </summary>
                {/* Focusable, so a keyboard can scroll it; and long URLs in
                    the stack break rather than run off the right edge. */}
                <pre
                  tabIndex={0}
                  className="mx-3 mb-3 max-h-60 overflow-auto whitespace-pre-wrap [overflow-wrap:anywhere] rounded-lg font-mono text-[11px] leading-relaxed text-plush-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-300"
                >
                  {this.state.error.toString()}
                  {'\n\n'}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="relative mt-6 flex items-center justify-center gap-2 text-xs text-plush-300">
              <span className="h-px w-8 bg-gradient-to-r from-transparent to-white/15" aria-hidden="true" />
              <span>Error ID: <span className="font-mono text-plush-200">{Date.now().toString(36)}</span></span>
              <span className="h-px w-8 bg-gradient-to-l from-transparent to-white/15" aria-hidden="true" />
            </div>
          </main>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
