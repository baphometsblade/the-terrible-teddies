// What the brand image scripts photograph (see brand.html). `?kind=` picks
// the image: the link preview (og), or an app icon at one of its framings.
// Everything here is the game's own: index.css's materials, the Baloo 2
// wordmark, the menu's card fan with the shipped card art, and the brass
// medallion with the bear that the loader, BootScreen and sign-in share.
import { createRoot } from 'react-dom/client';
import { MotionGlobalConfig } from 'framer-motion';
import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/latin-800.css';
import '@/index.css';
import CardFan from '@/components/CardFan';
import { ALL_CARDS } from '@/stores/gameStore';
import { RARITY_METAL } from '@/lib/rarity';

// Drawn at rest: no entrance springs, and the foil's sweep (a light that
// moves) held off the cards, as the Animations switch holds it.
MotionGlobalConfig.skipAnimations = true;
document.documentElement.dataset.motion = 'off';

const params = new URLSearchParams(window.location.search);
const kind = params.get('kind') || 'og';
const size = Number(params.get('size') || 1024);

// The sign-in screen's key art: the legendary in the centre.
const KEY_ART = ['Mama Mauls', 'The Godfluffer', 'Duke of Dumpsterfire']
  .map((name) => ALL_CARDS.find((c) => c.name === name))
  .filter(Boolean);

// The brand mark: a brass ring (the legendary metal) round a night disc with
// the bear on it, lamplight behind. `d` is its diameter; `ring` the ring's
// share of it, thicker at favicon sizes where a hairline would vanish.
const Mark = ({ d, ring = 0.045, bear = 0.56, glow = true }) => (
  <div className="relative grid place-items-center" style={{ width: d, height: d }}>
    {glow && (
      <div
        className="absolute rounded-full"
        style={{ inset: -d * 0.32, background: 'radial-gradient(closest-side, rgba(251,191,36,0.24), transparent)' }}
      />
    )}
    <div
      className="relative h-full w-full rounded-full"
      style={{ padding: d * ring, background: RARITY_METAL.legendary, boxShadow: `0 ${d * 0.06}px ${d * 0.14}px -${d * 0.05}px rgba(0,0,0,0.9)` }}
    >
      <div
        className="grid h-full w-full place-items-center rounded-full bg-night-900"
        style={{ fontSize: d * bear, lineHeight: 1, fontFamily: '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif' }}
      >
        🧸
      </div>
    </div>
  </div>
);

// Each icon's framing. Maskable: the launcher crops to its own shape, and
// only the centre circle of 80% is sure to survive, so the mark sits well
// inside it on a full-bleed backdrop. Any: a rounded tile, shown as drawn.
// Apple: full bleed and opaque (iOS rounds it, and fills transparency with
// black). Favicon: the mark alone, as large as the square allows.
const ICONS = {
  maskable: { tile: 'square', mark: 0.7 },
  any: { tile: 'rounded', mark: 0.78 },
  apple: { tile: 'square', mark: 0.74 },
  favicon: { tile: 'none', mark: 0.98, ring: 0.08, bear: 0.6, glow: false },
};

const Icon = ({ spec }) => (
  <div
    id="stage"
    className={`relative grid place-items-center overflow-hidden ${spec.tile === 'none' ? '' : 'bar-backdrop'}`}
    style={{ width: size, height: size, borderRadius: spec.tile === 'rounded' ? size * 0.22 : 0 }}
  >
    <Mark d={size * spec.mark} ring={spec.ring} bear={spec.bear} glow={spec.glow !== false} />
  </div>
);

// The link preview, 1200x630: the bar backdrop and its grain, the menu's fan
// of three cards, and the wordmark with the sign-in screen's line.
const OpenGraph = () => (
  <div id="stage" className="bar-backdrop relative overflow-hidden" style={{ width: 1200, height: 630 }}>
    <div className="absolute inset-0 grain pointer-events-none" />
    <div className="relative flex h-full items-center justify-center gap-12 px-20">
      {/* The menu's own fan, enlarged whole so its geometry scales with it. */}
      <div className="grid shrink-0 place-items-center" style={{ width: 440, height: 520 }}>
        <div style={{ transform: 'scale(1.66)' }}>
          <CardFan
            cards={KEY_ART}
            className="w-[230px] h-[200px]"
            cardClassName="scale-[1.3]"
            artVariant="full"
            artLoading="eager"
          />
        </div>
      </div>
      <div className="flex flex-col items-start">
        <Mark d={88} />
        <h1 className="mt-7 whitespace-nowrap font-display text-[84px] font-extrabold leading-none tracking-tight text-brass-gradient">
          Terrible Teddies
        </h1>
        <p className="mt-5 font-display text-[32px] font-semibold leading-snug text-plush-200">
          Stuffed animals. Unstuffed grudges.
        </p>
        <p className="label-caps mt-6 !text-[16px] text-plush-300">A card battler · Bad bears · Worse decisions</p>
      </div>
    </div>
  </div>
);

createRoot(document.getElementById('root')).render(
  kind === 'og' ? <OpenGraph /> : <Icon spec={ICONS[kind] ?? ICONS.any} />
);
