import { describe, it, expect } from 'vitest';
import { sentryEnabled, sentryRelease, sentryEnvironment, SENTRY_TEST_PARAM } from './sentry';
import { redactText, scrubSentryEvent } from './sentryScrub';

const DSN = 'https://abc123@o1.ingest.us.sentry.io/12';
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

describe('sentry redaction', () => {
  it('replaces JWTs, bearer tokens, secret pairs and emails in free text', () => {
    expect(redactText(`token ${JWT} failed`)).toBe('token [jwt] failed');
    expect(redactText('Authorization: Bearer abcdefghijklmnop')).not.toContain('abcdefghijklmnop');
    expect(redactText('sent Bearer abcdefghijklmnop')).toBe('sent Bearer [redacted]');
    expect(redactText('POST /token?refresh_token=r3fr3shv4lue&x=1')).toBe('POST /token?refresh_token=[redacted]&x=1');
    expect(redactText('{"apikey":"sb_publishable_123","ok":1}')).toBe('{"apikey":"[redacted]","ok":1}');
    expect(redactText('no account for mark.w+tt@example.co.uk')).toBe('no account for [email]');
    expect(redactText('Cannot read properties of undefined')).toBe('Cannot read properties of undefined');
  });

  it('scrubs every place an event carries text, and drops identity', () => {
    const out = scrubSentryEvent({
      user: { id: 'u', email: 'a@b.co', ip_address: '1.2.3.4' },
      server_name: 'host',
      message: 'login failed for a@b.co',
      exception: { values: [{ type: 'Error', value: `bad jwt ${JWT}`, stacktrace: { frames: [{ function: 'f' }] } }] },
      request: { url: 'https://terribleteddies.vercel.app/?access_token=x#y', headers: { Authorization: 'Bearer x' }, query_string: 'a=1' },
      extra: { nested: { email: 'a@b.co', note: 'from a@b.co', authorization: 'Bearer zzzzzzzzzz' } },
      contexts: { state: { refresh_token: 'r' } },
      breadcrumbs: [
        { category: 'fetch', data: { url: 'https://p.supabase.co/rest/v1/players?user_id=eq.1', method: 'GET' } },
        { category: 'console', message: `sent ${JWT}` },
        { category: 'navigation', data: { from: '/?code=abc', to: '/duel/XYZ?ref=1' } },
      ],
      spans: [{ description: 'GET https://p.supabase.co/rest/v1/players?user_id=eq.1', data: { 'http.url': 'https://p.supabase.co/x?apikey=k' } }],
    });
    expect(out.user).toBeUndefined();
    expect(out.server_name).toBeUndefined();
    expect(out.message).toBe('login failed for [email]');
    expect(out.exception.values[0].value).toBe('bad jwt [jwt]');
    expect(out.exception.values[0].stacktrace.frames[0].function).toBe('f');
    expect(out.request).toEqual({ url: 'https://terribleteddies.vercel.app/' });
    expect(out.extra.nested).toEqual({ note: 'from [email]' });
    expect(out.contexts.state).toEqual({});
    expect(out.breadcrumbs[0].data).toEqual({ url: 'https://p.supabase.co/rest/v1/players', method: 'GET' });
    expect(out.breadcrumbs[1].message).toBe('sent [jwt]');
    expect(out.breadcrumbs[2].data).toEqual({ from: 'https://terribleteddies.vercel.app/', to: 'https://terribleteddies.vercel.app/duel/XYZ' });
    expect(out.spans[0].description).toBe('GET https://p.supabase.co/rest/v1/players');
    expect(out.spans[0].data['http.url']).toBe('https://p.supabase.co/x?apikey=[redacted]');
    expect(JSON.stringify(out)).not.toMatch(/a@b\.co|eyJ|Bearer x/);
  });
});

describe('sentry gating and tags', () => {
  it('reports only from a production build with a real DSN', () => {
    expect(sentryEnabled({ PROD: true, VITE_SENTRY_DSN: DSN })).toBe(true);
    expect(sentryEnabled({ PROD: false, VITE_SENTRY_DSN: DSN })).toBe(false);
    expect(sentryEnabled({ PROD: true, VITE_SENTRY_DSN: '' })).toBe(false);
    expect(sentryEnabled({ PROD: true, VITE_SENTRY_DSN: 'nope' })).toBe(false);
  });

  it('tags the release and environment the build baked in', () => {
    expect(sentryRelease({ VITE_SENTRY_RELEASE: 'terrible-teddies@abc' })).toBe('terrible-teddies@abc');
    expect(sentryRelease({ VITE_SENTRY_RELEASE: '' })).toBeUndefined();
    expect(sentryEnvironment({ VITE_SENTRY_ENVIRONMENT: 'preview' })).toBe('preview');
    expect(sentryEnvironment({})).toBe('production');
    expect(SENTRY_TEST_PARAM).toBe('tt-sentry-test');
  });
});
