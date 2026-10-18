import { Package, Gem, Crown } from 'lucide-react';
import { RARITY_ORDER, RARITY_METAL } from '@/lib/rarity';

// The card-pack wrapper, drawn once for both store screens: the Shop's pack
// tiles and the Card Packs table. They used to keep a copy each, and the copies
// had already drifted apart (corner radius, seal depth, icon size, fan spread)
// while a comment called the look "shared".

// One look per pack tier: a metal frame from the rarity ladder over a tinted
// face, with a foil sweep (index.css .foil, CSS-only and off when Animations
// are). Premium wears amethyst (it guarantees rare or better), the Legendary
// pack wears brass, and the standard pack is pewter. `glow` is the light the
// pack sits in on the table, `light` the tier's light pooled on a stage or a
// tile, and title / tag / contents the copy printed on the full-size pack.
export const PACK_LOOK = {
  regular: {
    metal: RARITY_METAL.common,
    face: 'linear-gradient(165deg, #4b2a72 0%, #2b1845 55%, #170d25 100%)',
    Icon: Package,
    tone: 'text-brass-300',
    tagTone: 'text-brass-300',
    foil: 'foil',
    glow: 'rgba(251, 191, 36, 0.28)',
    light: 'rgba(251, 191, 36, 0.14)',
    title: 'Terrible Teddies',
    tag: 'CARD PACK',
    contents: '5 Cards Inside',
  },
  premium: {
    metal: RARITY_METAL.epic,
    face: 'linear-gradient(165deg, #6d28d9 0%, #3b0f6b 55%, #1a0b30 100%)',
    Icon: Gem,
    tone: 'text-fuchsia-200',
    tagTone: 'text-sky-300',
    foil: 'foil foil-epic',
    glow: 'rgba(192, 132, 252, 0.4)',
    light: 'rgba(192, 132, 252, 0.18)',
    title: 'Premium Pack',
    tag: 'GUARANTEED RARE+',
    contents: '5 Cards Inside',
  },
  legendary: {
    metal: RARITY_METAL.legendary,
    face: 'linear-gradient(165deg, #92400e 0%, #7c2d12 45%, #3b1508 100%)',
    Icon: Crown,
    tone: 'text-brass-200',
    tagTone: 'text-brass-200',
    foil: 'foil',
    glow: 'rgba(251, 191, 36, 0.5)',
    light: 'rgba(251, 191, 36, 0.24)',
    title: 'Legendary Pack',
    tag: 'GUARANTEED LEGENDARY!',
    contents: '10 Cards Inside',
  },
};

// The crimped seal along the top and bottom of a foil pack.
export const CRIMP = 'bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.2)_0_1px,rgba(0,0,0,0.25)_1px_3px)]';

// A mini pack's whole geometry is in em, so one drawing serves every size and
// `size` is nothing but a font-size: 10px draws a 40x54 pack, 14px a 56x76 one.
// A responsive size is then just a responsive font-size.
const MINI_SIZE = {
  sm: 'text-[10px]',
  md: 'text-[14px]',
  smToMd: 'text-[10px] sm:text-[14px]',
};

// A bundle of 5 or 10 packs is drawn as a fanned stack, so quantity reads at a
// glance without leaning on the copy. Back to front: left, right, centre. In
// em, so the fan scales with the packs.
export const FAN = {
  1: [''],
  2: ['-rotate-[9deg] -translate-x-[0.9em]', 'rotate-[7deg] translate-x-[0.9em]'],
  3: [
    '-rotate-[13deg] -translate-x-[1.5em] translate-y-[0.4em]',
    'rotate-[13deg] translate-x-[1.5em] translate-y-[0.4em]',
    '',
  ],
};

/** One mini pack wrapper. Takes its size from `size`, or from its parent's font-size. */
export const MiniPack = ({ look, size }) => (
  <span
    aria-hidden="true"
    className={`relative block w-[4em] h-[5.4em] rounded-[0.7em] overflow-hidden shadow-[0_8px_16px_-8px_rgba(0,0,0,0.95)] ${size ? MINI_SIZE[size] : ''}`}
    style={{ border: '2px solid transparent', background: `${look.face} padding-box, ${look.metal} border-box` }}
  >
    <span className={`absolute inset-x-0 top-0 h-[0.45em] ${CRIMP}`} />
    <span className={`absolute inset-x-0 bottom-0 h-[0.45em] ${CRIMP}`} />
    <span className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_30%_10%,rgba(255,255,255,0.22),transparent_60%)]" />
    <span className="absolute inset-0 grid place-items-center">
      <look.Icon className={`w-[1.7em] h-[1.7em] ${look.tone}`} strokeWidth={2.2} />
    </span>
  </span>
);

