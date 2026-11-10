import { useEffect, useState } from 'react';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { ALL_CARDS } from '@/stores/gameStore';
import { safeName } from '@/lib/social/ladder';
import { cardsFromIds } from '@/lib/social/ghostDeck';
import { REPORT_REASONS } from '@/lib/social/room';
import { copyText } from '@/lib/social/victoryCard';
import { encodeQr } from '@/lib/social/qr';
import {
  PRESENCE_EVENT, friendInviteUrl, presenceLabel, setPresenceHidden, xIntentUrl,
} from '@/lib/social/friends';
import {
  blockPlayer, challengeFriend, createFriendInvite, findPlayers, loadFriendRequests,
  loadFriends, loadSuggestions, reasonText, removeFriend, reportPlayer, requestFriend,
  respondFriend, setAppearOffline,
} from '@/lib/social/client';
import { linkPlatform, loadAuthProviders, loadMyLinks, unlinkPlatform } from '@/lib/social/links';
import { subscribePresence } from '@/lib/social/presence';

const btn = `inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 font-display font-bold ${FOCUS_OUTLINE}`;
const field = `mt-1 h-11 w-full rounded-xl border border-white/10 bg-night-950/60 px-3 text-plush-100 ${FOCUS_OUTLINE}`;

const startGhost = (ticket, onStart, setNotice) => {
  const cards = cardsFromIds(ticket.deck, ALL_CARDS);
  if (cards.length < 8) {
    setNotice('That deck did not survive the night.');
    return;
  }
  onStart({
    matchId: ticket.matchId,
    rivalName: safeName(ticket.rivalName, 'A rival'),
    label: safeName(ticket.label, 'Saved deck'),
    cards,
  });
};

const QrCode = ({ text }) => {
  const modules = encodeQr(text);
  if (!modules) return null;
  const n = modules.length;
  const quiet = 4;
  const size = n + quiet * 2;
  const rects = [];
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (!modules[r][c]) continue;
      rects.push(<rect key={`${r}-${c}`} x={c + quiet} y={r + quiet} width="1" height="1" />);
    }
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Invite QR code"
      className="mt-3 h-44 w-44 rounded-lg bg-[#f5f0e6] p-1 text-[#120c1c]"
      shapeRendering="crispEdges"
    >
      {rects}
    </svg>
  );
};

