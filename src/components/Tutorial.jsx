import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronLeft, ChevronRight, Swords, Target, RefreshCw, Layers, Zap, ScrollText, Rocket, Trophy,
  Bomb, Sparkles, Shield, Crosshair, ShieldHalf, Ghost, Flame, Castle, Bug, Crown,
} from 'lucide-react';
import TeddyCard from './TeddyCard';
import { ALL_CARDS } from '../stores/gameStore';
import { useDialog } from '@/hooks/useDialog';
import { RARITY_METAL } from '@/lib/rarity';

// Presentation only — every `content` string is the copy as written, and
// Tutorial.test.js reads it from this file.
//
// `icon` is the step's medallion (`mascot` puts the bear himself in it). A
// `list` step draws one row per line of its content, the words before the
// line's first em dash as the row's heading; its `icons` run in the same order
// as those lines. They are the icons the cards themselves wear (see
// TeddyCard), so what is taught here is what the player then sees on the
// table. Kept positional on purpose: keyed by name, the map would spell out
// every mechanic in code, and the test that checks the copy names each one
// would pass on the map alone.
const TUTORIAL_STEPS = [
  {
    title: "Welcome to Terrible Teddies",
    content: "Somewhere between the toy chest and the bar, these teddies went bad. Now they settle everything with cards, fists, and language you can't repeat at work.\n\n(18+ — crude humor, cartoon fluff violence, and bears with substance-abuse issues.)",
    mascot: true,
  },
  {
    title: "The Job",
    content: "Beat the stuffing out of Chuck — the smuggest teddy alive — by getting his HP to 0 before your 30 hits the floor — he brings more of it on higher difficulty, because of course he does. He WILL talk trash the entire time. Ignore him. Or don't. He hates both.",
    icon: Target,
  },
  {
    title: "How a Turn Works",
    content: "1. Draw — take a card. It's probably a bad one. Play it anyway.\n2. Main — throw teddies and traps on the table\n3. Battle — the fun part\n4. End — Chuck's turn to embarrass himself",
    icon: RefreshCw,
    list: true,
  },
  {
    title: "The Cast",
    content: "Action Cards — your goons, with Attack (⚔️) and HP (🛡️). HP is how many beatings they can absorb before going back to fluff. Fresh off the barstool they're Warming Up — no swinging until your next turn. Same rule for Chuck's lot.\nTrap Cards — spring-loaded regret for whoever swings at you\nSpecial Cards — back-alley healing and questionable card advantage",
    icon: Layers,
    list: true,
    icons: [Swords, Bomb, Sparkles],
    showCards: true,
  },
  {
    title: "Energy",
    content: "Cards cost energy (the brass gem in the corner). You start each turn with 3 and it climbs as the game drags on — just like a real bar tab.",
    icon: Zap,
  },
  {
    title: "Rap Sheets (Abilities)",
    content: "Taunt — talks so much shit, enemies HAVE to hit them first\nPiercing — cuts straight through Shield\nShield — takes 50% less damage, the coward\nStealth — untargetable for a turn (currently hiding in your hamper)\nFury — every hit they survive is +1 Attack, up to +3. After that they've peaked, like everyone else in here.\nProtect — while they're upright, nothing else on their side can be touched\nSwarm — costs 1 less once you've already got someone on the table\nRoyal — struts around giving everyone ELSE +1 Attack. Never itself.",
    icon: ScrollText,
    list: true,
    icons: [Shield, Crosshair, ShieldHalf, Ghost, Flame, Castle, Bug, Crown],
    columns: true,
  },
  {
    title: "Violence 101",
    content: "Click your teddy, then a victim. Damage comes off the target's HP — they stay on the table until it hits 0, and any leftover damage tramples straight into their owner's face. Big-HP teddies are bouncers: clear them off the table before you can deck Chuck directly. Piercing does NOT walk you past a bouncer — it just carves through the Shielded ones.",
    icon: Swords,
  },
  {
    title: "Momentum & Rally",
    content: "Playing cards and throwing hands builds Momentum. Fill the gauge to 10 and the ⚡ Rally button lights up — cash it in and your whole squad gets +1 Attack and a full restuff. It's the comeback button, and Chuck thinks it should be illegal.",
    icon: Rocket,
  },
  {
    title: "Go Ruin Chuck's Day",
    content: "That's everything. Get out there, talk your talk, and remember the house rule: no biting. (Biting is fine.)",
    icon: Trophy,
  },
];

// "1. Draw — take a card…" → { number: '1', term: 'Draw', text: 'take a card…' }
const parseLine = (line) => {
  const m = line.match(/^(?:(\d+)\.\s*)?(.+?) — (.+)$/);
  return m ? { number: m[1], term: m[2], text: m[3] } : { text: line };
};