/** One, a pair or a fan of three mini packs, by quantity (1, 5+, 10+). Decorative. */
export const PackStack = ({ look, quantity = 1, size = 'sm' }) => {
  const layers = quantity >= 10 ? 3 : quantity >= 5 ? 2 : 1;
  return (
    <span className={`grid place-items-center ${MINI_SIZE[size]}`} aria-hidden="true">
      {FAN[layers].map((t, i) => (
        <span key={i} className={`col-start-1 row-start-1 ${t}`}>
          <MiniPack look={look} />
        </span>
      ))}
    </span>
  );
};

/**
 * The pack on the table, at full size, with its tier's copy printed on it.
 *
 * Sized by its content above a floor, not fixed: at a phone's w-48 the copy
 * used to be taller than the pack, so the medallion and the rarity dots rode
 * over the crimped seals. The padding keeps both clear of the seals.
 *
 * `dimmed` (no packs to open) greys the wrapper only — frame, face, medallion
 * and dots — and stops the foil. The printed copy stays at full contrast: at
 * half opacity it fell to 3.4:1.
 */
export const HeroPack = ({ look, dimmed = false }) => (
  <div className="relative flex w-48 min-h-64 sm:w-52 sm:min-h-72 flex-col rounded-2xl shadow-[0_30px_50px_-22px_rgba(0,0,0,0.95)]">
    <div
      aria-hidden="true"
      className={`absolute inset-0 rounded-2xl ${dimmed ? 'saturate-[0.35] brightness-[0.6]' : ''}`}
      style={{ border: '3px solid transparent', background: `${look.face} padding-box, ${look.metal} border-box` }}
    >
      <div className="absolute inset-0 rounded-[13px] overflow-hidden">
        <div className={`absolute inset-x-0 top-0 h-4 ${CRIMP} shadow-[0_2px_4px_rgba(0,0,0,0.35)]`} />
        <div className={`absolute inset-x-0 bottom-0 h-4 ${CRIMP} shadow-[0_-2px_4px_rgba(0,0,0,0.35)]`} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_25%_12%,rgba(255,255,255,0.2),transparent_60%)]" />
        {!dimmed && <div className={`absolute inset-0 pointer-events-none ${look.foil}`} />}
      </div>
    </div>
    <div className="relative flex flex-1 flex-col items-center justify-center px-5 py-7 sm:py-6 text-center">
      <div
        aria-hidden="true"
        className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full p-[3px] shadow-[0_8px_18px_-8px_rgba(0,0,0,0.9)] ${dimmed ? 'saturate-[0.35] brightness-[0.6]' : ''}`}
        style={{ background: look.metal }}
      >
        <div className="grid place-items-center w-full h-full rounded-full bg-night-950/75">
          <look.Icon className={`w-8 h-8 sm:w-9 sm:h-9 ${look.tone}`} strokeWidth={1.75} />
        </div>
      </div>
      <div className="mt-3 sm:mt-4 text-white font-display font-extrabold text-xl sm:text-2xl leading-tight [text-shadow:0_2px_6px_rgba(0,0,0,0.6)]">
        {look.title}
      </div>
      <div className={`mt-1 label-caps ${look.tagTone}`}>{look.tag}</div>
      <div className="text-white/80 text-xs mt-2">{look.contents}</div>
      <div className={`mt-4 flex gap-1.5 ${dimmed ? 'saturate-[0.35] brightness-[0.6]' : ''}`}>
        {RARITY_ORDER.map((rarity) => (
          <div
            key={rarity}
            className="w-2.5 h-2.5 rounded-full ring-1 ring-black/40"
            style={{ background: RARITY_METAL[rarity] }}
            title={rarity}
          />
        ))}
      </div>
    </div>
  </div>
);
