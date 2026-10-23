import {
  Trophy, Star, Crown, Flame, Library, Archive, Warehouse, BadgeCheck, Gamepad2,
  Bomb, HeartPulse, ShieldCheck, Swords, ChevronsUp, Medal, CalendarCheck,
} from 'lucide-react';

// Each achievement's badge, by the name ACHIEVEMENTS gives it (gameStore.js
// keeps plain data, so the store does not import the icon set). They were
// emoji, which every platform draws differently and which read as stickers
// beside the game's own line icons; the unlock toast and the Player Stats list
// now draw the same icon on the same medallion. Where Player Stats already has
// an icon for the same thing (Battles, Victories, the streak, total damage and
// healing) the achievement uses it; none borrows one that means something else
// there (HeartCrack is Defeats, TrendingUp the win rate).
export const ACHIEVEMENT_ICONS = Object.freeze({
  Trophy, Star, Crown, Flame, Library, Archive, Warehouse, BadgeCheck, Gamepad2,
  Bomb, HeartPulse, ShieldCheck, Swords, ChevronsUp, Medal, CalendarCheck,
});

/** The icon component for an achievement, a trophy for one with none. */
export const achievementIcon = (achievement) =>
  (Object.prototype.hasOwnProperty.call(ACHIEVEMENT_ICONS, achievement?.icon)
    ? ACHIEVEMENT_ICONS[achievement.icon]
    : Trophy);
