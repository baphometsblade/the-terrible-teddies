import { supabase } from '@/utils/supabaseClient';
import { hasAnalyticsConsent } from './consent.js';
import { useGameStore } from '@/stores/gameStore';
import analytics from '@/utils/analytics';
import { noteFailure, noteSuccess } from './supabaseHealth.js';
import { isRetryableError, withRetry } from './retry.js';
import { startWebVitals } from './webVitals.js';

// Product analytics. No name, no email, no account id — the allowlist below
// is the entire payload. Nothing is sent unless VITE_PRODUCT_ANALYTICS is on
// and the cookie choice is "granted". Unset, or "0" / "off" / "false", this
// module never calls the analytics pipe.

export const FUNNEL = Object.freeze(['shop_view', 'pack_open', 'match_start', 'match_end']);

const EVENT_NAMES = new Set([...FUNNEL, 'funnel', 'web_vital']);
const TIERS = new Set(['regular', 'premium', 'legendary']);
const DIFFICULTIES = new Set(['easy', 'normal', 'hard']);
const METRICS = new Set(['LCP', 'INP', 'CLS', 'FCP', 'TTFB']);

export function productAnalyticsEnabled(env = import.meta.env, storage) {
  const raw = String(env?.VITE_PRODUCT_ANALYTICS ?? '').trim().toLowerCase();
  if (!raw || raw === '0' || raw === 'false' || raw === 'off') return false;
  return hasAnalyticsConsent(storage);
}

export function sanitizeProps(props) {
  const out = {};
  if (!props || typeof props !== 'object') return out;
  if (typeof props.tier === 'string' && TIERS.has(props.tier)) out.tier = props.tier;
  if (typeof props.won === 'boolean') out.won = props.won;
  if (typeof props.difficulty === 'string' && DIFFICULTIES.has(props.difficulty)) out.difficulty = props.difficulty;
  if (typeof props.tab === 'string' && /^[a-z]{1,16}$/.test(props.tab)) out.tab = props.tab;
  if (typeof props.step === 'string' && FUNNEL.includes(props.step)) out.step = props.step;
  if (Number.isInteger(props.step_index) && props.step_index >= 1 && props.step_index <= FUNNEL.length) {
    out.step_index = props.step_index;
  }
  if (typeof props.metric === 'string' && METRICS.has(props.metric)) out.metric = props.metric;
  if (typeof props.value === 'number' && Number.isFinite(props.value) && props.value >= 0 && props.value < 1e7) {
    out.value = props.value;
  }
  if (typeof props.over_budget === 'boolean') out.over_budget = props.over_budget;
  return out;
}

export function trackProduct(name, props) {
  if (!productAnalyticsEnabled() || !EVENT_NAMES.has(name)) return;
  analytics.trackEvent(name, sanitizeProps(props));
  const index = FUNNEL.indexOf(name);
  if (index >= 0) {
    analytics.trackEvent('funnel', sanitizeProps({ step: name, step_index: index + 1 }));
  }
}

export function eventsFromStoreChange(prev, next) {
  const events = [];
  if (!prev || !next) return events;
  const battles = Number(next.totalBattles) - Number(prev.totalBattles);
  if (battles === 1) {
    events.push({
      name: 'match_end',
      props: {
        won: Number(next.totalWins) > Number(prev.totalWins),
        difficulty: next.difficulty,
      },
    });
  }
  const tiers = [
    ['cardPacks', 'regular'],
    ['premiumPacks', 'premium'],
    ['legendaryPacks', 'legendary'],
  ];
  const dropped = tiers.filter(([key]) => Number(prev[key]) - Number(next[key]) === 1);
  const held = tiers.filter(([key]) => Number(next[key]) === Number(prev[key]));
  if (battles === 0 && dropped.length === 1 && held.length === 2) {
    events.push({ name: 'pack_open', props: { tier: dropped[0][1] } });
  }
  return events;
}

export function eventsFromScreen(prev, next, difficulty) {
  if (next === 'battle' && prev !== 'battle') {
    return [{ name: 'match_start', props: { difficulty } }];
  }
  return [];
}

/** A played match, counted for the staff desk. Not an analytics event: it carries no payload but a boolean, and only for a signed-in player. */
export async function logPlayedMatch(won) {
  try {
    const { data: { session } = {} } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    const result = await withRetry(
      () => supabase.rpc('log_played_match', { p_won: won === true }),
      { onFailure: noteFailure },
    );
    if (result?.error) {
      if (isRetryableError(result.error)) noteFailure();
      return;
    }
    noteSuccess();
  } catch {
    noteFailure();
  }
}

let installed = false;

/** Watch the store and the battle screen without editing either one. */
export function installProductObservers() {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  if (typeof analytics.trackShopView === 'function' && !analytics.trackShopView.__product) {
    const orig = analytics.trackShopView.bind(analytics);
    const wrapped = (tab) => {
      orig(tab);
      trackProduct('shop_view', { tab });
    };
    wrapped.__product = true;
    analytics.trackShopView = wrapped;
  }

  let prev = useGameStore.getState();
  useGameStore.subscribe((state) => {
    const events = eventsFromStoreChange(prev, state);
    prev = state;
    for (const event of events) {
      trackProduct(event.name, event.props);
      if (event.name === 'match_end') void logPlayedMatch(event.props.won);
    }
  });

  let screen = document.documentElement.dataset.screen || '';
  const watch = () => {
    const next = document.documentElement.dataset.screen || '';
    const events = eventsFromScreen(screen, next, useGameStore.getState().difficulty);
    screen = next;
    for (const event of events) trackProduct(event.name, event.props);
  };
  const observer = new MutationObserver(watch);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-screen'] });
}

export function armWebVitals() {
  startWebVitals(trackProduct);
}
