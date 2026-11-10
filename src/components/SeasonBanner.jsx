import { useEffect, useRef, useState } from 'react';
import { countdownMs, formatCountdown, refreshPackSeasons, seasonOnTheFloor } from '@/lib/seasons';
import { useSeasonSnapshot } from '@/hooks/useSeasonSnapshot';
import { FOCUS_OUTLINE } from '@/lib/focus';

const BANNER = '/seasons/naughty-list-banner.webp';

/**
 * The party on the menu. Hidden until a season is active or a preview is
 * set, so the Battle button's place above the fold does not move on an
 * ordinary night. The countdown is anchored to the server's clock.
 */
const SeasonBanner = ({ onOpen }) => {
  const snap = useSeasonSnapshot();
  const season = seasonOnTheFloor(snap);
  const [elapsed, setElapsed] = useState(0);
  const [art, setArt] = useState(true);
  const asked = useRef(false);
  const seasonId = season?.id || '';
  const serverNow = snap.serverNow;

  useEffect(() => {
    if (import.meta.env.MODE === 'test') return undefined;
    refreshPackSeasons();
    return undefined;
  }, []);

  useEffect(() => {
    if (!seasonId) return undefined;
    const started = performance.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(performance.now() - started), 1000);
    return () => clearInterval(id);
  }, [seasonId, serverNow]);

  const left = season ? countdownMs(season, serverNow, elapsed) : null;
  useEffect(() => {
    asked.current = false;
  }, [seasonId, serverNow]);
  useEffect(() => {
    if (left !== 0 || !season || season.preview || asked.current) return undefined;
    asked.current = true;
    refreshPackSeasons();
    return undefined;
  }, [left, season]);

  if (!season) return null;
  const clock = formatCountdown(left);

  return (
    <section
      className="relative z-10 mx-auto mt-4 w-full max-w-6xl overflow-hidden rounded-2xl panel-glass"
      aria-label={season.name}
      style={{
        backgroundImage: art ? undefined : 'linear-gradient(90deg, rgba(127,29,29,0.35), rgba(6,78,59,0.28))',
      }}
    >
      {art && (
        <img
          src={BANNER}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
          onError={() => setArt(false)}
        />
      )}
      <div className="relative flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="label-caps text-red-200">Limited</p>
          <h2 className="font-display text-xl font-extrabold leading-tight text-white">{season.name}</h2>
          <p className="text-sm text-plush-200">
            {season.preview
              ? 'Preview. Packs still wait for the server.'
              : clock
                ? `On the floor for ${clock}.`
                : 'On the floor.'}
            {' '}
            Same odds in every pack.
          </p>
        </div>
        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            className={`btn-brass h-11 shrink-0 rounded-xl px-4 font-display text-sm font-bold ${FOCUS_OUTLINE}`}
          >
            The Naughty List
          </button>
        )}
      </div>
    </section>
  );
};

export default SeasonBanner;
