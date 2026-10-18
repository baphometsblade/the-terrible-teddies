import { useState, useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bomb, Check, Eraser, FolderOpen, PawPrint, Save, Sparkles, Trash2, X, Zap } from 'lucide-react';
import TeddyCard, { ArtOrEmoji } from './TeddyCard';
import { Medallion } from '@/components/ui/game-chrome';
import { useToast } from "@/components/ui/use-toast";
import { useGameStore, ALL_CARDS } from '../stores/gameStore';
import { pressable } from '@/lib/a11y';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/focus';
import { useDialog } from '@/hooks/useDialog';
import { bestOwnedBorder } from '@/lib/cosmetics';

import { RARITY, RARITY_METAL } from '@/lib/rarity';

const DECK_SIZE = 10;
const MAX_COPIES = 2;

// Shape of every full-size button here; the material (btn-brass / btn-glass)
// is added per button. Plain <button>s, not the shadcn Button: its bg-primary
// is a utility and would beat a component-layer material. Focus is an
// outline, because every one of them carries a material shadow.
const ACTION =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 font-display text-base font-bold ' +
  `whitespace-nowrap ${FOCUS_OUTLINE}`;

// Segmented type filter — the same .seg-well / .seg-on / .seg-off control as
// the Collection's filters, with the same focus split: an outline on the
// raised key (a ring would replace its shadow), the ring on the others.
const SEG =
  'inline-flex h-8 items-center justify-center rounded-lg px-3 text-[13px] font-semibold whitespace-nowrap ' +
  'transition-colors';
const seg = (on) => `${SEG} ${on ? `seg-on ${FOCUS_OUTLINE}` : `seg-off ${FOCUS_RING}`}`;

// A small recessed well for counts and rows inside the deck panel.
const WELL = 'bg-night-950/45 ring-1 ring-inset ring-white/[0.06]';

const TYPE_TILES = [
  { type: 'action', label: 'Action', Icon: PawPrint, tone: 'text-amber-300' },
  { type: 'trap', label: 'Trap', Icon: Bomb, tone: 'text-purple-300' },
  { type: 'special', label: 'Special', Icon: Sparkles, tone: 'text-cyan-300' },
];

// The brass coin a card's cost is struck on — TeddyCard's, at list size.
const CostCoin = ({ cost }) => (
  <span
    className="grid h-6 w-6 shrink-0 place-items-center rounded-full font-display text-xs font-extrabold leading-none text-night-950 tabular-nums ring-1 ring-night-950/80 shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
    style={{ background: 'radial-gradient(circle at 50% 30%, #fffbeb, #fbbf24 55%, #b45309)' }}
  >
    {cost}
  </span>
);