// Real cards from the set, resolved by name so ids (and therefore shipped
// card art) stay canonical.
const exampleCards = ['Shit-Talk Sally', 'Honey Trap', 'Emergency Fluff Job']
  .map((name) => ALL_CARDS.find((c) => c.name === name))
  .filter(Boolean);

// Focus on anything wearing a material (btn-glass, btn-brass) is an outline,
// not a ring: a Tailwind ring is a box-shadow, and it would replace the
// material's own rim light and depth.
const FOCUS_OUTLINE =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-300';

// Plain <button>s, not the shadcn Button: its bg-primary is a utility and
// would beat the component-layer btn-brass / btn-glass materials.
const NAV = `inline-flex h-11 items-center justify-center gap-1.5 rounded-xl font-display font-bold whitespace-nowrap ${FOCUS_OUTLINE}`;

const ListRow = ({ line, icon: Icon }) => {
  const { number, term, text } = parseLine(line);
  return (
    <li className="flex gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-inset ring-white/[0.06]">
      {number ? (
        <span
          aria-hidden="true"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-b from-brass-200 to-brass-400 font-display text-sm font-extrabold text-night-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_4px_10px_-6px_rgba(217,119,6,0.9)]"
        >
          {number}
        </span>
      ) : Icon ? (
        <span
          aria-hidden="true"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brass-400/10 ring-1 ring-inset ring-brass-300/30"
        >
          <Icon className="h-4 w-4 text-brass-300" strokeWidth={2.2} />
        </span>
      ) : null}
      <div className="min-w-0">
        {/* The number badge is drawn, so it is said here instead. */}
        {term && <div className="font-display font-bold leading-tight text-brass-200">{number && <span className="sr-only">{number}. </span>}{term}</div>}
        <p className="mt-0.5 text-sm leading-snug text-plush-200">{text}</p>
      </div>
    </li>
  );
};

