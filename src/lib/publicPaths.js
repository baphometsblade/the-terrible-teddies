import { landedFromAuthLink } from './authLanding.js';
import { readDoor } from './door.js';

// Which address is the staff desk. A trailing slash is the same page.
export function isAdminPath(pathname) {
  const path = String(pathname ?? '/').replace(/\/+$/, '') || '/';
  return path === '/admin';
}

const storageOf = (storage) => {
  if (storage !== undefined) return storage;
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

/**
 * The SFW marketing page stands in front of the age door, and only there.
 * A device that already answered, a home-screen shortcut (?action=), and a
 * password-reset link go straight to the door so those arrivals are not
 * asked to read a poster first.
 */
export function showPublicLanding({ href, storage } = {}) {
  if (readDoor(storageOf(storage)) !== 'ask') return false;
  const address = String(href ?? (typeof window !== 'undefined' ? window.location.href : '/'));
  if (landedFromAuthLink(address)) return false;
  try {
    const url = new URL(address, 'https://terribleteddies.vercel.app');
    if (url.searchParams.has('action')) return false;
  } catch {
    return true;
  }
  return true;
}
