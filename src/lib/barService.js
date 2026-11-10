// Chuck's bar service. Pure, so the board, the headless sim and the tests
// share one resolution of his drinks. A card the engine does not know
// returns null and the older heal / draw / buff path is left alone.
//
// Last call is the same 5 HP the board already uses (LAST_CALL_HP).

export const LAST_ORDERS_HP = 5;
export const POUR_EXTRA = 2;
export const TAB_TIP = 1;
export const ORDERS_BONUS = 2;

const amountOf = (card) => Math.max(0, Math.floor(Number(card?.amount) || 0));

export const pourExtra = (field) => (
  (field || []).some((card) => card?.type === 'action' && card.ability === 'pour') ? POUR_EXTRA : 0
);

export const ordersBonus = (card, health, lastCall = LAST_ORDERS_HP) => (
  card?.ability === 'orders' && Number.isFinite(Number(health)) && Number(health) <= lastCall
    ? ORDERS_BONUS
    : 0
);

/** A survivor of Cutoff sits the next attack out. Anyone else is unchanged. */
export const applyCutoff = (attacker, survivor) => {
  if (!survivor || attacker?.ability !== 'cutoff') return survivor;
  return { ...survivor, hungover: true };
};

export const tabTip = (field) => (
  (field || []).some((card) => card?.type === 'action' && card.ability === 'tab') ? TAB_TIP : 0
);

const landHeal = (health, amount, maxHealth) => {
  const before = Math.max(0, Number(health) || 0);
  const cap = Math.max(0, Number(maxHealth) || 0);
  const next = Math.min(cap, before + Math.max(0, amount));
  return { health: next, healed: next - before };
};

const topCreatures = (field, amount) => {
  let topped = 0;
  const next = (field || []).map((card) => {
    if (card?.type !== 'action') return card;
    const hp = card.currentHp ?? card.defense ?? 0;
    const room = Math.max(0, (card.defense ?? 0) - hp);
    const gain = Math.min(amount, room);
    if (!gain) return card;
    topped += gain;
    return { ...card, currentHp: hp + gain };
  });
  return { field: next, topped };
};

/**
 * What one Chuck special does. `handRoom` is the space left after the card
 * being played leaves the hand. Returns null for any other card.
 */
export const playBarSpecial = (card, state = {}) => {
  if (!card || card.type !== 'special') return null;
  const amount = amountOf(card);
  const health = Math.max(0, Number(state.health) || 0);
  const maxHealth = Math.max(1, Number(state.maxHealth) || 30);
  const field = state.field || [];
  const pour = pourExtra(field);

  switch (card.effect) {
    case 'topUp': {
      const face = landHeal(health, amount + pour, maxHealth);
      const poured = topCreatures(field, amount);
      return {
        effect: 'topUp',
        ...face,
        field: poured.field,
        topped: poured.topped,
        log: face.healed || poured.topped
          ? `${card.name} tops the table. +${face.healed} for you, ${poured.topped} across the glasses.`
          : `${card.name} did nothing. Everyone was already full.`,
      };
    }
    case 'lastOrders': {
      const desperate = health <= LAST_ORDERS_HP;
      const asked = (desperate ? amount : Math.ceil(amount / 2)) + pour;
      const face = landHeal(health, asked, maxHealth);
      const buffed = desperate
        ? field.map((c) => (c?.type === 'action' ? { ...c, attack: (c.attack || 0) + 1 } : c))
        : field;
      const did = face.healed > 0 || desperate;
      return {
        effect: 'lastOrders',
        desperate,
        ...face,
        field: buffed,
        buff: desperate ? 1 : 0,
        log: did
          ? (desperate
            ? `${card.name}. Last call, so the round is real. +${face.healed} HP, and the table hits harder.`
            : `${card.name}. Not last call yet. +${face.healed} HP, and he waters it.`)
          : `${card.name} did nothing. You were already full, and the lights were not up.`,
      };
    }
    case 'cutOff':
      return {
        effect: 'cutOff',
        energyCut: amount,
        log: `${card.name}. Their next round is short ${amount}. He took the bottle.`,
      };
    case 'onTab': {
      const room = Math.max(0, Math.floor(Number(state.handRoom) || 0));
      const rawSize = state.deckSize ?? (state.deck || []).length;
      const deckSize = Math.max(0, Math.floor(Number(rawSize) || 0));
      const drawn = Math.min(amount, deckSize, room);
      return {
        effect: 'onTab',
        drawn,
        due: amount,
        log: `${card.name}. Drew ${drawn}. The bill is ${amount}, due next round.`,
      };
    }
    default:
      return null;
  }
};

/** Apply `playBarSpecial` to a side that has a hand and a deck. */
export const commitBarSpecial = (side, card) => {
  const bar = playBarSpecial(card, side);
  if (!bar) return null;
  const deck = side.deck || [];
  const drawnCards = deck.slice(0, bar.drawn || 0);
  return {
    ...bar,
    health: bar.health ?? side.health,
    field: bar.field || side.field,
    hand: [...(side.hand || []), ...drawnCards],
    deck: deck.slice(drawnCards.length),
    drawn: drawnCards.length,
    energyCut: bar.energyCut || 0,
    due: bar.due || 0,
    topped: bar.topped || 0,
    buff: bar.buff || 0,
    healed: bar.healed || 0,
  };
};

export const energyAfterCut = (energy, cut) => Math.max(0, (Number(energy) || 0) - Math.max(0, Number(cut) || 0));

export const payTab = (health, due) => {
  const bill = Math.max(0, Math.floor(Number(due) || 0));
  const before = Math.max(0, Number(health) || 0);
  const paid = Math.min(before, bill);
  return { health: before - paid, paid };
};

/** The swinging bear loses attack when the trap collects interest. */
export const applyInterest = (attacker, trap) => {
  const n = Math.floor(Number(trap?.interest) || 0);
  if (!n || attacker?.type !== 'action') return attacker;
  return { ...attacker, attack: Math.max(0, (attacker.attack || 0) - n) };
};
