import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, errorCount: 0 };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState((prev) => ({
      error,
      errorInfo,
      errorCount: prev.errorCount + 1,
    }));

    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: error?.toString(),
        fatal: true,
      });
    }
  }

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
        <div className="min-h-screen bg-gradient-to-b from-purple-900 via-indigo-900 to-black flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 max-w-lg w-full border border-white/20 shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">🧸💔</div>
              <h1 className="text-3xl font-bold text-white mb-2">Oh no!</h1>
              <p className="text-white/70">
                Something went wrong with the teddies. Don't worry — your progress is safe.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="w-full bg-white/10 hover:bg-white/20 text-white py-3 px-6 rounded-xl transition-all"
              >
                Reload Game
              </button>
              {this.state.errorCount > 2 && (
                <button
                  onClick={this.handleClearData}
                  className="w-full bg-red-500/30 hover:bg-red-500/50 text-red-200 py-3 px-6 rounded-xl transition-all border border-red-500/50"
                >
                  Clear Data & Restart
                </button>
              )}
            </div>

            {isDev && this.state.error && (
              <details className="mt-6 bg-black/50 rounded-lg p-3 text-xs text-white/70">
                <summary className="cursor-pointer font-semibold mb-2">Developer Info</summary>
                <pre className="whitespace-pre-wrap overflow-auto max-h-60">
                  {this.state.error.toString()}
                  {'\n\n'}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="mt-6 text-center text-white/50 text-xs">
              Error ID: {Date.now().toString(36)}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
