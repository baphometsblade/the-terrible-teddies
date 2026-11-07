import { useEffect, useState } from 'react';
import { noticeForTransition, readOnline } from '@/lib/network';

// A status line, not a toast. Toasts are one at a time and leave on a timer;
// being offline is a fact that should stay until it is no longer true, and
// it must not take the spot from "Not enough energy". It takes no taps
// (pointer-events: none) so it can sit over the bottom edge without killing
// the control under it. No motion: it is a state, not an entrance.
const OfflineNotice = () => {
  const [notice, setNotice] = useState(() => noticeForTransition(true, readOnline(), { boot: true }));

  useEffect(() => {
    let previous = readOnline();
    let linger = 0;
    const show = (next) => {
      const note = noticeForTransition(previous, next);
      previous = next;
      if (!note) return;
      setNotice(note);
      window.clearTimeout(linger);
      linger = note.lingerMs > 0 ? window.setTimeout(() => setNotice(null), note.lingerMs) : 0;
    };
    const onOffline = () => show(false);
    const onOnline = () => show(true);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.clearTimeout(linger);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  if (!notice) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[45] flex justify-center px-4">
      <p
        role="status"
        className="max-w-sm rounded-full bg-night-950 px-4 py-2 text-center text-sm font-semibold leading-snug text-plush-100 ring-1 ring-inset ring-white/20"
      >
        {notice.text}
      </p>
    </div>
  );
};

export default OfflineNotice;
