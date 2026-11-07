// The aside a big hit gets. The number in the log is the fact. This is the
// wink that goes with the gold flash: short, house-voiced, no exclamation
// marks. The word on the animation is even shorter, so it fits over a card.

export const hitFlavor = ({ killed = false, overkill = 0, dmg = 0 } = {}) => {
  if (overkill > 0) return 'extra';
  if (killed) return 'spent';
  if (dmg >= 5) return 'deep';
  return '';
};

export const hitAside = ({
  attacker = 'Someone',
  target = '',
  killed = false,
  overkill = 0,
  dmg = 0,
  face = false,
  foe = 'Chuck',
} = {}) => {
  if (overkill > 0) return `${overkill} kept going, and ${foe} caught the rest.`;
  if (face && (killed || dmg >= 5)) return `Right on the mouth. ${foe} will be tasting that.`;
  if (killed && target) return `${attacker} finished ${target}. The table felt that one.`;
  if (dmg >= 5 && target) return `A deep one. ${target} will be walking funny.`;
  return '';
};
