import { useState } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { FOCUS_OUTLINE } from '@/lib/focus';
import {
  EXPORT_FILENAME,
  accountActionMessage,
  clearLocalAccount,
  exportJson,
  isExportPayload,
} from '@/lib/accountData';
import { readConsent, writeConsent } from '@/lib/consent';
import { dropQueuedAnalytics, initializePostHog } from '@/utils/analytics';
import analytics from '@/utils/analytics';
import { armWebVitals } from '@/lib/productEvents';
import { withRetry } from '@/lib/retry';

const ACTION = `flex h-11 w-full items-center justify-center gap-2 rounded-xl font-display font-bold ${FOCUS_OUTLINE}`;

const download = (text) => {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = EXPORT_FILENAME;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

// Export and deletion for the signed-in account, plus the analytics choice
// so a player can change it after the banner has gone. Deletion is one
// request: it is not retried, because a lost response must not be read as
// "try the delete again" after the account is already gone.
const AccountData = () => {
  const [consent, setConsent] = useState(() => readConsent());
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [json, setJson] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [phrase, setPhrase] = useState('');

  const setChoice = (choice) => {
    writeConsent(choice);
    setConsent(choice);
    if (choice === 'granted') {
      initializePostHog();
      armWebVitals();
    } else {
      dropQueuedAnalytics();
      analytics.reset();
    }
  };

  const onExport = async () => {
    setBusy('export');
    setMessage('');
    const result = await withRetry(() => supabase.rpc('export_my_data'));
    setBusy('');
    if (result?.error || !isExportPayload(result?.data)) {
      setMessage(accountActionMessage(result?.error, 'The copy did not come back.'));
      return;
    }
    const text = exportJson(result.data);
    setJson(text);
    try { download(text); } catch { /* the text below is the copy they can select */ }
    setMessage('Your copy is ready. A file download has started, and the same text is below.');
  };

  const onDelete = async () => {
    if (phrase !== 'DELETE') return;
    setBusy('delete');
    setMessage('');
    const { error } = await supabase.rpc('delete_my_account');
    if (error) {
      setBusy('');
      setMessage(accountActionMessage(error, 'The account was not deleted. Nothing was changed.'));
      return;
    }
    try { await supabase.auth.signOut(); } catch { /* the session is already gone */ }
    clearLocalAccount();
    window.location.replace('/');
  };

  return (
    <section>
      <h3 className="label-caps mb-2.5 text-plush-300">Your data</h3>
      <div className="panel-glass space-y-3 rounded-xl p-4">
        <p className="text-sm leading-relaxed text-plush-100">
          Download what this account has stored, or delete the account. Deleting removes the profile and the cloud save. Payment records stay, with the account taken off them. The game on this device is cleared too.
        </p>
        <div>
          <p className="text-sm font-semibold text-plush-100">Analytics</p>
          <p className="mt-1 text-xs leading-snug text-plush-300">
            {consent === 'granted' ? 'Allowed on this device.' : consent === 'denied' ? 'Refused on this device.' : 'Not chosen yet.'}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" className={`${ACTION} btn-glass`} onClick={() => setChoice('granted')} aria-pressed={consent === 'granted'}>
              Allow
            </button>
            <button type="button" className={`${ACTION} btn-glass`} onClick={() => setChoice('denied')} aria-pressed={consent === 'denied'}>
              Refuse
            </button>
          </div>
        </div>
        <button type="button" className={`${ACTION} btn-glass`} onClick={onExport} disabled={busy === 'export'}>
          {busy === 'export' ? 'Preparing the copy…' : 'Download my data'}
        </button>
        {json && (
          <textarea
            readOnly
            value={json}
            aria-label="Your account data"
            className="h-32 w-full resize-y rounded-xl bg-night-950/80 p-3 text-xs leading-relaxed text-plush-100 ring-1 ring-inset ring-white/15"
          />
        )}
        {!confirming ? (
          <button
            type="button"
            onClick={() => { setConfirming(true); setPhrase(''); }}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-red-950/40 font-display font-bold text-red-200 ring-1 ring-inset ring-red-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          >
            Delete my account
          </button>
        ) : (
          <div className="rounded-xl bg-red-950/40 p-4 ring-1 ring-inset ring-red-400/40">
            <p className="mb-2 text-sm font-semibold text-red-100">This cannot be undone. Type DELETE to confirm.</p>
            <input
              type="text"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              aria-label="Type DELETE to confirm account deletion"
              autoComplete="off"
              className="mb-3 h-11 w-full rounded-xl bg-night-950/80 px-3 text-base font-semibold tracking-[0.12em] text-white ring-1 ring-inset ring-red-400/40 focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onDelete}
                disabled={phrase !== 'DELETE' || busy === 'delete'}
                className="flex h-11 flex-1 items-center justify-center rounded-xl bg-red-600 font-display font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy === 'delete' ? 'Deleting…' : 'Delete the account'}
              </button>
              <button type="button" className={`${ACTION} btn-glass flex-1`} onClick={() => { setConfirming(false); setPhrase(''); }}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {message && (
          <p role={message.startsWith('Your copy') ? 'status' : 'alert'} className="text-xs leading-snug text-plush-200">
            {message}
          </p>
        )}
      </div>
    </section>
  );
};

export default AccountData;
