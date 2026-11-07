// Said once, the moment a turn becomes a habit. House voice. No exclamation.

export const COMBO_PLAY = 'Two cards down. That is a habit.';
export const COMBO_SWING = 'Two swings. The table is watching.';

export const comboLine = (kind) => (kind === 'swing' ? COMBO_SWING : COMBO_PLAY);
