import { useState } from 'react';
import { motion } from 'framer-motion';
import { Palette } from 'lucide-react';
import { useGameStore } from '@/stores/gameStore';
import { useDialog } from '@/hooks/useDialog';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { SCRIM_PAD } from '@/lib/safeArea';
import { ignoreKeyRepeat, useArmedAfterOpen } from '@/lib/keyRepeat';
import { Medallion, DialogClose, WalletChips } from '@/components/ui/game-chrome';
import { CardBack } from '@/components/TeddyCard';
import { WARDROBE, ownsWardrobe, wardrobeLong } from '@/lib/wardrobe';

const ACTION = `inline-flex h-11 shrink-0 items-center justify-center rounded-xl px-3 font-display text-sm font-bold ${FOCUS_OUTLINE}`;

const priceLine = (item) => (
  item.price === 0 ? 'Free' : `${item.price.toLocaleString()} ${item.currency}`
);

const BoardSwatch = ({ item }) => (
  <span
    aria-hidden="true"
    className="block h-11 w-8 rounded-md ring-1 ring-white/20"
    style={{
      backgroundColor: item.swatch,
      boxShadow: 'inset 0 0 10px rgba(0,0,0,0.45)',
    }}
  />
);

const ConfirmSpend = ({ item, onYes, onNo }) => {
  const { armed, whenArmed } = useArmedAfterOpen();
  return (
    <div className="rounded-xl bg-night-950/70 p-3 ring-1 ring-inset ring-brass-300/40">
      <p className="text-sm font-semibold text-plush-100">
        Spend {item.price.toLocaleString()} gems on {wardrobeLong(item)}? This can&apos;t be undone.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={whenArmed(onYes)}
          className={`${ACTION} btn-brass flex-1 ${armed ? '' : 'pointer-events-none'}`}
        >
          Spend {item.price.toLocaleString()} gems
        </button>
        <button type="button" onClick={onNo} className={`${ACTION} btn-glass flex-1`}>
          Keep them
        </button>
      </div>
    </div>
  );
};

const LookRow = ({ item, owned, equipped, onChoose }) => (
  <div className="flex items-center gap-3 border-t border-white/[0.06] px-3 py-3 first:border-t-0">
    <span aria-hidden="true" className="shrink-0">
      {item.slot === 'back'
        ? <CardBack look={item.id} mini className="h-11 w-8" />
        : <BoardSwatch item={item} />}
    </span>
    <div className="min-w-0 flex-1">
      <div className="font-display font-bold leading-tight text-plush-100">{item.label}</div>
      <div className="mt-0.5 text-[13px] leading-snug text-plush-300">{item.blurb}</div>
      <div className="mt-0.5 text-xs font-semibold text-brass-200">{priceLine(item)}</div>
    </div>
    <button
      type="button"
      onClick={() => onChoose(item)}
      aria-pressed={equipped}
      aria-label={equipped ? `${item.label}, wearing` : `${owned ? 'Wear' : 'Buy'} ${wardrobeLong(item)}`}
      className={`${ACTION} min-w-[5.5rem] ${equipped || owned ? 'btn-glass' : 'btn-brass'}`}
    >
      {equipped ? 'Wearing' : owned ? 'Wear' : 'Buy'}
    </button>
  </div>
);

const Wardrobe = ({ onClose }) => {
  const coins = useGameStore((s) => s.coins);
  const gems = useGameStore((s) => s.gems);
  const gemDebt = useGameStore((s) => s.gemDebt);
  const unlocked = useGameStore((s) => s.unlockedCosmetics);
  const equippedBack = useGameStore((s) => s.equippedCardBack);
  const equippedBoard = useGameStore((s) => s.equippedBoard);
  const purchaseWardrobe = useGameStore((s) => s.purchaseWardrobe);
  const [pending, setPending] = useState(null);
  const [status, setStatus] = useState('');
  const dialogRef = useDialog(onClose);

  const choose = (item) => {
    const owned = ownsWardrobe(unlocked, item);
    const equipped = (item.slot === 'back' ? equippedBack : equippedBoard) === item.id;
    if (equipped) return;
    if (!owned && item.currency === 'gems') {
      setPending(item);
      setStatus('');
      return;
    }
    const reason = purchaseWardrobe(item.id);
    if (reason === 'short') {
      setStatus(item.currency === 'gems' ? 'Not enough gems.' : 'Not enough coins.');
      return;
    }
    if (reason === 'bought' || reason === 'owned') setStatus(`${item.label} is what you're wearing.`);
  };

  const confirm = () => {
    if (!pending) return;
    const item = pending;
    const reason = purchaseWardrobe(item.id);
    setPending(null);
    if (reason === 'short') setStatus('Not enough gems.');
    else if (reason === 'bought' || reason === 'owned') setStatus(`${item.label} is what you're wearing.`);
  };

  const groups = [
    { id: 'backs', title: 'From behind', items: WARDROBE.filter((item) => item.slot === 'back') },
    { id: 'boards', title: 'The sheet', items: WARDROBE.filter((item) => item.slot === 'board') },
  ];

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Wardrobe"
      onKeyDown={ignoreKeyRepeat}
      className={`fixed inset-0 z-50 dialog-scrim flex items-start justify-center overflow-y-auto ${SCRIM_PAD}`}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl dialog-panel sm:max-h-[calc(100dvh-3rem)]"
      >
        <div className="relative flex items-center gap-3 border-b border-white/[0.06] px-4 pb-4 pt-4 sm:px-6 sm:pt-5">
          <Medallion icon={Palette} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-extrabold leading-none text-brass-gradient sm:text-3xl">
              Wardrobe
            </h2>
            <WalletChips coins={coins} gems={gems} gemDebt={gemDebt} className="mt-2" />
          </div>
          <DialogClose label="Close wardrobe" onClick={onClose} />
        </div>

        <div className="relative min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          <p className="text-sm leading-snug text-plush-300">
            Backs are what the table sees when you are not showing. Cloths are the sheet. Coins, or gems you already hold. No checkout.
          </p>
          {pending && (
            <ConfirmSpend item={pending} onYes={confirm} onNo={() => setPending(null)} />
          )}
          <p role="status" className={status ? 'text-sm font-semibold text-emerald-200' : 'sr-only'}>{status}</p>
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={`wardrobe-${group.id}`}>
              <h3 id={`wardrobe-${group.id}`} className="label-caps mb-2 text-plush-300">{group.title}</h3>
              <div className="panel-glass rounded-xl">
                {group.items.map((item) => (
                  <LookRow
                    key={item.id}
                    item={item}
                    owned={ownsWardrobe(unlocked, item)}
                    equipped={(item.slot === 'back' ? equippedBack : equippedBoard) === item.id}
                    onChoose={choose}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Wardrobe;
