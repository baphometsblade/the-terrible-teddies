import { useEffect, useState } from 'react';
import { dismissOutage, outageActive, subscribeHealth } from '@/lib/supabaseHealth';
import { readOnline } from '@/lib/network';
import { FOCUS_OUTLINE } from '@/lib/focus';

// The device is online and the backend is not. The offline line already
// covers a phone with no signal; this one is the club's books specifically,
// and it stays until a later call succeeds or the player sends it away.
const BackendNotice = () => {
  const [open, setOpen] = useState(() => outageActive() && readOnline());

  useEffect(() => subscribeHealth(() => {
    setOpen(outageActive() && readOnline());
  }), []);

  useEffect(() => {
    const on = () => { if (!readOnline()) setOpen(false); };
    window.addEventListener('offline', on);
    window.addEventListener('online', on);
    return () => {
      window.removeEventListener('offline', on);
      window.removeEventListener('online', on);
    };
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 top-[calc(0.5rem+env(safe-area-inset-top))] z-30 flex justify-center px-4">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl bg-night-950 px-4 py-2 ring-1 ring-inset ring-white/20" role="status">
        <p className="text-sm font-semibold leading-snug text-plush-100">
          The club&apos;s books aren&apos;t answering. You can keep playing on this device.
        </p>
        <button
          type="button"
          onClick={() => { dismissOutage(); setOpen(false); }}
          className={`btn-glass inline-flex h-11 shrink-0 items-center justify-center rounded-xl px-3 font-display text-sm font-bold ${FOCUS_OUTLINE}`}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default BackendNotice;
