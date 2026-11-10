import { useId } from 'react';
import { useGameStore, ALL_CARDS } from '@/stores/gameStore';
import { CONVENIENCE, deckSlotsFor, storageSlotsFor } from '@/lib/convenience';
import { EARNED_OPENS_PER_DAY, SELLBACK_FULL_CAP } from '@/lib/packEconomy';
import { useDialog } from '@/hooks/useDialog';
import { SCRIM_PAD } from '@/lib/safeArea';
import { DialogClose } from '@/components/ui/game-chrome';

const today = () => new Date().toDateString();

/** The bar tab: what the packs have paid back, and the gem shortcuts. */
export const BarTab = ({ onClose }) => {
  const ref = useDialog(onClose);
  const titleId = useId();
  const state = useGameStore();
  const spent = state.packCoinSpent || 0;
  const back = state.packCoinBack || 0;
  const profit = back - spent;
  const opensLeft = state.instantOpen
    ? 'No daily cap while instant open is on.'
    : (() => {
      const used = state.earnedOpensDay === today() ? state.earnedOpensToday : 0;
      return `${Math.max(0, EARNED_OPENS_PER_DAY - used)} free opens left today.`;
    })();
  const slots = deckSlotsFor(state.totalWins || 0, state.decksUnlocked, state.bonusDeckSlot);
  const binder = storageSlotsFor(state.totalWins || 0, state.storageUnlocked, ALL_CARDS.length);
  return (
    <div className={`fixed inset-0 z-[60] dialog-scrim flex items-start justify-center ${SCRIM_PAD} overflow-y-auto`}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative my-auto w-full max-w-lg rounded-2xl dialog-panel px-5 pt-5 pb-6 sm:px-6">
        <div className="flex items-center gap-3">
          <h2 id={titleId} className="mr-auto font-display text-2xl font-extrabold leading-none text-brass-gradient">Bar tab</h2>
          <DialogClose label="Close bar tab" onClick={onClose} />
        </div>
        <p className="mt-2 text-sm text-plush-300">What the packs have cost and what they have paid back. The house shows its working.</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="panel-glass rounded-xl p-3">
            <dt className="text-[11px] text-plush-300">Spent on packs</dt>
            <dd className="font-display text-xl text-white">{spent.toLocaleString()} coins</dd>
          </div>
          <div className="panel-glass rounded-xl p-3">
            <dt className="text-[11px] text-plush-300">Paid back</dt>
            <dd className="font-display text-xl text-white">{back.toLocaleString()} coins</dd>
          </div>
          <div className="panel-glass rounded-xl p-3">
            <dt className="text-[11px] text-plush-300">Pack profit</dt>
            <dd className="font-display text-xl text-white">{profit >= 0 ? '+' : ''}{profit.toLocaleString()} coins</dd>
          </div>
          <div className="panel-glass rounded-xl p-3">
            <dt className="text-[11px] text-plush-300">Opens</dt>
            <dd className="font-display text-xl text-white">{state.packOpens || 0}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-plush-300">
          {opensLeft} Sell-back pays 40% until {SELLBACK_FULL_CAP.toLocaleString()} coins in a day, then half of that. Every 6th pack pays a bonus. Pity is a rare or better every 10 quiet packs. Gem packs use the same numbers.
        </p>
        <p className="mt-2 text-xs text-plush-300">
          {`Saved decks ${state.savedDecks.length}/${slots}. Binder ${state.ownedCards.length}/${binder}.`}
        </p>
      </div>
    </div>
  );
};

export const Shortcuts = () => {
  const gems = useGameStore((s) => s.gems);
  const buy = useGameStore((s) => s.buyConvenience);
  const instantOpen = useGameStore((s) => s.instantOpen);
  const decksUnlocked = useGameStore((s) => s.decksUnlocked);
  const storageUnlocked = useGameStore((s) => s.storageUnlocked);
  const owned = { instant_open: instantOpen, deck_slots: decksUnlocked, storage: storageUnlocked };
  return (
    <div className="mt-6">
      <h3 className="label-caps mb-2 text-plush-300">Shortcuts</h3>
      <p className="mb-3 text-xs text-plush-300">Gems buy time. None of these change a card, a drop rate, or a sell-back.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {CONVENIENCE.filter((item) => item.id !== 'quest_reroll' && item.id !== 'streak_shield').map((item) => {
          const have = owned[item.id];
          return (
            <button
              key={item.id}
              type="button"
              disabled={have}
              onClick={() => buy(item.id)}
              className="min-h-11 rounded-xl panel-glass px-3 py-2 text-left disabled:opacity-60"
            >
              <span className="block text-sm font-semibold text-white">{item.name}</span>
              <span className="block text-xs text-plush-300">{have ? 'Yours.' : `${item.gems} gems. You have ${gems}.`}</span>
              <span className="mt-1 block text-xs text-plush-300">{item.blurb}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
