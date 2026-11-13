import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONSENT_KEY, consentRecord, hasAnalyticsConsent, parseConsent, writeConsent } from './consent';
import { LANDING, PUBLIC_DESCRIPTION, PUBLIC_OG_DESCRIPTION, PUBLIC_SITE_ORIGIN, PUBLIC_TITLE } from './publicCopy';
import { structuredData } from './structuredData';
import { isAdminPath, showPublicLanding } from './publicPaths';
import { RECOVERY_RESUME_KEY } from './authLanding';
import { DOOR_KEY, doorRecord } from './door';
import { backoffMs, isRetryableError, withRetry } from './retry';
import { eventsFromScreen, eventsFromStoreChange, productAnalyticsEnabled, sanitizeProps, trackProduct } from './productEvents';
import { flagEnabled, loadFeatureFlags, parseFlagRows, resetFlagsForTests } from './featureFlags';
import { accountActionMessage, clearLocalAccount, isExportPayload } from './accountData';
import { readSentryDsn } from './sentry';
import { scrubSentryEvent } from './sentryScrub';
import { overBudget, WEB_VITALS_BUDGET } from './webVitals';
import analytics from '@/utils/analytics';

vi.mock('@/utils/analytics', () => ({
  default: { trackEvent: vi.fn(), trackShopView: vi.fn() },
}));

const mem = (seed = {}) => {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    clear: () => data.clear(),
    dump: () => data,
  };
};

describe('consent', () => {
  it('treats anything it cannot read as not a yes', () => {
    expect(parseConsent(null)).toBe('unknown');
    expect(parseConsent('nope')).toBe('unknown');
    expect(parseConsent(JSON.stringify({ v: 2, analytics: true, at: 1 }))).toBe('unknown');
    expect(parseConsent(consentRecord('granted', 5))).toBe('granted');
    expect(parseConsent(consentRecord('denied', 5))).toBe('denied');
  });

  it('round-trips a choice and refuses a typo', () => {
    const storage = mem();
    expect(writeConsent('granted', 10, storage)).toBe(true);
    expect(hasAnalyticsConsent(storage)).toBe(true);
    expect(() => consentRecord('maybe', 1)).toThrow(RangeError);
  });
});

describe('public paths', () => {
  const ask = mem();
  const passed = mem({ [DOOR_KEY]: doorRecord('pass', 1) });

  it('shows the landing only before an answer, and not for a shortcut or a reset link', () => {
    expect(showPublicLanding({ href: 'https://terribleteddies.vercel.app/', storage: ask })).toBe(true);
    expect(showPublicLanding({ href: 'https://terribleteddies.vercel.app/', storage: passed })).toBe(false);
    expect(showPublicLanding({ href: 'https://terribleteddies.vercel.app/?action=battle', storage: ask })).toBe(false);
    expect(showPublicLanding({
      href: 'https://terribleteddies.vercel.app/#access_token=t&type=recovery',
      storage: ask,
    })).toBe(false);
    const session = mem({ [RECOVERY_RESUME_KEY]: JSON.stringify({ at: Date.now(), uid: null }) });
    expect(showPublicLanding({
      href: 'https://terribleteddies.vercel.app/',
      storage: ask,
      session,
    })).toBe(false);
  });

  it('knows the staff desk, with or without a trailing slash', () => {
    expect(isAdminPath('/admin')).toBe(true);
    expect(isAdminPath('/admin/')).toBe(true);
    expect(isAdminPath('/')).toBe(false);
  });
});

describe('retry', () => {
  it('waits longer each time, and stops at four seconds plus jitter', () => {
    expect(backoffMs(0, () => 0)).toBe(300);
    expect(backoffMs(1, () => 0)).toBe(600);
    expect(backoffMs(8, () => 0)).toBe(4000);
  });

  it('retries a dead network and does not retry a refusal', async () => {
    expect(isRetryableError({ message: 'Failed to fetch', status: 0 })).toBe(true);
    expect(isRetryableError({ code: 'PT403', status: 403 })).toBe(false);
    const fn = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch', status: 0 } })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });
    const result = await withRetry(fn, { sleep: () => Promise.resolve(), random: () => 0 });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(result.data).toEqual({ ok: true });
  });
});

