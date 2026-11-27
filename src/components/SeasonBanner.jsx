import { useEffect, useId, useState } from 'react';
import { countdownMs, formatCountdown, opensInMs, refreshPackSeasons, seasonComingUp, seasonOnTheFloor } from '@/lib/seasons';
import { useSeasonSnapshot } from '@/hooks/useSeasonSnapshot';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { DOOR_BUTTON, DOOR_DUE, DOOR_KICKER, DOOR_ODDS, DOOR_UNKNOWN, DOOR_WAIT, doorClock } from '@/lib/seasonDoorCopy';

const BANNER = '/seasons/naughty-list-banner.webp';

/**
 * The party on the menu.
 *
 * An active season, or a staff preview, says it is on the floor. An upcoming
 * row counts down to the server's starts_at, from the server's clock plus
 * the time since that answer. The laptop's date is not read, and nothing
 * here grants, deals or boosts: a countdown that runs out only asks the
 * server again. Hidden when the server has no row to show, so an ordinary
 * night does not move the Battle button. The banner sits under that button.
 */
const SeasonBanner = ({ onOpen }) => {
  const snap = useSeasonSnapshot();
  const floor = seasonOnTheFloor(snap);
  const coming = seasonComingUp(snap);
  const season = floor || coming;
  const upcoming = Boolean(coming);
  const headingId = useId();
  const [elapsed, setElapsed] = useState(0);
  const [art, setArt] = useState(true);
  const seasonId = season?.id || '';
  const mode = season?.status || '';
  const serverNow = snap.serverNow;

  useEffect(() => {
    if (import.meta.env.MODE === 'test') return undefined;
    refreshPackSeasons();
    // A tab that slept past the door re-asks. The answer, not the wake-up
    // clock, is what can open the season.
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshPackSeasons();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (!seasonId) return undefined;
    const started = performance.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(performance.now() - started), 1000);
    return () => clearInterval(id);
  }, [seasonId, serverNow, mode]);

  const left = !season ? null : upcoming
    ? opensInMs(season, serverNow, elapsed)
    : countdownMs(season, serverNow, elapsed);

  const due = left === 0;
  useEffect(() => {
    // Hitting zero is a reason to ask again, never a reason to open locally.
    // A preview is a costume. While the server is still saying upcoming, ask
    // on a slow tick instead of once per answer: each answer carries a new
    // server_now, and treating that as a new question would poll in a loop.
    if (!due || !seasonId || mode === 'preview') return undefined;
    if (import.meta.env.MODE === 'test') return undefined;
    refreshPackSeasons();
    const id = setInterval(() => refreshPackSeasons(), 30_000);
    return () => clearInterval(id);
  }, [due, seasonId, mode]);

  if (!season) return null;

  const preview = mode === 'preview';
  const openClock = formatCountdown(left);
  const upcomingClock = left == null ? null : left <= 0 ? '' : formatCountdown(left);
  const state = upcoming ? 'upcoming' : preview ? 'preview' : 'active';

  return (
    <section
      className="relative z-10 mx-auto mt-4 w-full max-w-6xl overflow-hidden rounded-2xl panel-glass"
      aria-labelledby={headingId}
      data-season-state={state}
      style={{
        backgroundImage: art ? undefined : 'linear-gradient(90deg, rgba(127,29,29,0.35), rgba(6,78,59,0.28))',
      }}
    >
      {art && (
        <img
          src={BANNER}
          alt=""
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover ${upcoming ? 'opacity-25' : 'opacity-40'}`}
          onError={() => setArt(false)}
        />
      )}
      <div className="relative flex flex-col gap-3 bg-night-950/80 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="min-w-0 flex-1">
          <p className={`label-caps ${upcoming ? 'text-brass-200' : 'text-red-200'}`}>
            {upcoming ? DOOR_KICKER : 'Limited'}
          </p>
          <h2 id={headingId} className="font-display text-xl font-extrabold leading-tight text-white">{season.name}</h2>
          {upcoming ? (
            <>
              {upcomingClock ? (
                <p className="font-display text-lg font-extrabold tabular-nums leading-tight text-brass-200" data-season-clock>
                  {doorClock(upcomingClock)}
                </p>
              ) : (
                <p className="text-sm leading-snug text-plush-200">{upcomingClock === '' ? DOOR_DUE : DOOR_UNKNOWN}</p>
              )}
              {upcomingClock ? (
                <p className="text-sm leading-snug text-plush-200">{DOOR_WAIT} {DOOR_ODDS}</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm leading-snug text-plush-200">
              {preview
                ? 'Preview. Packs still wait for the server.'
                : openClock
                  ? `On the floor for ${openClock}.`
                  : 'On the floor.'}
              {' '}
              Same odds in every pack.
            </p>
          )}
        </div>
        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            className={`${upcoming ? 'btn-glass' : 'btn-brass'} h-11 w-full shrink-0 rounded-xl px-4 font-display text-sm font-bold sm:w-auto ${FOCUS_OUTLINE}`}
          >
            {upcoming ? DOOR_BUTTON : 'The Naughty List'}
          </button>
        )}
      </div>
    </section>
  );
};

export default SeasonBanner;
