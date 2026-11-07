import { useEffect, useState } from 'react';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { readConsent, writeConsent } from '@/lib/consent';
import { flagEnabled, loadFeatureFlags } from '@/lib/featureFlags';
import { dropQueuedAnalytics, initializePostHog } from '@/utils/analytics';
import analytics from '@/utils/analytics';
import { armWebVitals } from '@/lib/productEvents';

const BUTTON = `inline-flex h-11 items-center justify-center rounded-xl px-4 font-display text-base font-bold ${FOCUS_OUTLINE}`;

// Shown once the door has let the device in, until the device chooses.
// Not a modal: the game stays usable, and a battle hides the bar so it
// cannot sit on the cards. Analytics stay off until "Allow".
const ConsentNotice = () => {
  const [choice, setChoice] = useState(() => readConsent());
  const [bannerOn, setBannerOn] = useState(() => flagEnabled('consent_banner', true));
  const [inBattle, setInBattle] = useState(
    () => typeof document !== 'undefined' && document.documentElement.dataset.screen === 'battle',
  );

  useEffect(() => {
    let live = true;
    loadFeatureFlags().then(() => {
      if (live) setBannerOn(flagEnabled('consent_banner', true));
    });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const read = () => setInBattle(document.documentElement.dataset.screen === 'battle');
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-screen'] });
    return () => observer.disconnect();
  }, []);

  const visible = choice === 'unknown' && bannerOn && !inBattle;

  useEffect(() => {
    if (visible) document.documentElement.dataset.consent = 'open';
    else delete document.documentElement.dataset.consent;
    return () => { delete document.documentElement.dataset.consent; };
  }, [visible]);

  // A returning player who already allowed analytics: start them as the door
  // used to, now that the choice is on record.
  useEffect(() => {
    if (choice !== 'granted') return;
    initializePostHog();
    armWebVitals();
  }, [choice]);

  if (!visible) return null;

  const choose = (next) => {
    writeConsent(next);
    setChoice(next);
    if (next === 'granted') {
      initializePostHog();
      armWebVitals();
    } else {
      dropQueuedAnalytics();
      analytics.reset();
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/15 bg-night-950 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:items-center">
        <p id="consent-note" className="text-sm leading-snug text-plush-100">
          This game keeps its save on this device. If you allow it, we also count which parts of the bar get used — a match, the shop, a pack — with no name and no email. Refusing changes nothing you can play.
        </p>
        <div className="flex shrink-0 gap-2" role="group" aria-labelledby="consent-note">
          <button type="button" className={`btn-brass ${BUTTON}`} onClick={() => choose('granted')}>
            Allow
          </button>
          <button type="button" className={`btn-glass ${BUTTON}`} onClick={() => choose('denied')}>
            Refuse
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsentNotice;