// Save-Deck modal. Hosts its own useDialog (the hook must mount with the
// overlay) for dialog semantics, Escape, and a focus trap — otherwise the deck
// tiles behind it stay tab-reachable. The hook focuses the first control (the
// name input), so no manual autoFocus is needed — which is also why the
// header's Close button comes LAST in the markup and is positioned into the
// corner: first in the DOM, it would take the focus the name field needs.
// Mirrors GameBoard's GameOverDialog / TeddyCollection's CardDetailDialog.
const SaveDeckDialog = ({ deckName, setDeckName, onSave, onClose }) => {
  const ref = useDialog(onClose);
  const inputId = useId();
  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Save deck"
      initial={{ scale: 0.94, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.96, opacity: 0 }}
      className="dialog-panel relative my-auto w-full max-w-sm rounded-2xl p-5 sm:p-6"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 pr-12">
        <Medallion icon={Save} />
        <h3 className="font-display text-xl font-extrabold leading-tight text-white">Save Deck</h3>
      </div>

      <div className="mb-2 mt-5 flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="label-caps text-plush-300">Deck name</label>
        <span aria-hidden="true" className="text-xs tabular-nums text-plush-300">{deckName.length}/20</span>
      </div>
      <input
        id={inputId}
        type="text"
        value={deckName}
        onChange={(e) => setDeckName(e.target.value)}
        placeholder="Enter deck name..."
        aria-label="Deck name"
        className={`h-11 w-full rounded-xl border border-white/10 bg-night-950/60 px-4 text-plush-100 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] placeholder:text-plush-400 ${FOCUS_RING}`}
        maxLength={20}
      />

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!deckName.trim()}
          className={`${ACTION} btn-brass flex-1 disabled:cursor-not-allowed disabled:opacity-50 disabled:filter-none`}
        >
          Save
        </button>
        <button type="button" onClick={onClose} className={`${ACTION} btn-glass flex-1`}>Cancel</button>
      </div>

      {/* Centred on the 44px medallion row: the panel's padding plus 2px. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className={`btn-glass absolute right-5 top-[22px] grid h-10 w-10 place-items-center rounded-xl sm:right-6 sm:top-[26px] ${FOCUS_OUTLINE}`}
      >
        <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.4} />
      </button>
    </motion.div>
  );
};

const DeckBuilder = () => {
  const { ownedCards, currentDeck, setCurrentDeck, savedDecks, saveDeck, deleteDeck, unlockedCosmetics } = useGameStore();
  // Show the Battle Pass border cosmetic on the player's own cards here too,
  // so the paid frame is visible while building, not only mid-battle.
  const cosmeticBorder = bestOwnedBorder(unlockedCosmetics);
  const [deck, setDeck] = useState([]);
  const [filter, setFilter] = useState('all');
  const [deckName, setDeckName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const { toast } = useToast();
  const copiesIdBase = useId();

  const ownedCardObjects = ALL_CARDS.filter(card => ownedCards.includes(card.id));

  useEffect(() => {
    const initialDeck = currentDeck.map((id, idx) => {
      const card = ALL_CARDS.find(c => c.id === id);
      return card ? { ...card, deckId: `${id}-${idx}` } : null;
    }).filter(Boolean);
    setDeck(initialDeck);
  }, [currentDeck]);

  const filteredCards = ownedCardObjects.filter(card => {
    if (filter === 'all') return true;
    return card.type === filter;
  });

  const addToDeck = (card) => {
    if (deck.length >= DECK_SIZE) {
      toast({ title: "Deck Full!", description: `Max ${DECK_SIZE} cards.`, variant: "destructive" });
      return;
    }
    const copies = deck.filter(c => c.id === card.id).length;
    if (copies >= MAX_COPIES) {
      toast({ title: "Max Copies!", description: `Max ${MAX_COPIES} copies per card.`, variant: "destructive" });
      return;
    }
    setDeck([...deck, { ...card, deckId: `${card.id}-${Date.now()}` }]);
  };

  const removeFromDeck = (deckCard) => {
    setDeck(deck.filter(c => c.deckId !== deckCard.deckId));
  };

  // Dismiss the Save-As dialog AND clear the typed name. Leaving deckName
  // populated after a cancel was the bug: handleSaveDeck is shared with the
  // "Set as Current Deck" button, and it took the named-save branch
  // whenever deckName was non-empty — so cancelling the dialog with a name
  // typed, then clicking "Set as Current Deck", silently saved/overwrote a
  // named deck the player never confirmed.
  const closeSaveDialog = () => {
    setShowSaveDialog(false);
    setDeckName('');
  };

  const handleSaveDeck = () => {
    if (deck.length !== DECK_SIZE) {
      toast({ title: "Invalid Deck", description: `Need ${DECK_SIZE} cards!`, variant: "destructive" });
      return;
    }
    const cardIds = deck.map(c => c.id);
    setCurrentDeck(cardIds);

    // Only save a *named* deck when the request came from the Save-As dialog.
    // The "Set as Current Deck" button calls this too, and must never
    // perform a named save just because a stale name lingers in state.
    if (showSaveDialog && deckName.trim()) {
      saveDeck(deckName.trim(), cardIds);
      setShowSaveDialog(false);
      setDeckName('');
      toast({ title: "Deck Saved!", description: `"${deckName.trim()}" saved.` });
    } else {
      toast({ title: "Deck Set!", description: "Current deck updated." });
    }
  };

  const loadSavedDeck = (savedDeckData) => {
    const loadedDeck = savedDeckData.cards.map((id, idx) => {
      const card = ALL_CARDS.find(c => c.id === id);
      return card ? { ...card, deckId: `${id}-${idx}` } : null;
    }).filter(Boolean);
    setDeck(loadedDeck);
    toast({ title: "Deck Loaded", description: `"${savedDeckData.name}" loaded.` });
  };

  const clearDeck = () => setDeck([]);

  const totalCost = deck.reduce((sum, card) => sum + card.cost, 0);
  const avgCost = deck.length > 0 ? (totalCost / deck.length).toFixed(1) : 0;
  const typeCount = {
    action: deck.filter(c => c.type === 'action').length,
    trap: deck.filter(c => c.type === 'trap').length,
    special: deck.filter(c => c.type === 'special').length,
  };
  const rarityCount = {
    common: deck.filter(c => c.rarity === 'common').length,
    uncommon: deck.filter(c => c.rarity === 'uncommon').length,
    rare: deck.filter(c => c.rarity === 'rare').length,
    epic: deck.filter(c => c.rarity === 'epic').length,
    legendary: deck.filter(c => c.rarity === 'legendary').length,
  };
  const deckFull = deck.length === DECK_SIZE;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 text-center">
        <h1 className="font-display text-4xl font-extrabold leading-none tracking-tight text-brass-gradient md:text-5xl">Deck Builder</h1>
        <p className="label-caps mt-3 text-plush-300">Assemble your goon squad</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        <div className="lg:col-span-2">
          <section className="panel-glass rounded-2xl p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-extrabold leading-tight text-white">
                Your Cards <span className="font-bold text-plush-300">({ownedCardObjects.length})</span>
              </h2>

              <div
                role="group"
                aria-label="Filter by type"
                className="seg-well grid w-full grid-cols-4 gap-1 sm:inline-flex sm:w-auto"
              >
                {['all', 'action', 'trap', 'special'].map(type => (
                  <button
                    type="button"
                    key={type}
                    onClick={() => setFilter(type)}
                    aria-pressed={filter === type}
                    className={seg(filter === type)}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Padded inside the scroller so a card's hover lift and focus
                ring are not clipped by its edge. Fixed card-width tracks, as
                in the Collection: centred on a phone, spread to the panel's
                edges from sm up so the grid lines up with the heading. */}
            <div className="-mx-2 max-h-[500px] overflow-y-auto px-2 pb-2 pt-2 [scrollbar-color:rgba(255,255,255,0.18)_transparent] [scrollbar-width:thin]">
              <div className="grid grid-cols-[repeat(auto-fill,6rem)] justify-center gap-x-3 gap-y-3 sm:justify-between sm:gap-x-4">
                {filteredCards.map((card) => {
                  const copiesInDeck = deck.filter(c => c.id === card.id).length;
                  const isMaxed = copiesInDeck >= MAX_COPIES;
                  const copiesId = `${copiesIdBase}-copies-${card.id}`;
                  return (
                    <div key={card.id} className="flex flex-col items-center">
                      {/* The copy count describes the tile, so a screen
                          reader tabbing the grid hears "Add X to deck, 1 of 2
                          copies in deck" rather than a bare "Add X to deck". */}
                      <div
                        className={`relative rounded-[10px] ${isMaxed ? '' : 'cursor-pointer'} ${FOCUS_RING}`}
                        {...pressable(addToDeck.bind(null, card), `Add ${card.name} to deck`, !isMaxed)}
                        aria-describedby={copiesInDeck > 0 && !isMaxed ? copiesId : undefined}
                      >
                        <TeddyCard teddy={card} isDisabled={isMaxed} cosmeticBorder={cosmeticBorder} />
                      </div>
                      {/* Copies in the deck, one lit segment per copy — under
                          the card, where it can never cover the cost coin. */}
                      <div className="mt-2 flex h-3 items-center gap-1">
                        {Array.from({ length: MAX_COPIES }, (_, i) => (
                          <span
                            key={i}
                            aria-hidden="true"
                            className={`h-1.5 w-5 rounded-full transition-colors ${i < copiesInDeck
                              ? 'bg-gradient-to-r from-brass-200 to-brass-400 shadow-[0_0_6px_rgba(251,191,36,0.55)]'
                              : 'bg-white/10'}`}
                          />
                        ))}
                        {copiesInDeck > 0 && (
                          <span id={copiesId} className="sr-only">{copiesInDeck} of {MAX_COPIES} copies in deck</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {filteredCards.length === 0 && (
              <div className="py-8 text-center text-plush-300">No cards available. Open packs!</div>
            )}
          </section>
        </div>

        <div className="lg:col-span-1">
          <section className="panel-glass rounded-2xl p-4 sm:p-5 lg:sticky lg:top-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-extrabold leading-tight text-white">
                Deck <span className={`font-bold tabular-nums ${deckFull ? 'text-brass-300' : 'text-plush-300'}`}>({deck.length}/{DECK_SIZE})</span>
              </h2>
              <button
                type="button"
                onClick={clearDeck}
                className={`btn-glass inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-red-300 ${FOCUS_OUTLINE}`}
              >
                <Eraser aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.4} />
                Clear
              </button>
            </div>

            {/* One segment per slot, lit as the deck fills. */}
            <div aria-hidden="true" className="mt-3 grid grid-cols-10 gap-1">
              {Array.from({ length: DECK_SIZE }, (_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-colors ${i < deck.length
                    ? 'bg-gradient-to-r from-brass-200 to-brass-400 shadow-[0_0_6px_rgba(251,191,36,0.45)]'
                    : 'bg-white/10'}`}
                />
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {TYPE_TILES.map(({ type, label, Icon, tone }) => (
                <div key={type} className={`rounded-xl px-2 py-2.5 ${WELL}`}>
                  <div className={`flex items-center justify-center gap-1.5 font-display text-xl font-extrabold leading-none tabular-nums ${tone}`}>
                    <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
                    {typeCount[type]}
                  </div>
                  <div className="label-caps mt-1.5 text-[10px] text-plush-300">{label}</div>
                </div>
              ))}
            </div>

            {/* Rarity mix and average cost: a second row of the same tiles, on
                the same columns. Each tier is a dot of its frame metal and a
                count (the name is there for a screen reader and on hover), so
                even a five-tier deck fits its tile on one line. */}
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className={`col-span-2 rounded-xl px-2 py-2.5 ${WELL}`}>
                <div className="flex min-h-5 flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
                  {Object.entries(rarityCount).map(([rarity, count]) =>
                    count > 0 ? (
                      <span key={rarity} title={rarity} className="inline-flex items-center gap-1">
                        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full ring-1 ring-black/40" style={{ background: RARITY_METAL[rarity] }} />
                        <span className="font-display text-base font-extrabold leading-none text-white tabular-nums">{count}</span>
                        <span className="sr-only">{rarity}</span>
                      </span>
                    ) : null
                  )}
                  {deck.length === 0 && <span aria-hidden="true" className="font-display font-extrabold leading-none text-plush-300">–</span>}
                </div>
                <div className="label-caps mt-1.5 text-[10px] text-plush-300">Rarity</div>
              </div>
              <div className={`rounded-xl px-2 py-2.5 ${WELL}`}>
                <div className="flex items-center justify-center gap-1 font-display text-xl font-extrabold leading-none text-brass-300 tabular-nums">
                  <Zap aria-hidden="true" className="h-4 w-4" fill="currentColor" strokeWidth={1.5} />
                  {avgCost}
                </div>
                <div className="label-caps mt-1.5 text-[10px] text-plush-300">Avg Cost</div>
              </div>
            </div>

            <div className="-mx-1 mb-4 mt-4 max-h-64 space-y-1.5 overflow-y-auto overflow-x-hidden px-1 [scrollbar-color:rgba(255,255,255,0.18)_transparent] [scrollbar-width:thin]">
              <AnimatePresence>
                {deck.map((card) => (
                  <motion.div
                    key={card.deckId}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={`relative flex items-center gap-2.5 overflow-hidden rounded-xl py-1.5 pl-3 pr-1.5 ${WELL}`}
                  >
                    {/* The card's tier, as a sliver of its frame metal. */}
                    <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px]" style={{ background: RARITY_METAL[card.rarity] }} />
                    <CostCoin cost={card.cost} />
                    <span
                      aria-hidden="true"
                      className={`relative grid h-9 w-7 shrink-0 place-items-center overflow-hidden rounded-[5px] bg-gradient-to-b ring-1 ring-white/10 ${RARITY[card.rarity].bg}`}
                    >
                      <ArtOrEmoji teddy={card} emojiClassName="text-sm" imgClassName="absolute inset-0 h-full w-full object-cover" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-plush-100">{card.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFromDeck(card)}
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-plush-300 transition-colors hover:bg-red-500/15 hover:text-red-300 ${FOCUS_RING}`}
                      aria-label={`Remove ${card.name} from deck`}
                    >
                      <X aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {deck.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/10 py-6 text-center text-sm text-plush-300">Click cards to add</div>
              )}
            </div>

            <div className="space-y-2">
              {/* The screen's one brass button. Short of a full deck it stays
                  a readable, recessed slot saying how many cards are missing. */}
              <button
                type="button"
                onClick={handleSaveDeck}
                disabled={!deckFull}
                className={`${ACTION} w-full ${deckFull ? 'btn-brass' : `cursor-not-allowed text-plush-300 ${WELL}`}`}
              >
                {deckFull && <Check aria-hidden="true" className="h-5 w-5" strokeWidth={2.6} />}
                {deckFull ? 'Set as Current Deck' : `Need ${DECK_SIZE - deck.length} more`}
              </button>
              <button
                type="button"
                onClick={() => setShowSaveDialog(true)}
                disabled={!deckFull}
                className={`${ACTION} btn-glass w-full disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <Save aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
                Save As...
              </button>
            </div>

            {savedDecks.length > 0 && (
              <div className="mt-5 border-t border-white/[0.06] pt-4">
                <h3 className="label-caps mb-2 text-plush-300">Saved Decks</h3>
                <ul className="space-y-1.5">
                  {savedDecks.map((savedDeck) => (
                    <li key={savedDeck.name} className={`flex items-center gap-1 rounded-xl p-1 ${WELL}`}>
                      <button
                        type="button"
                        onClick={() => loadSavedDeck(savedDeck)}
                        className={`flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 text-left text-sm font-semibold text-plush-100 transition-colors hover:bg-white/5 ${FOCUS_RING}`}
                      >
                        <FolderOpen aria-hidden="true" className="h-4 w-4 shrink-0 text-brass-300" strokeWidth={2.2} />
                        <span className="truncate">{savedDeck.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDeck(savedDeck.name)}
                        aria-label={`Delete deck ${savedDeck.name}`}
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-plush-300 transition-colors hover:bg-red-500/15 hover:text-red-300 ${FOCUS_RING}`}
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </div>

      <AnimatePresence>
        {showSaveDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 dialog-scrim flex items-start justify-center overflow-y-auto p-4"
            onClick={closeSaveDialog}
          >
            <SaveDeckDialog
              deckName={deckName}
              setDeckName={setDeckName}
              onSave={handleSaveDeck}
              onClose={closeSaveDialog}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DeckBuilder;
