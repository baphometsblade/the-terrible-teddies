// Send one outbox row. No Deno and no web-push import: the edge function
// passes those in, and the unit test passes fakes. A 404 or 410 means the
// browser threw the subscription away, so it is deleted. Anything else is
// left for the next attempt.

const gone = (error) => {
  const code = Number(error?.statusCode ?? error?.status);
  return code === 404 || code === 410;
};

/**
 * @param {{ id: string, user_id: string, title: string, body: string, url?: string }} record
 * @param {{ listSubscriptions: Function, send: Function, dropSubscription: Function, markSent: Function }} ctx
 */
export async function deliverOutbox(record, ctx) {
  if (!record?.id || !record.user_id) return { sent: 0, dropped: 0, reason: 'missing' };
  const subs = await ctx.listSubscriptions(record.user_id);
  const payload = JSON.stringify({
    title: record.title || 'The bar',
    body: record.body || '',
    url: record.url || '/',
  });
  let sent = 0;
  let dropped = 0;
  for (const sub of subs || []) {
    if (!sub?.endpoint || !sub.p256dh || !sub.auth) continue;
    try {
      await ctx.send(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
      sent += 1;
    } catch (error) {
      if (gone(error)) {
        await ctx.dropSubscription(sub.endpoint);
        dropped += 1;
      }
    }
  }
  await ctx.markSent(record.id, sent);
  return { sent, dropped };
}

/** The body a Database Webhook or a direct call may post. */
export const outboxFromRequest = (body) => {
  if (!body || typeof body !== 'object') return null;
  if (body.record && body.record.user_id && body.record.id) return body.record;
  if (body.user_id && body.id && body.title) return body;
  return null;
};
