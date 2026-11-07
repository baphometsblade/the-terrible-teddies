import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { flagEnabled, loadFeatureFlags } from '@/lib/featureFlags';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { SCREEN_PAD } from '@/lib/safeArea';
import { withRetry } from '@/lib/retry';
import { accountActionMessage } from '@/lib/accountData';

const LINK = `inline-flex min-h-11 items-center underline underline-offset-4 decoration-brass-300/70 ${FOCUS_OUTLINE}`;
const BUTTON = `btn-glass inline-flex h-11 items-center justify-center rounded-xl px-4 font-display text-base font-bold ${FOCUS_OUTLINE}`;

const STATS = [
  ['signups', 'Accounts'],
  ['dau', 'Played in the last day'],
  ['matches_today', 'Matches today'],
  ['matches', 'Matches, all time'],
];

const asCount = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
};

const AdminDashboard = () => {
  const { session, loading } = useSupabaseAuth();
  const [phase, setPhase] = useState('checking');
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [ticket, setTicket] = useState(0);

  useEffect(() => {
    document.title = 'Staff desk · Terrible Teddies';
    document.documentElement.dataset.content = 'sfw';
    document.getElementById('initial-loader')?.classList.add('to-app');
  }, []);

  useEffect(() => {
    if (loading) return undefined;
    let live = true;
    const run = async () => {
      await loadFeatureFlags();
      if (!live) return;
      if (!flagEnabled('admin_dashboard', true)) {
        setPhase('closed');
        return;
      }
      if (!session?.user?.id) {
        setPhase('signed-out');
        return;
      }
      const membership = await supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!live) return;
      if (membership.error) {
        const missing = membership.error.code === '42P01' || membership.error.code === 'PGRST205';
        setPhase(missing ? 'unready' : 'error');
        setError(missing ? '' : accountActionMessage(membership.error, 'The staff desk could not be opened.'));
        return;
      }
      if (!membership.data) {
        setPhase('forbidden');
        return;
      }
      const result = await withRetry(() => supabase.rpc('admin_growth_stats'));
      if (!live) return;
      if (result?.error || !result?.data) {
        setPhase('error');
        setError(accountActionMessage(result?.error, 'The counts did not load.'));
        return;
      }
      setStats(result.data);
      setPhase('ready');
    };
    run();
    return () => { live = false; };
  }, [loading, session, ticket]);

  const refresh = () => {
    setPhase('checking');
    setError('');
    setStats(null);
    setTicket((n) => n + 1);
  };

  return (
    <div className={`relative min-h-screen supports-[height:100dvh]:min-h-dvh bar-backdrop text-plush-100 ${SCREEN_PAD}`}>
      <div className="fixed inset-0 grain pointer-events-none" aria-hidden="true" />
      <main data-screen-root="admin" className="relative z-10 mx-auto w-full max-w-xl py-8">
        <p className="label-caps text-brass-300">Staff only</p>
        <h1 tabIndex={-1} className="mt-2 font-display text-4xl font-extrabold text-white focus:outline-none">Staff desk</h1>
        <p className="mt-3 text-sm leading-relaxed text-plush-200">Counts only. No names, no emails, no saves.</p>

        {phase === 'checking' && <p role="status" className="mt-6 text-sm text-plush-200">Checking the desk…</p>}
        {phase === 'closed' && <p className="panel-glass mt-6 p-5 text-sm">The staff desk is closed.</p>}
        {phase === 'signed-out' && (
          <p className="panel-glass mt-6 p-5 text-sm">Sign in on the main floor, then open this desk again.</p>
        )}
        {phase === 'forbidden' && <p className="panel-glass mt-6 p-5 text-sm">This desk is for staff.</p>}
        {phase === 'unready' && (
          <p className="panel-glass mt-6 p-5 text-sm">The staff desk is not set up on this server yet.</p>
        )}
        {phase === 'error' && <p role="alert" className="panel-glass mt-6 p-5 text-sm text-amber-200">{error}</p>}

        {phase === 'ready' && stats && (
          <dl className="panel-glass mt-6 divide-y divide-white/10">
            {STATS.map(([key, label]) => {
              const count = asCount(stats[key]);
              return (
                <div key={key} className="flex items-baseline justify-between gap-4 px-5 py-4">
                  <dt className="text-sm text-plush-200">{label}</dt>
                  <dd className="font-display text-3xl font-extrabold text-white">{count == null ? '—' : count.toLocaleString('en-US')}</dd>
                </div>
              );
            })}
          </dl>
        )}

        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3">
          {phase === 'error' && (
            <button type="button" className={BUTTON} onClick={refresh}>Try again</button>
          )}
          <a className={LINK} href="/">Back to the bar</a>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
