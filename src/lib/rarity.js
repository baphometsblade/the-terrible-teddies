// Single source of truth for rarity styling across the app. Every surface
// that colors by rarity (TeddyCard frames, pack-opening reveals, deck builder,
// collection, battle pass) reads from this map so the tiers can never drift.
//
// Palette: "toy chest after dark" — dark tinted card faces with saturated
// accents that read against night/plush surfaces. Legendary is brass, the
// game's signature accent, not generic gold.

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const RARITY = {
  common: {
    // dark card-face gradient (TeddyCard frame)
    bg: 'from-plush-800 to-night-800',
    // saturated gradient for chips, filter pills, and glows on dark panels
    gradient: 'from-stone-400 to-stone-600',
    border: 'border-stone-400',
    borderHex: '#a8a29e',
    glow: 'shadow-stone-400/40',
    // light tint readable on dark surfaces
    text: 'text-stone-300',
    hex: ['#a8a29e', '#d6d3d1'],
  },
  uncommon: {
    bg: 'from-emerald-900 to-night-800',
    gradient: 'from-emerald-400 to-emerald-600',
    border: 'border-emerald-500',
    borderHex: '#10b981',
    glow: 'shadow-emerald-400/50',
    text: 'text-emerald-300',
    hex: ['#34d399', '#10b981', '#6ee7b7'],
  },
  rare: {
    bg: 'from-sky-900 to-night-800',
    gradient: 'from-sky-400 to-sky-600',
    border: 'border-sky-500',
    borderHex: '#0ea5e9',
    glow: 'shadow-sky-400/50',
    text: 'text-sky-300',
    hex: ['#38bdf8', '#7dd3fc', '#0ea5e9'],
  },
  epic: {
    bg: 'from-purple-900 to-night-800',
    gradient: 'from-purple-400 to-purple-600',
    border: 'border-purple-500',
    borderHex: '#a855f7',
    glow: 'shadow-purple-400/50',
    text: 'text-purple-300',
    hex: ['#9333ea', '#a855f7', '#c084fc'],
  },
  legendary: {
    bg: 'from-amber-900 via-night-800 to-amber-950',
    gradient: 'from-brass-300 to-brass-500',
    border: 'border-brass-400',
    borderHex: '#f59e0b',
    glow: 'shadow-brass-300/80',
    text: 'text-brass-300',
    hex: ['#fbbf24', '#f59e0b', '#d97706'],
  },
};
