import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

// How long the plain bouncing bear is allowed to stand alone before it starts
// explaining itself, and before it offers a way out.
export const HINT_AFTER_MS = 6000;
export const RETRY_AFTER_MS = 20000;

// The gate every player passes through while supabase-js resolves the stored
// session. Normally that is a few milliseconds off localStorage — but a
// returning player's access token has expired (they last an hour), so resolving
// it means a network refresh, and when that refresh cannot complete supabase-js
// retries with a back-off before giving up.
//
// Measured with the backend unreachable and an expired stored token: 8 requests
// over roughly 50 seconds, the whole time showing nothing but a bouncing bear,
// and then the login screen — so the player waits without explanation and is
// finally told, in effect, that they are logged out. (It does recover on its
// own if the network returns mid-retry, which is why this waits rather than
// bailing out early.)
//
// Nothing here shortens the wait; supabase-js owns that. What it changes is
// that the wait stops being silent.
const BootScreen = () => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - started), 1000);
    return () => clearInterval(id);
  }, []);

  const slow = elapsed >= HINT_AFTER_MS;
  const stuck = elapsed >= RETRY_AFTER_MS;

  return (
    <div className="min-h-screen bg-night-900 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <motion.div
          animate={{ y: [0, -20, 0] }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="text-6xl mb-4"
        >
          🧸
        </motion.div>
        <div className="text-white text-xl">Loading Terrible Teddies...</div>

        {/* Announced rather than just drawn: a player who cannot see the screen
            gets the same "it's still trying" information as one who can. */}
        <div aria-live="polite" className="mt-4">
          {slow && (
            <p className="text-plush-300 text-sm">
              Still trying to reach the server. Check your connection — we&apos;ll keep
              retrying.
            </p>
          )}
          {stuck && (
            <button
              onClick={() => window.location.reload()}
              className="mt-4 bg-brass-500 hover:bg-brass-400 text-night-950 font-bold px-5 py-2 rounded-lg transition-colors"
            >
              Reload
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BootScreen;