const Tutorial = ({ onClose, onStartGame }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const step = TUTORIAL_STEPS[currentStep];
  const dialogRef = useDialog(onClose);
  const bodyRef = useRef(null);

  // Each step starts at its top: the body is a scroller, and without this a
  // long step read to the bottom left the next one opening half-way down.
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [currentStep]);

  const nextStep = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;
  const StepIcon = step.icon;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="How to play"
      // The scrim scrolls and the panel centres with my-auto (not
      // items-center: a centred flex item taller than its box overflows at
      // both ends).
      className="fixed inset-0 z-50 dialog-scrim flex items-start justify-center overflow-y-auto p-3 sm:p-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        // A fixed frame: the header, the progress bar and the Previous/Next
        // row stay put and only the step itself scrolls, so the controls are
        // always in reach on a phone.
        className="relative my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl dialog-panel sm:max-h-[calc(100dvh-3rem)]"
      >
        {/* The light the step's medallion sits in. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_50%_70%_at_50%_15%,rgba(251,191,36,0.12),transparent_70%)]"
        />

        {/* Header */}
        <div className="relative flex items-center gap-3 px-4 pb-2 pt-4 sm:px-6 sm:pt-5">
          <h2 className="min-w-0 flex-1 font-display text-xl font-extrabold leading-tight text-white">How to Play</h2>
          <button
            type="button"
            onClick={onClose}
            className={`btn-glass grid h-10 w-10 shrink-0 place-items-center rounded-xl text-plush-200 hover:text-white ${FOCUS_OUTLINE}`}
            aria-label="Close tutorial"
          >
            <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.4} />
          </button>
        </div>

        {/* Progress: one segment per step. Each is a 24px-tall button around a
            thin bar, so the target is bigger than it looks. Plain elements,
            so their focus may be a ring. */}
        <div className="relative flex gap-1.5 px-4 pb-3 sm:px-6">
          {TUTORIAL_STEPS.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setCurrentStep(index)}
              // These dots render no text and had no label, so they were nine
              // anonymous buttons — "button, button, button" — with no way to
              // tell which step was current. axe reports an unnamed button, but
              // e2e/a11y.spec.js never opened the Tutorial, so it never saw
              // them; that gap is closed in the same change as this.
              aria-label={`Go to step ${index + 1} of ${TUTORIAL_STEPS.length}`}
              aria-current={index === currentStep ? 'step' : undefined}
              className="group flex h-6 min-w-0 flex-1 items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-300"
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-full rounded-full transition-colors ${
                  index === currentStep
                    ? 'bg-gradient-to-r from-brass-200 to-brass-400 shadow-[0_0_10px_rgba(251,191,36,0.65)]'
                    : index < currentStep
                    ? 'bg-brass-400/60'
                    : 'bg-white/15 group-hover:bg-white/30'
                }`}
              />
            </button>
          ))}
        </div>

        {/* Content. Focusable, because most steps hold no control: without a
            tab stop a keyboard user could not scroll a long one. A plain
            element, so its focus may be an (inset) ring. */}
        <div
          ref={bodyRef}
          role="region"
          aria-labelledby="tutorial-step-title"
          tabIndex={0}
          className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brass-300/70"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="px-4 pb-6 pt-3 sm:px-10"
            >
              <div
                aria-hidden="true"
                className="mx-auto mb-3 h-14 w-14 rounded-full p-[3px] shadow-[0_0_30px_rgba(251,191,36,0.28),0_12px_24px_-10px_rgba(0,0,0,0.85)] sm:h-16 sm:w-16"
                style={{ background: RARITY_METAL.legendary }}
              >
                <div className="grid h-full w-full place-items-center rounded-full bg-night-900">
                  {step.mascot
                    ? <span className="text-[28px] leading-none sm:text-[32px]">🧸</span>
                    : <StepIcon className="h-6 w-6 text-brass-300 sm:h-7 sm:w-7" strokeWidth={1.8} />}
                </div>
              </div>

              {/* plush-200, not -300: it sits in the medallion's light. */}
              <div className="label-caps mb-1.5 text-center text-plush-200">
                Step {currentStep + 1} of {TUTORIAL_STEPS.length}
              </div>
              {/* The gradient is on an inline span cloned per line box, so a
                  title that wraps on a phone gets the whole gradient on each
                  line instead of one gradient stretched over both — which
                  left the top line pale and the bottom one dark. */}
              <h3
                id="tutorial-step-title"
                className="mb-5 text-center font-display text-[22px] font-extrabold leading-tight min-[360px]:text-2xl sm:text-3xl"
              >
                <span className="text-brass-gradient [-webkit-box-decoration-break:clone] [box-decoration-break:clone]">{step.title}</span>
              </h3>

              {step.list ? (
                <ul className={`grid gap-2 text-left ${step.columns ? 'sm:grid-cols-2' : ''}`}>
                  {step.content.split('\n').map((line, i) => (
                    <ListRow key={line} line={line} icon={step.icons?.[i]} />
                  ))}
                </ul>
              ) : (
                <div className="mx-auto max-w-lg space-y-4 text-center">
                  {step.content.split('\n\n').map((para) => (
                    <p key={para} className="leading-relaxed text-plush-200">{para}</p>
                  ))}
                </div>
              )}

              {/* Show example cards for card types step. Below 360px three
                  hand-size cards are wider than the row, so the card (not its
                  caption) is zoomed down — zoom rather than a transform, so it
                  takes the room it appears to. */}
              {step.showCards && (
                <div className="mt-5 flex justify-center gap-2 min-[360px]:gap-3 sm:gap-5">
                  {exampleCards.map(card => (
                    <figure key={card.id} className="flex flex-col items-center">
                      <div className="drop-shadow-[0_12px_18px_rgba(0,0,0,0.6)] [zoom:0.8] min-[360px]:[zoom:1]">
                        <TeddyCard teddy={card} />
                      </div>
                      <figcaption className="label-caps mt-2 text-plush-300">
                        {card.type.charAt(0).toUpperCase() + card.type.slice(1)}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation. Glass back, brass forward. Below 360px Previous keeps
            its name for a screen reader but shows only its chevron, so the
            brass button can take the row. */}
        <div className="relative flex items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 0}
            className={`${NAV} btn-glass w-11 shrink-0 px-0 min-[360px]:w-auto min-[360px]:px-4 disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4 min-[360px]:-ml-1" strokeWidth={2.6} />
            <span className="max-[359px]:sr-only">Previous</span>
          </button>

          {isLastStep ? (
            <button
              type="button"
              onClick={onStartGame}
              className={`${NAV} btn-brass min-w-0 flex-1 px-5 min-[360px]:min-w-[8.5rem] min-[360px]:flex-none`}
            >
              Start Playing!
              <Swords aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
            </button>
          ) : (
            <button
              type="button"
              onClick={nextStep}
              className={`${NAV} btn-brass min-w-0 flex-1 px-5 min-[360px]:min-w-[8.5rem] min-[360px]:flex-none`}
            >
              Next
              <ChevronRight aria-hidden="true" className="-mr-1 h-4 w-4" strokeWidth={2.6} />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Tutorial;