describe('product events', () => {
  beforeEach(() => {
    analytics.trackEvent.mockClear();
    localStorage.setItem(CONSENT_KEY, consentRecord('granted', 0));
    vi.stubEnv('VITE_PRODUCT_ANALYTICS', '1');
  });

  it('is a no-op when the switch is off or consent is missing', () => {
    expect(productAnalyticsEnabled({ VITE_PRODUCT_ANALYTICS: '' }, mem({ [CONSENT_KEY]: consentRecord('granted', 0) }))).toBe(false);
    expect(productAnalyticsEnabled({ VITE_PRODUCT_ANALYTICS: 'off' }, mem({ [CONSENT_KEY]: consentRecord('granted', 0) }))).toBe(false);
    expect(productAnalyticsEnabled({ VITE_PRODUCT_ANALYTICS: '1' }, mem())).toBe(false);
  });

  it('sends only the allowlist, and a funnel step beside each of the four', () => {
    trackProduct('shop_view', { tab: 'gems', email: 'a@b.c', userId: 'u' });
    expect(analytics.trackEvent).toHaveBeenCalledWith('shop_view', { tab: 'gems' });
    expect(analytics.trackEvent).toHaveBeenCalledWith('funnel', { step: 'shop_view', step_index: 1 });
    expect(sanitizeProps({ tier: 'premium', won: false, difficulty: 'hard', tab: 'Gems', metric: 'LCP' }).tab).toBeUndefined();
  });

  it('reads a match end and a single pack from a store change, and a match start from the screen', () => {
    const prev = { totalBattles: 1, totalWins: 1, cardPacks: 2, premiumPacks: 0, legendaryPacks: 0, difficulty: 'normal' };
    expect(eventsFromStoreChange(prev, { ...prev, totalBattles: 2, totalWins: 1 })).toEqual([
      { name: 'match_end', props: { won: false, difficulty: 'normal' } },
    ]);
    expect(eventsFromStoreChange(prev, { ...prev, cardPacks: 1 })).toEqual([
      { name: 'pack_open', props: { tier: 'regular' } },
    ]);
    expect(eventsFromScreen('menu', 'battle', 'hard')).toEqual([
      { name: 'match_start', props: { difficulty: 'hard' } },
    ]);
    expect(eventsFromScreen('battle', 'battle', 'hard')).toEqual([]);
  });
});

describe('feature flags', () => {
  beforeEach(() => {
    resetFlagsForTests();
    localStorage.clear();
  });

  it('keeps well-formed booleans and drops the rest', () => {
    expect(parseFlagRows([
      { key: 'public_landing', enabled: false },
      { key: 'Bad', enabled: true },
      { key: 'consent_banner', enabled: 'yes' },
    ])).toEqual({ public_landing: false });
  });

  it('reads them through the retry helper and remembers a miss as the fallback', async () => {
    const client = {
      from: () => ({
        select: () => Promise.resolve({
          data: [{ key: 'public_landing', enabled: false }],
          error: null,
        }),
      }),
    };
    await loadFeatureFlags(client);
    expect(flagEnabled('public_landing', true)).toBe(false);
    expect(flagEnabled('missing', true)).toBe(true);
  });
});

describe('account data', () => {
  it('speaks a rate limit and a dead network in the house voice', () => {
    expect(accountActionMessage({ code: 'PT429', message: 'slow down' }, 'nope')).toMatch(/minute/);
    expect(accountActionMessage({ message: 'Failed to fetch' }, 'nope')).toMatch(/Nothing was changed/);
  });

  it('clears the device and keeps the door', () => {
    const local = mem({
      [DOOR_KEY]: doorRecord('pass', 1),
      'terrible-teddies-storage': '{}',
      'sb-test-auth-token': 'tok',
    });
    const session = mem({ reset: '1' });
    clearLocalAccount(local, session);
    expect(local.dump().get(DOOR_KEY)).toBe(doorRecord('pass', 1));
    expect(local.dump().has('terrible-teddies-storage')).toBe(false);
    expect(session.dump().size).toBe(0);
    expect(isExportPayload({ exported_at: '2026-11-07T00:00:00Z' })).toBe(true);
    expect(isExportPayload({ email: 'a@b.c' })).toBe(false);
  });
});

