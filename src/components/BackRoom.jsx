import { useEffect, useState } from 'react';
import { DoorOpen } from 'lucide-react';
import { useGameStore } from '../stores/gameStore';
import { displayEvent } from '@/lib/houseEvents';
import { weekKeyOf } from '@/lib/questReroll';
import { crawlBoard } from '@/lib/convenience';
import { crawlFacing } from '@/lib/barCrawl';
import { useVisibleSeasons } from '@/hooks/useSeasonSnapshot';
import { questReady, questState, questsFor } from '@/lib/seasonQuests';
import { catchUpFor } from '@/lib/catchUp';
import { storyChapters } from '@/lib/storyCampaign';
import { LEVEL_TRACK, levelMark } from '@/lib/levelTrack';
import { PLAQUES } from '@/lib/plaques';
import { houseUnlocks } from '@/lib/milestones';
import { isRetentionMark } from '@/lib/retentionMarks';
import { claimRetentionMark } from '@/utils/supabaseClient';
import { useDialog } from '@/hooks/useDialog';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { SCRIM_PAD } from '@/lib/safeArea';
import { DialogClose } from '@/components/ui/game-chrome';

const noteMark = (mark) => {
  if (isRetentionMark(mark)) claimRetentionMark(mark);
};

const Block = ({ title, children }) => (
  <section className="panel-glass rounded-2xl p-4">
    <h3 className="font-display text-lg font-extrabold leading-tight text-white">{title}</h3>
    {children}
  </section>
);

const Action = ({ children, onClick, brass = false, pressed = false }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={pressed ? 'true' : undefined}
    className={`${brass ? 'btn-brass' : 'btn-glass'} mt-3 h-11 rounded-xl px-4 font-display text-sm font-bold ${FOCUS_OUTLINE}`}
  >
    {children}
  </button>
);