const FriendsBar = ({ onStartBrawl }) => {
  const [ready, setReady] = useState(false);
  const [closed, setClosed] = useState(false);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [presence, setPresence] = useState({});
  const [providers, setProviders] = useState({ discord: false, x: false });
  const [linked, setLinked] = useState({ discord: false, x: false });
  const [handles, setHandles] = useState({ discord: '', x: '' });
  const [offline, setOffline] = useState(false);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState([]);
  const [invite, setInvite] = useState('');
  const [profile, setProfile] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const [pals, asks, ideas, mine, flags] = await Promise.all([
      loadFriends(),
      loadFriendRequests(),
      loadSuggestions(),
      loadMyLinks(),
      loadAuthProviders(),
    ]);
    if (pals.unavailable) {
      setClosed(true);
      setReady(true);
      return;
    }
    setClosed(false);
    setFriends(pals.rows || []);
    setRequests(asks.rows || []);
    setSuggestions(ideas.rows || []);
    setProviders(flags);
    if (mine.ok) {
      setHandles({
        discord: mine.discord?.linked ? mine.discord.name : '',
        x: mine.x?.linked ? mine.x.name : '',
      });
      setOffline(Boolean(mine.appear_offline));
      setLinked({ discord: Boolean(mine.discord?.linked), x: Boolean(mine.x?.linked) });
    }
    setReady(true);
  };

  useEffect(() => { refresh(); }, []);
  useEffect(() => subscribePresence(setPresence), []);

  const run = async (work) => {
    if (busy) return;
    setBusy(true);
    setNotice('');
    try { await work(); } finally { setBusy(false); }
  };

  const onChallenge = (row, mode) => run(async () => {
    const result = await challengeFriend(row.user_id, mode);
    if (mode === 'ghost') {
      if (!result.ticket) { setNotice(reasonText(result)); return; }
      startGhost(result.ticket, onStartBrawl, setNotice);
      return;
    }
    if (result.ok === false) { setNotice(reasonText(result)); return; }
    setNotice('Live brawl is booked. The room opens when the other bartender gets here.');
  });

  const onSearch = () => run(async () => {
    const result = await findPlayers(query);
    if (result.ok === false) { setNotice(reasonText(result)); setFound([]); return; }
    setFound(result.rows || []);
    if (!result.rows?.length) setNotice('Nobody by that name is in the bar.');
  });

  const onInvite = () => run(async () => {
    const result = await createFriendInvite();
    if (result.ok === false) { setNotice(reasonText(result)); return; }
    setInvite(result.code || '');
  });

  const onCopyInvite = () => run(async () => {
    const url = friendInviteUrl(invite);
    if (!url) return;
    const ok = await copyText(url);
    setNotice(ok ? 'Invite copied. Send it to someone with terrible judgment.' : url);
  });

  const onLink = (platform) => run(async () => {
    const result = await linkPlatform(platform);
    if (result.ok === false) setNotice(result.message || reasonText(result));
  });

  const onUnlink = (platform) => run(async () => {
    const result = await unlinkPlatform(platform);
    if (result.ok === false) { setNotice(result.message || reasonText(result)); return; }
    setNotice(platform === 'discord'
      ? 'Discord is off. The server matches went with it.'
      : 'X is off. The handle went with it.');
    await refresh();
  });

  const onOffline = () => run(async () => {
    const next = !offline;
    const result = await setAppearOffline(next);
    if (result.ok === false) { setNotice(reasonText(result)); return; }
    setPresenceHidden(next);
    setOffline(next);
    try { window.dispatchEvent(new Event(PRESENCE_EVENT)); } catch { /* no window in a test render */ }
  });

  if (!ready) return <p className="text-sm text-plush-200">Checking who is in.</p>;
  if (closed) return <p className="text-sm text-plush-200">Pals are not open on this server yet.</p>;

  const inviteUrl = friendInviteUrl(invite);
  const showDiscord = providers.discord || linked.discord;
  const showX = providers.x || linked.x;

  return (
    <section aria-labelledby="pals-heading" className="space-y-4">
      <h3 id="pals-heading" className="label-caps text-plush-300">Pals</h3>
      {notice && <p role="status" className="text-sm text-plush-200">{notice}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={offline}
          onClick={onOffline}
          disabled={busy}
          className={`${btn} ${offline ? 'btn-brass' : 'btn-glass'}`}
        >
          {offline ? 'Appearing offline' : 'Appear offline'}
        </button>
        <p className="text-sm text-plush-300">Let them wonder where you went.</p>
      </div>

      <div>
        <h4 className="text-sm font-bold text-plush-100">Logins</h4>
        {!showDiscord && !showX && (
          <p className="mt-2 text-sm text-plush-200">Discord and X are not on this bar yet.</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {showDiscord && (linked.discord ? (
            <button type="button" onClick={() => onUnlink('discord')} disabled={busy} className={`${btn} btn-glass`}>
              Unlink Discord{handles.discord ? ` (${handles.discord})` : ''}
            </button>
          ) : (
            <button type="button" onClick={() => onLink('discord')} disabled={busy} className={`${btn} btn-brass`}>
              Link Discord
            </button>
          ))}
          {showX && (linked.x ? (
            <button type="button" onClick={() => onUnlink('x')} disabled={busy} className={`${btn} btn-glass`}>
              Unlink X{handles.x ? ` (@${handles.x})` : ''}
            </button>
          ) : (
            <button type="button" onClick={() => onLink('x')} disabled={busy} className={`${btn} btn-glass`}>
              Link X
            </button>
          ))}
        </div>
        {showDiscord && (
          <p className="mt-2 text-xs text-plush-300">We keep a hash of shared servers, not the gossip.</p>
        )}
      </div>

      <div>
        <h4 className="text-sm font-bold text-plush-100">Bring someone</h4>
        <button type="button" onClick={onInvite} disabled={busy} className={`${btn} btn-brass mt-2`}>
          Write an invite
        </button>
        {inviteUrl && (
          <div className="mt-3">
            <p className="break-all text-xs text-plush-300">{inviteUrl}</p>
            <QrCode text={inviteUrl} />
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={onCopyInvite} disabled={busy} className={`${btn} btn-glass`}>
                Copy the invite
              </button>
              <a
                className={`${btn} btn-glass`}
                href={xIntentUrl(inviteUrl)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Share the invite on X
              </a>
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm text-plush-200" htmlFor="pal-search">
          A name, or a Discord handle
          <input
            id="pal-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={24}
            className={field}
          />
        </label>
        <button type="button" onClick={onSearch} disabled={busy} className={`${btn} btn-glass mt-2`}>
          Find them
        </button>
        <ul className="mt-2 space-y-2">
          {found.map((row) => (
            <li key={row.user_id} className="flex min-h-11 flex-wrap items-center gap-2 rounded-xl btn-glass px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-display font-bold text-white">{row.username}</span>
              {row.discord_name && <span className="text-xs text-plush-300">{row.discord_name}</span>}
              {row.relation === 'none' && (
                <button
                  type="button"
                  className={`${btn} btn-brass`}
                  disabled={busy}
                  onClick={() => run(async () => {
                    const result = await requestFriend(row.user_id);
                    setNotice(result.ok === false ? reasonText(result) : 'Asked. Try not to hover.');
                    if (result.ok !== false) await refresh();
                  })}
                >
                  Ask them to sit
                </button>
              )}
              {row.relation === 'friend' && <span className="text-xs text-plush-200">Already sat down</span>}
              {row.relation === 'pending_out' && <span className="text-xs text-plush-200">Asked</span>}
              {row.relation === 'pending_in' && <span className="text-xs text-plush-200">They asked</span>}
            </li>
          ))}
        </ul>
      </div>

      {suggestions.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-plush-100">Same servers. Same bad ideas.</h4>
          <ul className="mt-2 space-y-2">
            {suggestions.map((row) => (
              <li key={row.user_id} className="flex min-h-11 flex-wrap items-center gap-2 rounded-xl btn-glass px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display font-bold text-white">{row.username}</span>
                  <span className="block text-xs text-plush-300">
                    {row.shared} {row.shared === 1 ? 'server' : 'servers'} in common
                  </span>
                </span>
                <button
                  type="button"
                  className={`${btn} btn-brass`}
                  disabled={busy}
                  onClick={() => run(async () => {
                    const result = await requestFriend(row.user_id);
                    setNotice(result.ok === false ? reasonText(result) : 'Asked. They share a room already.');
                    if (result.ok !== false) await refresh();
                  })}
                >
                  Ask them to sit
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {requests.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-plush-100">At the door</h4>
          <ul className="mt-2 space-y-2">
            {requests.map((row) => (
              <li key={row.id} className="rounded-xl btn-glass px-3 py-2">
                <p className="truncate font-display font-bold text-white">{row.username}</p>
                {row.direction === 'in' ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={`${btn} btn-brass`}
                      disabled={busy}
                      onClick={() => run(async () => {
                        const result = await respondFriend(row.id, true);
                        setNotice(result.ok === false ? reasonText(result) : 'They said yes. Terrible judgment, the both of you.');
                        await refresh();
                      })}
                    >
                      Let them sit
                    </button>
                    <button
                      type="button"
                      className={`${btn} btn-glass`}
                      disabled={busy}
                      onClick={() => run(async () => {
                        await respondFriend(row.id, false);
                        setNotice('Not tonight.');
                        await refresh();
                      })}
                    >
                      Not tonight
                    </button>
                  </div>
                ) : <p className="text-xs text-plush-300">Waiting on them.</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h4 className="text-sm font-bold text-plush-100">Who sits with you</h4>
        {friends.length === 0 && <p className="mt-2 text-sm text-plush-200">No pals yet. The stool next to you is getting ideas.</p>}
        <ul className="mt-2 space-y-2">
          {friends.map((row) => (
            <li key={row.user_id}>
              <button
                type="button"
                onClick={() => setProfile(row)}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left btn-glass ${FOCUS_OUTLINE}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display font-bold text-white">{row.username}</span>
                  <span className="block truncate text-xs text-plush-300">
                    {presenceLabel(presence[row.user_id])}
                    {row.discord_name ? ` · ${row.discord_name}` : ''}
                    {row.x_name ? ` · @${row.x_name}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-plush-200">{row.tier}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {profile && (
        <div className="panel-glass rounded-xl p-3">
          <h4 className="font-display text-xl font-extrabold text-white">{safeName(profile.username, 'A pal')}</h4>
          <p className="mt-1 text-sm text-plush-200">{presenceLabel(presence[profile.user_id])}. {profile.tier}.</p>
          <div className="mt-3 flex flex-col gap-2">
            <button type="button" disabled={busy} onClick={() => onChallenge(profile, 'ghost')} className={`inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-2 text-center font-display font-bold whitespace-normal btn-brass ${FOCUS_OUTLINE}`}>
              Slide into their DMs. Well, their deck.
            </button>
            <button type="button" disabled={busy} onClick={() => onChallenge(profile, 'live')} className={`${btn} btn-glass w-full`}>
              Say it to their face
            </button>
            <button
              type="button"
              disabled={busy}
              className={`${btn} btn-glass`}
              onClick={() => run(async () => {
                await removeFriend(profile.user_id);
                setProfile(null);
                setNotice('Stool is free again. The follows stayed.');
                await refresh();
              })}
            >
              Stand up
            </button>
            <button
              type="button"
              disabled={busy}
              className={`${btn} btn-glass`}
              onClick={() => run(async () => {
                const result = await blockPlayer(profile.user_id);
                if (result.ok === false) { setNotice(reasonText(result)); return; }
                setProfile(null);
                setNotice('Blocked. They will not see you at the bar.');
                await refresh();
              })}
            >
              Block
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {REPORT_REASONS.map((reason) => (
              <button
                key={reason.id}
                type="button"
                disabled={busy}
                className={`${btn} btn-glass`}
                onClick={() => run(async () => {
                  const result = await reportPlayer(profile.user_id, reason.id);
                  setNotice(result.ok === false ? reasonText(result) : 'The bar has it. They do not get a copy.');
                })}
              >
                {reason.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default FriendsBar;