describe('sentry and vitals', () => {
  it('accepts only a real DSN and strips identity from an event', () => {
    expect(readSentryDsn({ VITE_SENTRY_DSN: '' })).toBe('');
    expect(readSentryDsn({ VITE_SENTRY_DSN: 'not-a-dsn' })).toBe('');
    expect(readSentryDsn({ VITE_SENTRY_DSN: 'https://abc123@o1.ingest.sentry.io/12' })).toBe('https://abc123@o1.ingest.sentry.io/12');
    const clean = scrubSentryEvent({
      user: { email: 'a@b.c' },
      request: { url: 'https://terribleteddies.vercel.app/admin?token=1', cookies: 'a', headers: { a: 1 } },
      breadcrumbs: [{ data: { url: 'https://x.test/path?q=1', email: 'a@b.c' } }],
    });
    expect(clean.user).toBeUndefined();
    expect(clean.request.cookies).toBeUndefined();
    expect(clean.request.url).toBe('https://terribleteddies.vercel.app/admin');
    expect(clean.breadcrumbs[0].data.email).toBeUndefined();
    expect(clean.breadcrumbs[0].data.url).toBe('https://x.test/path');
  });

  it('flags a metric that misses its budget', () => {
    expect(overBudget('LCP', WEB_VITALS_BUDGET.LCP + 1)).toBe(true);
    expect(overBudget('CLS', WEB_VITALS_BUDGET.CLS)).toBe(false);
  });
});

describe('the public document', () => {
  const root = resolve(process.cwd());
  const read = (rel) => readFileSync(resolve(root, rel), 'utf8');

  it('uses the public origin in the sitemap, the robots file and the structured data', () => {
    const html = read('index.html');
    expect(html).toContain(PUBLIC_TITLE);
    expect(html).toContain(PUBLIC_DESCRIPTION);
    expect(html).toContain(PUBLIC_OG_DESCRIPTION);
    expect(html).toContain(LANDING.lede);
    expect(html).toContain(LANDING.body);
    const script = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
    expect(JSON.parse(script[1])).toEqual(structuredData());
    expect(read('public/sitemap.xml')).toContain(`${PUBLIC_SITE_ORIGIN}/`);
    expect(read('public/sitemap.xml')).toContain(`${PUBLIC_SITE_ORIGIN}/terms`);
    expect(read('public/sitemap.xml')).toContain(`${PUBLIC_SITE_ORIGIN}/privacy`);
    expect(read('public/sitemap.xml')).not.toContain('/admin');
    expect(read('public/robots.txt')).toContain(`Sitemap: ${PUBLIC_SITE_ORIGIN}/sitemap.xml`);
    expect(read('public/robots.txt')).toMatch(/Disallow:\s*\/admin/);
  });

  it('hides source maps and budgets the same LCP and CLS that Lighthouse asserts', () => {
    const vite = read('vite.config.js');
    expect(vite).toMatch(/sourcemap:\s*"hidden"/);
    expect(vite).toContain('hide-source-maps');
    const lh = JSON.parse(read('lighthouserc.json'));
    const assertions = lh.ci.assert.assertions;
    expect(assertions['largest-contentful-paint'][1].maxNumericValue).toBe(WEB_VITALS_BUDGET.LCP);
    expect(assertions['cumulative-layout-shift'][1].maxNumericValue).toBe(WEB_VITALS_BUDGET.CLS);
    const bootstrap = read('supabase/bootstrap.sql');
    for (const name of ['feature_flags', 'admin_growth_stats', 'export_my_data', 'delete_my_account', 'log_played_match']) {
      expect(bootstrap).toContain(name);
    }
  });
});
