// Opt-in Web Push. Permission is requested only when the player turns pings
// on. Nothing here runs at load. The public VAPID key is not a secret; the
// private key stays in the send-push function.

import { supabase } from '../supabase.js';
import { isInstalled } from '../pwa.js';
import { iosNeedsHomeScreen } from './policy.js';

export const vapidPublicKey = () => String(import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim();

export const pushConfigured = () => vapidPublicKey().length > 20;

const urlBase64ToUint8Array = (value) => {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
};

export const browserCanPush = () => {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (!navigator.serviceWorker || !('PushManager' in window)) return false;
  return true;
};

export const needsHomeScreen = () => {
  if (typeof navigator === 'undefined') return false;
  return iosNeedsHomeScreen(navigator.userAgent, isInstalled());
};

const tzOffsetMinutes = () => -new Date().getTimezoneOffset();

export const loadNotificationPrefs = async () => {
  const { data, error } = await supabase.rpc('my_notification_prefs');
  if (error || !data || data.ok === false) return { ok: false, reason: 'unavailable' };
  return data;
};

export const saveNotificationPrefs = async (prefs) => {
  const { data, error } = await supabase.rpc('set_notification_prefs', {
    p_enabled: Boolean(prefs.enabled),
    p_friends: prefs.friendsOnline !== false,
    p_challenges: prefs.challenges !== false,
    p_turn: prefs.yourTurn !== false,
    p_quiet: prefs.quietEnabled !== false,
    p_start: Number.isInteger(prefs.quietStart) ? prefs.quietStart : 2,
    p_end: Number.isInteger(prefs.quietEnd) ? prefs.quietEnd : 8,
    p_tz: tzOffsetMinutes(),
  });
  if (error) return { ok: false, reason: 'unavailable' };
  return data && typeof data === 'object' ? data : { ok: false, reason: 'unavailable' };
};

export async function enablePushSubscription() {
  if (needsHomeScreen()) return { ok: false, reason: 'install' };
  if (!pushConfigured() || !browserCanPush()) return { ok: false, reason: 'unsupported' };
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey()),
  });
  const json = subscription.toJSON();
  const { data, error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
  });
  if (error) return { ok: false, reason: 'unavailable' };
  return data && data.ok ? { ok: true, endpoint: json.endpoint } : (data || { ok: false });
}

export async function disablePushSubscription() {
  if (!browserCanPush() || !navigator.serviceWorker) return { ok: true };
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  const subscription = await registration?.pushManager?.getSubscription();
  const endpoint = subscription?.endpoint || '';
  if (subscription) await subscription.unsubscribe().catch(() => {});
  if (!endpoint) return { ok: true };
  await supabase.rpc('delete_push_subscription', { p_endpoint: endpoint });
  return { ok: true };
}