const BackRoom = ({ onClose }) => {
  const dialogRef = useDialog(onClose);
  const store = useGameStore();
  // The crawl reads this week's counters. A week that turned while the menu
  // sat open still has last week's numbers until the period sync runs.
  useEffect(() => { useGameStore.getState().syncPeriods(); }, []);
  const [said, setSaid] = useState('');
  const now = new Date();
  const seasons = useVisibleSeasons();
  const live = displayEvent(now, seasons);
  const weekKey = weekKeyOf(now);
  const party = seasons.find((season) => season.status === 'active' || season.status === 'preview') || null;
  const crawl = crawlFacing(crawlBoard(store, now), party);
  const quests = party ? questsFor(party.id) : [];
  const questProgress = questState(store.seasonQuest, party);
  const chapters = storyChapters(store);
  const offer = catchUpFor(store, now, weekKey);
  const unlocks = houseUnlocks(store);
  const spent = live && store.eventSpent === `${now.toDateString()}|${live.id}`;
  const armed = live && store.eventArmed === live.id;

  const say = (line) => setSaid(line);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="The back room"
      className={`fixed inset-0 z-[60] dialog-scrim flex items-start justify-center overflow-y-auto ${SCRIM_PAD}`}
    >
      <div className="relative my-auto w-full max-w-lg rounded-2xl dialog-panel">
        <div className="px-5 pb-6 pt-7 sm:px-6">
          <div className="flex items-center gap-2">
            <DoorOpen aria-hidden="true" className="h-5 w-5 text-brass-300" strokeWidth={2.2} />
            <h2 className="font-display text-3xl font-extrabold leading-tight text-brass-gradient">The back room</h2>
          </div>
          <p className="mt-2 text-sm text-plush-300">What the house keeps for people who stay.</p>
          <div role="status" className="sr-only">{said}</div>

          <div className="mt-5 space-y-3">
            <Block title={live ? live.name : 'A quiet night'}>
              <p className="mt-1 text-sm text-plush-200">
                {live ? live.blurb : 'Nothing special is on. Come back when the room is louder.'}
              </p>
              {live?.preview && (
                <p className="mt-2 text-sm text-plush-300">The room is dressed. The payout waits for the server.</p>
              )}
              {live && !live.preview && !spent && (
                <Action brass={!armed} pressed={armed} onClick={() => {
                  const armedNow = store.armHouseEvent();
                  say(armedNow ? `${live.name} is on. One fight, then it is spent.` : 'Not tonight.');
                }}
                >
                  {armed ? 'You are in' : 'I’m in'}
                </Action>
              )}
              {live && spent && <p className="mt-2 text-sm text-plush-300">You already took tonight’s round.</p>}
            </Block>

            {party && quests.length > 0 && (
              <Block title={`${party.name} quests`}>
                <ul className="mt-2 space-y-3">
                  {quests.map((quest) => {
                    const done = questProgress.claimed.includes(quest.id);
                    const ready = party.status === 'active' && questReady(quest, questProgress);
                    const have = questProgress[quest.stat] || 0;
                    return (
                      <li key={quest.id} className="text-sm text-plush-200">
                        <span className="font-semibold text-white">{quest.name}. </span>
                        {quest.line} {have}/{quest.target}.
                        {ready && (
                          <Action brass onClick={() => {
                            const paid = store.claimSeasonQuest(quest.id);
                            say(paid ? `${quest.name} paid.` : 'Not yet.');
                          }}
                          >
                            Take {quest.name}
                          </Action>
                        )}
                        {done && <span className="mt-1 block text-plush-300">Taken.</span>}
                        {party.status !== 'active' && !done && (
                          <span className="mt-1 block text-plush-300">The server has not opened this list.</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Block>
            )}

            <Block title={crawl.title || 'Bar crawl'}>
              {crawl.unlocked ? (
                <>
                  <ul className="mt-2 space-y-1">
                    {crawl.stops.map((stop) => (
                      <li key={stop.id} className="text-sm text-plush-200">
                        {stop.met ? 'Done. ' : 'Next. '}{stop.name}. {stop.line}
                      </li>
                    ))}
                  </ul>
                  {crawl.waiting && (
                    <Action onClick={() => {
                      const skipped = store.skipCrawlTimer();
                      say(skipped.ok ? `Walk skipped. ${skipped.gems} gems. The stops did not get easier.` : 'The walk stays.');
                    }}
                    >
                      {`Skip the walk · ${crawl.skipGems} gems`}
                    </Action>
                  )}
                  {crawl.done && !crawl.claimed && (
                    <Action brass onClick={() => {
                      const paid = store.claimBarCrawl();
                      say(paid ? `Crawl finished. ${paid.coins} coins and ${paid.packs} card pack.` : 'Not yet.');
                    }}
                    >
                      Take the last stool
                    </Action>
                  )}
                  {crawl.claimed && <p className="mt-2 text-sm text-plush-300">This week’s crawl already bought the round.</p>}
                </>
              ) : (
                <p className="mt-1 text-sm text-plush-200">Three fights, then the crawl. The bars can wait.</p>
              )}
            </Block>

            <Block title="The house tab">
              <ul className="mt-2 space-y-2">
                {LEVEL_TRACK.map((row) => {
                  const claimed = store.claimedLevelRewards.includes(row.level);
                  const ready = store.level >= row.level && !claimed;
                  return (
                    <li key={row.level} className="text-sm text-plush-200">
                      <span className="font-semibold text-white">Level {row.level}. </span>
                      {row.line}
                      {ready && (
                        <Action brass onClick={() => {
                          const paid = store.claimLevelReward(row.level);
                          if (paid) noteMark(levelMark(row.level));
                          say(paid ? `Level ${row.level} taken.` : 'Not yet.');
                        }}
                        >
                          Take level {row.level}
                        </Action>
                      )}
                      {claimed && <span className="mt-1 block text-plush-300">Taken.</span>}
                    </li>
                  );
                })}
              </ul>
            </Block>

            <Block title="Plaques">
              <ul className="mt-2 space-y-2">
                {PLAQUES.map((plaque) => {
                  const claimed = store.claimedPlaques.includes(plaque.id);
                  const ready = store.level >= plaque.level && !claimed;
                  return (
                    <li key={plaque.id} className="text-sm text-plush-200">
                      <span className="font-semibold text-white">{plaque.name}. </span>
                      {plaque.line}
                      {ready && (
                        <Action brass onClick={() => {
                          const paid = store.claimPlaque(plaque.id);
                          if (paid) noteMark(plaque.id);
                          say(paid ? `${plaque.name} is on the wall.` : 'Not yet.');
                        }}
                        >
                          Nail up {plaque.name}
                        </Action>
                      )}
                      {claimed && <span className="mt-1 block text-plush-300">On the wall. The daily is a little sweeter.</span>}
                      {store.level < plaque.level && <span className="mt-1 block text-plush-300">Level {plaque.level}.</span>}
                    </li>
                  );
                })}
              </ul>
            </Block>

            <Block title="After hours">
              {chapters.map((chapter) => (
                <div key={chapter.id} className="mt-3 border-t border-white/10 pt-3 first:mt-1 first:border-0 first:pt-0">
                  <h4 className="font-display font-bold text-white">{chapter.name}</h4>
                  <p className="mt-1 text-sm text-plush-200">{chapter.claimed ? chapter.closing : chapter.opening}</p>
                  {chapter.locked && <p className="mt-1 text-sm text-plush-300">The door stays shut until the first round is done.</p>}
                  {!chapter.locked && (
                    <ul className="mt-2 space-y-1">
                      {chapter.beats.map((beat) => (
                        <li key={beat.id} className="text-sm text-plush-200">{beat.met ? 'Done. ' : 'Still. '}{beat.label}.</li>
                      ))}
                    </ul>
                  )}
                  {chapter.ready && !chapter.claimed && (
                    <Action brass onClick={() => {
                      const paid = store.claimStory(chapter.id);
                      if (paid) noteMark(chapter.id);
                      say(paid ? chapter.closing : 'Not yet.');
                    }}
                    >
                      Close {chapter.name}
                    </Action>
                  )}
                </div>
              ))}
            </Block>

            {offer && (
              <Block title="The stool you left">
                <p className="mt-1 text-sm text-plush-200">{offer.line}</p>
                <Action brass onClick={() => {
                  const paid = store.claimCatchUp();
                  say(paid ? `Catch-up round: ${paid.coins} coins and a card pack.` : 'Not this week.');
                }}
                >
                  Take the round
                </Action>
              </Block>
            )}

            <Block title="Still locked">
              <ul className="mt-2 space-y-1">
                {unlocks.map((row) => (
                  <li key={row.id} className="text-sm text-plush-200">
                    {row.open ? 'Open. ' : 'Locked. '}{row.name}. {row.need}.
                  </li>
                ))}
              </ul>
            </Block>
          </div>
        </div>
        <DialogClose label="Close the back room" onClick={onClose} className="absolute right-3 top-3 sm:right-4 sm:top-4" />
      </div>
    </div>
  );
};

export default BackRoom;
