// The Battle Pass tier a battle's season XP reached, for the result panel's
// "Battle Pass tier N unlocked" line.
//
// Read straight from the pass's reward table. That table used to live in
// BattlePass.jsx, a lazy dialog chunk, so this file kept a hand-copied column
// of its thresholds rather than download the dialog to read one number; the
// table now has a data module of its own (src/lib/battlePass.js) and the copy
// is gone.
export { currentTier as battlePassTier } from '@/lib/battlePass';
