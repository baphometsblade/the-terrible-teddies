// Register the installable shell. Production only: the dev server's refresh
// must not share a worker with a preview, and the worker itself never caches
// a bundle (public/sw.js is network-first for navigations and touches
// nothing else).

export const registerShell = (nav = globalThis.navigator, prod = import.meta.env.PROD, target = globalThis.window) => {
  if (!prod || !nav?.serviceWorker || !target?.addEventListener) return;
  target.addEventListener('load', () => {
    nav.serviceWorker.register('/sw.js').catch(() => {});
  });
};

/** True when the page is already running as an installed app. */
export const isInstalled = (nav = globalThis.navigator, match = globalThis.matchMedia) => {
  try {
    if (typeof match === 'function' && match('(display-mode: standalone)').matches) return true;
  } catch {
    /* matchMedia can throw in a locked-down webview */
  }
  return nav?.standalone === true;
};

/**
 * Hold the browser's install prompt so a button can show it. Returns an
 * unsubscribe. Browsers that never fire the event (iOS Safari) simply never
 * call `onPrompt`.
 */
export const listenForInstall = (onPrompt, target = globalThis.window) => {
  if (!target?.addEventListener) return () => {};
  let deferred = null;
  const onBefore = (event) => {
    event.preventDefault();
    deferred = event;
    onPrompt({
      prompt: async () => {
        if (!deferred) return 'unavailable';
        deferred.prompt();
        const choice = await deferred.userChoice;
        deferred = null;
        return choice?.outcome || 'dismissed';
      },
    });
  };
  target.addEventListener('beforeinstallprompt', onBefore);
  return () => target.removeEventListener('beforeinstallprompt', onBefore);
};
