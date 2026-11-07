import { describe, it, expect } from 'vitest';
import {
  isTransportFailure,
  playerFacingError,
  readOnline,
  noticeForTransition,
  OFFLINE_NOTICE,
  ONLINE_NOTICE,
} from './network';

describe('transport failures', () => {
  it('recognises the browser’s fetch failures and a retryable auth error', () => {
    expect(isTransportFailure(new TypeError('Failed to fetch'))).toBe(true);
    expect(isTransportFailure({ name: 'TypeError', message: 'Load failed' })).toBe(true);
    expect(isTransportFailure({ name: 'AuthRetryableFetchError', message: 'offline' })).toBe(true);
    expect(isTransportFailure({ message: 'NetworkError when attempting to fetch resource.' })).toBe(true);
  });

  it('leaves timeouts, server sentences and programming errors alone', () => {
    expect(isTransportFailure({ name: 'AbortError', message: 'The operation was aborted.' })).toBe(false);
    expect(isTransportFailure({ name: 'Error', message: 'You already have the Starter pack', status: 409 })).toBe(false);
    expect(isTransportFailure(new TypeError('cards.find is not a function'))).toBe(false);
    expect(isTransportFailure(null)).toBe(false);
    expect(isTransportFailure('Failed to fetch')).toBe(false);
  });

  it('rewrites only a transport failure, and keeps a server message', () => {
    expect(playerFacingError(new TypeError('Failed to fetch'), 'Please try again.')).toBe(
      'Couldn’t reach the server. Nothing was changed.',
    );
    expect(playerFacingError({ message: 'Checkout is taking too long to start.' }, 'Please try again.')).toBe(
      'Checkout is taking too long to start.',
    );
    expect(playerFacingError({}, 'Please try again.')).toBe('Please try again.');
  });
});

describe('connectivity notices', () => {
  it('reads online as the default when the browser has not said otherwise', () => {
    expect(typeof readOnline()).toBe('boolean');
  });

  it('announces offline at boot, and never “back online” for a page that loaded online', () => {
    expect(noticeForTransition(true, false, { boot: true })).toBe(OFFLINE_NOTICE);
    expect(noticeForTransition(true, true, { boot: true })).toBeNull();
  });

  it('announces a real change, and stays quiet when nothing changed', () => {
    expect(noticeForTransition(true, false)).toEqual(OFFLINE_NOTICE);
    expect(noticeForTransition(false, true)).toEqual(ONLINE_NOTICE);
    expect(noticeForTransition(false, false)).toBeNull();
    expect(OFFLINE_NOTICE.lingerMs).toBe(0);
    expect(ONLINE_NOTICE.lingerMs).toBeGreaterThan(0);
  });
});
