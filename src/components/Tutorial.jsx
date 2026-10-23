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
import { FOCUS_OUTLINE } from '@/lib/focus';
import { SCRIM_PAD } from '@/lib/safeArea';
import { BrassCoin } from '@/components/ui/coin';

// Presentation only — every `content` string is the copy as written, and
// Tutorial.test.js reads it from this file.
//
// `{attack}`, `{hp}`, `{cost}` and `{energy}` in the copy draw small twins of
// the marks the card and the board actually show — the red and blue stat
// badges, the brass cost disc, the brass energy bolt — so the words point at
// what the player will see. The copy used to say "Attack (⚔️) and HP (🛡️)",
// and no card draws either: the badges are bare numbers on red and blue, and
// a shield on a card means Taunt. The twins are aria-hidden; the words round
// them say the same thing.
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
    content: "1. Draw — take a card. It's probably a bad one. Play it anyway.\n2. Your move — play teddies, traps and specials, and send ready teddies swinging, in any order, for as long as your energy lasts\n3. End Turn — Chuck's turn to embarrass himself",
    icon: RefreshCw,
    list: true,
  },
  {
    title: "The Cast",
    content: "Action Cards — your goons. Attack {attack} is the red badge, bottom left; HP {hp} is the blue one, bottom right (it goes red once they're hurt), and it's how many beatings they can absorb before going back to fluff. Fresh off the barstool they're Warming Up — no swinging until your next turn. Same rule for Chuck's lot.\nTrap Cards — spring-loaded regret for whoever swings at you\nSpecial Cards — back-alley healing and questionable card advantage",
    icon: Layers,
    list: true,
    icons: [Swords, Bomb, Sparkles],
    showCards: true,
  },
  {
    title: "Energy",
    content: "Cards cost energy: the number on the brass disc {cost} in a card's top-left corner. What you have left is the brass bolt {energy} beside your health. Your first turn gets 3, and it climbs by one every other turn, up to 10 — just like a real bar tab.",
    icon: Zap,
  },
  {
    title: "Rap Sheets (Abilities)",
    content: "Taunt — talks so much shit, enemies HAVE to hit them first\nPiercing — cuts straight through Shield\nShield — takes 50% less damage, the coward\nStealth — untargetable for a turn (currently hiding in your hamper)\nFury — every hit they survive is +1 Attack, up to +3. After that they've peaked, like everyone else in here.\nProtect — while they're upright, nothing else on their side can be touched\nSwarm — costs 1 less once you've already got someone on the table, and its cost disc turns green to say so\nRoyal — struts around giving everyone ELSE +1 Attack. Never itself.",
    icon: ScrollText,
    list: true,
    icons: [Shield, Crosshair, ShieldHalf, Ghost, Flame, Castle, Bug, Crown],
    columns: true,
  },
  {
    title: "Violence 101",
    content: "Pick your teddy, then a victim. Damage comes off the target's HP — they stay on the table until it hits 0, and any leftover damage tramples straight into their owner's face. Every teddy Chuck has standing is a bouncer, big or small (one hiding in Stealth doesn't count): clear them off the table before you can deck Chuck directly. Piercing does NOT walk you past a bouncer — it just carves through the Shielded ones.",
    icon: Swords,
  },
  {
    title: "Momentum & Rally",
    content: "Playing cards and throwing hands builds Momentum. Fill the gauge to 10 with a teddy on the table and the Rally button turns up — cash it in and your whole squad gets +1 Attack and a full restuff. It's the comeback button, and Chuck thinks it should be illegal.",
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
// The creature shown under The Cast: the twins in the copy carry her numbers,
// so the words and the card below them agree.
const SAMPLE = exampleCards.find((c) => c.type === 'action');

// The stat badges' faces, as TeddyCard paints them (its ATTACK_TONE and
// HP_TONE; Tutorial.test.js fails if the two drift apart).
const ATTACK_DISC = 'linear-gradient(180deg, #dc2626, #7f1d1d)';
const HP_DISC = 'linear-gradient(180deg, #0369a1, #0c4a6e)';

// The same enamel pin as the card's StatBadge, at text size and in the line
// rather than pinned to a corner.
const StatDisc = ({ tone, value }) => (
  <span
    aria-hidden="true"
    data-twin=""
    className="mx-0.5 inline-grid h-[18px] min-w-[18px] place-items-center rounded-full px-[3px] align-[-4px] font-display text-[10px] font-extrabold leading-none tabular-nums text-white ring-[1.5px] ring-night-950 shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
    style={{
      background: `radial-gradient(ellipse 70% 32% at 50% 0%, rgba(255,255,255,0.4), transparent 100%), ${tone}`,
      textShadow: '0 1px 1px rgba(0,0,0,0.6)',
    }}
  >
    {value}
  </span>
);

const TWINS = {
  attack: () => <StatDisc tone={ATTACK_DISC} value={SAMPLE?.attack} />,
  hp: () => <StatDisc tone={HP_DISC} value={SAMPLE?.defense} />,
  cost: () => (
    <span aria-hidden="true" data-twin="" className="mx-0.5 inline-block align-[-4px]">
      <BrassCoin size="card">{SAMPLE?.cost}</BrassCoin>
    </span>
  ),
  // The board's energy plaque: a bolt struck on brass.
  energy: () => (
    <span aria-hidden="true" data-twin="" className="mx-0.5 inline-block align-[-4px]">
      <BrassCoin size="card"><Zap className="h-[11px] w-[11px]" fill="currentColor" strokeWidth={2} /></BrassCoin>
    </span>
  ),
};

// Copy with its twins drawn in. Splitting on a capture group keeps the token
// names at the odd indices.
const Rich = ({ text }) => text.split(/\{(attack|hp|cost|energy)\}/).map((part, i) => {
  if (i % 2 === 0) return part;
  const Twin = TWINS[part];
  return <Twin key={i} />;
});

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
        <p className="mt-0.5 text-sm leading-snug text-plush-200"><Rich text={text} /></p>
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
  // long step read to the bottom left the next one opening half-way down. On
  // a short screen the scrim is what scrolls (see the panel), so it goes back
  // to the top too.
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    if (dialogRef.current) dialogRef.current.scrollTop = 0;
  }, [currentStep, dialogRef]);

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
      className={`fixed inset-0 z-50 dialog-scrim flex items-start justify-center overflow-y-auto ${SCRIM_PAD}`}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        // A fixed frame: the header, the progress bar and the Previous/Next
        // row stay put and only the step itself scrolls, so the controls are
        // always in reach on a phone.
        //
        // Fixed in height too, not only capped. With max-h alone the panel
        // took each step's natural height and my-auto re-centred it, so Next
        // moved by up to 190px between steps on a phone and a player tapping
        // through landed on the scrim or the step instead. Now every step
        // gets the same frame (44rem, or the screen less the scrim's padding
        // when that is smaller), the body scroller takes up the difference,
        // and a short step is centred inside it (see the body).
        //
        // Except on a short screen (500px or less: a landscape phone, a laptop
        // at 200% zoom). There that frame is 180px of a 340px panel, and the
        // medallion and title filled the rest, so every step opened showing
        // not one line of itself. Below 500px the panel takes its natural
        // height and the scrim scrolls the whole step; the header and the
        // progress bar scroll away with it, the Previous/Next row sticks to
        // the bottom of the screen (overflow-clip, not -hidden: a hidden
        // overflow is a scroll container, and the row would stick to the
        // panel instead), and the step's own header tightens.
        className="relative my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl dialog-panel sm:max-h-[calc(100dvh-3rem)] [@media(min-height:501px)]:h-[min(44rem,calc(100dvh-1.5rem))] sm:[@media(min-height:501px)]:h-[min(44rem,calc(100dvh-3rem))] [@media(max-height:500px)]:max-h-none [@media(max-height:500px)]:overflow-clip"
      >
        {/* The light the step's medallion sits in. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_50%_70%_at_50%_15%,rgba(251,191,36,0.12),transparent_70%)]"
        />

        {/* Header */}
        <div className="relative flex items-center gap-3 px-4 pb-2 pt-4 sm:px-6 sm:pt-5 [@media(max-height:500px)]:pb-1 [@media(max-height:500px)]:pt-3">
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
            so their focus may be a ring.

            Each state has a shape as well as a colour, and every bar clears
            3:1 against the panel even under the lamp (#473640, the panel top
            with the light's full 0.12): a step still to come is an empty
            plush-400 capsule (3.6:1), a step done is filled brass-500 (3.5:1),
            and the current one is the brightest and stands taller than both.
            The future steps were white/15 (1.6:1), all but invisible, and the
            current one differed from those done by brightness alone. */}
        <div className="relative flex gap-1.5 px-4 pb-3 sm:px-6 [@media(max-height:500px)]:pb-2">
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
                className={`w-full rounded-full transition-colors ${
                  index === currentStep
                    ? 'h-2.5 bg-gradient-to-r from-brass-200 to-brass-400 shadow-[0_0_10px_rgba(251,191,36,0.65)]'
                    : index < currentStep
                    ? 'h-1.5 bg-brass-500'
                    : 'h-1.5 ring-1 ring-inset ring-plush-400 group-hover:bg-plush-400/40'
                }`}
              />
            </button>
          ))}
        </div>

        {/* Content. Focusable, because most steps hold no control: without a
            tab stop a keyboard user could not scroll a long one. A plain
            element, so its focus may be an (inset) ring.

            A flex column whose step takes my-auto, so a short step sits in
            the middle of the fixed frame. Not justify-center: a centred item
            taller than its box overflows at both ends and its top could not
            be scrolled to, whereas auto margins collapse to 0 once the step
            overflows, and a long one scrolls from its top as before. */}
        <div
          ref={bodyRef}
          role="region"
          aria-labelledby="tutorial-step-title"
          tabIndex={0}
          className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brass-300/70"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="my-auto w-full px-4 pb-6 pt-3 sm:px-10 [@media(max-height:500px)]:pt-1"
            >
              {/* Decoration, so it is the first thing a short screen gives up. */}
              <div
                aria-hidden="true"
                className="mx-auto mb-3 h-14 w-14 rounded-full p-[3px] shadow-[0_0_30px_rgba(251,191,36,0.28),0_12px_24px_-10px_rgba(0,0,0,0.85)] sm:h-16 sm:w-16 [@media(max-height:500px)]:hidden"
                style={{ background: RARITY_METAL.legendary }}
              >
                <div className="grid h-full w-full place-items-center rounded-full bg-night-900">
                  {step.mascot
                    ? <span className="text-[28px] leading-none sm:text-[32px]">🧸</span>
                    : <StepIcon className="h-6 w-6 text-brass-300 sm:h-7 sm:w-7" strokeWidth={1.8} />}
                </div>
              </div>

              {/* plush-200, not -300: it sits in the medallion's light. */}
              <div className="label-caps mb-1.5 text-center text-plush-200 [@media(max-height:500px)]:mb-1">
                Step {currentStep + 1} of {TUTORIAL_STEPS.length}
              </div>
              {/* The gradient is on an inline span cloned per line box, so a
                  title that wraps on a phone gets the whole gradient on each
                  line instead of one gradient stretched over both — which
                  left the top line pale and the bottom one dark. */}
              <h3
                id="tutorial-step-title"
                className="mb-5 text-center font-display text-[22px] font-extrabold leading-tight min-[360px]:text-2xl sm:text-3xl [@media(max-height:500px)]:mb-3 [@media(max-height:500px)]:text-2xl"
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
                    <p key={para} className="leading-relaxed text-plush-200"><Rich text={para} /></p>
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
            brass button can take the row. On a short screen it sticks to the
            bottom of the screen over the scrolling step, on the panel's own
            bottom colour (night-900), so it is opaque there and seamless at
            the panel's foot. A sticky box keeps clear of its scroller's
            padding, so the offset is minus the scrim's (p-3 / sm:p-6): at 0
            the row stopped 12-24px short of the edge, with the step scrolling
            past beneath it. */}
        <div className="relative flex items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-4 sm:px-6 [@media(max-height:500px)]:sticky [@media(max-height:500px)]:-bottom-3 sm:[@media(max-height:500px)]:-bottom-6 [@media(max-height:500px)]:z-10 [@media(max-height:500px)]:bg-night-900 [@media(max-height:500px)]:py-2.5 [@media(max-height:500px)]:shadow-[0_-16px_24px_-16px_rgba(0,0,0,0.9)]">
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
