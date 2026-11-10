// What a creature does the moment it sits down. Pure: the board, Chuck's
// turn, and the headless sim all call this, so a coin flip or a seat swap
// cannot exist on one side of the table only.

const clone = (field) => (field || []).map((card) => ({ ...card }));

const findSeat = (field, card) => {
  if (card?.instanceId != null) {
    const byId = field.findIndex((row) => row.instanceId === card.instanceId);
    if (byId >= 0) return byId;
  }
  return field.lastIndexOf(card);
};

const replaceAt = (field, index, card) => field.map((row, i) => (i === index ? card : row));

const pickIndex = (length, random) => {
  if (length <= 0) return -1;
  return Math.min(length - 1, Math.floor(random() * length));
};

/** Nice on [0, 0.5), Naughty on [0.5, 1). */
export const flipCoin = (random = Math.random) => (random() < 0.5 ? 'nice' : 'naughty');

const enemyCreatures = (field) => field
  .map((card, index) => ({ card, index }))
  .filter((row) => row.card.type === 'action');

export const spillEggnog = (enemyField, random = Math.random) => {
  const field = clone(enemyField);
  const options = enemyCreatures(field).filter((row) => !row.card.hungover);
  const pool = options.length ? options : enemyCreatures(field);
  if (!pool.length) return { enemyField: field, target: null };
  const picked = pool[pickIndex(pool.length, random)];
  const target = { ...picked.card, hungover: true };
  return { enemyField: replaceAt(field, picked.index, target), target };
};

export const regiftAttack = (ownField, enemyField, instanceId, random = Math.random) => {
  const own = clone(ownField);
  const enemy = clone(enemyField);
  const from = own.findIndex((card) => card.instanceId === instanceId);
  const options = enemyCreatures(enemy);
  if (from < 0 || !options.length) return { ownField: own, enemyField: enemy, swapped: null };
  const picked = options[pickIndex(options.length, random)];
  const mine = own[from];
  const theirs = picked.card;
  const nextMine = { ...mine, attack: theirs.attack };
  const nextTheirs = { ...theirs, attack: mine.attack };
  return {
    ownField: replaceAt(own, from, nextMine),
    enemyField: replaceAt(enemy, picked.index, nextTheirs),
    swapped: { yours: nextMine, theirs: nextTheirs },
  };
};

/**
 * Kiss the enemy in the opposite seat (or the nearest bear) and trade
 * places. Both come away kissed, so neither swings until their side is
 * readied again.
 */
export const mistletoeKiss = (ownField, enemyField, instanceId) => {
  const own = clone(ownField);
  const enemy = clone(enemyField);
  const from = own.findIndex((card) => card.instanceId === instanceId);
  const options = enemyCreatures(enemy);
  if (from < 0 || !options.length) return { ownField: own, enemyField: enemy, swapped: null };
  const opposite = options.find((row) => row.index === from)
    || options.reduce((best, row) => (Math.abs(row.index - from) < Math.abs(best.index - from) ? row : best));
  const mine = { ...own[from], kissed: true, summoningSick: true };
  const theirs = { ...enemy[opposite.index], kissed: true, summoningSick: true };
  const nextOwn = own.slice();
  const nextEnemy = enemy.slice();
  nextOwn[from] = theirs;
  nextEnemy[opposite.index] = mine;
  return { ownField: nextOwn, enemyField: nextEnemy, swapped: { yours: mine, theirs } };
};

const applyCoin = ({ card, face, ownHp, enemyHp, maxHp }) => {
  if (card.ability === 'naughty') {
    if (face === 'nice') {
      const next = { ...card, attack: card.attack + 2 };
      return { card: next, ownHp, enemyHp, damageToEnemy: 0, healing: 0, log: `${card.name} drew Nice. +2 attack.` };
    }
    const damage = 2;
    return {
      card, ownHp, enemyHp: Math.max(0, enemyHp - damage), damageToEnemy: damage, healing: 0,
      log: `${card.name} drew Naughty. 2 to the face.`,
    };
  }
  if (face === 'nice') {
    const healed = Math.max(0, Math.min(maxHp, ownHp + 3) - ownHp);
    return {
      card, ownHp: ownHp + healed, enemyHp, damageToEnemy: 0, healing: healed,
      log: `${card.name} drew Nice. +${healed} HP.`,
    };
  }
  const damage = 3;
  return {
    card, ownHp, enemyHp: Math.max(0, enemyHp - damage), damageToEnemy: damage, healing: 0,
    log: `${card.name} drew Naughty. 3 to the face.`,
  };
};

/**
 * The arriving card is already on `ownField`. Returns the table after the
 * arrival, plus what the faces owe.
 */
export const resolveArrival = ({
  card,
  ownField,
  enemyField,
  ownHp,
  enemyHp,
  random = Math.random,
  maxHp = 30,
}) => {
  const logs = [];
  let own = clone(ownField);
  let enemy = clone(enemyField);
  let hp = ownHp;
  let foe = enemyHp;
  let damageToEnemy = 0;
  let healing = 0;
  const seat = findSeat(own, card);
  const write = (next) => {
    if (seat >= 0) own = replaceAt(own, seat, next);
  };

  if (card?.ability === 'eggnog') {
    const spilled = spillEggnog(enemy, random);
    enemy = spilled.enemyField;
    // A sure skip made every other bear in the deck better than the curve
    // allows. The nog is a coin: half the time it sits them down, half the
    // time Eddie keeps the round and hits harder.
    const lands = spilled.target && flipCoin(random) === 'naughty';
    if (spilled.target && !lands) {
      enemy = enemy.map((row) => (
        row.instanceId === spilled.target.instanceId ? { ...row, hungover: false } : row
      ));
    }
    if (!spilled.target || !lands) {
      if (seat >= 0) write({ ...own[seat], attack: own[seat].attack + 1 });
      logs.push(spilled.target
        ? `${card.name} poured for ${spilled.target.name}. It agreed with him. +1 attack.`
        : `${card.name} poured, and drank it. +1 attack.`);
    } else {
      logs.push(`${card.name} poured for ${spilled.target.name}. They miss their next swing.`);
    }
  }

  if (card?.ability === 'regift') {
    const gifted = regiftAttack(own, enemy, card.instanceId, random);
    own = gifted.ownField;
    enemy = gifted.enemyField;
    logs.push(gifted.swapped
      ? `${card.name} swapped attack with ${gifted.swapped.theirs.name}. ${gifted.swapped.yours.attack} for ${gifted.swapped.theirs.attack}.`
      : `${card.name} had nobody to regift.`);
  }

  if (card?.ability === 'mistletoe') {
    const kissed = mistletoeKiss(own, enemy, card.instanceId);
    own = kissed.ownField;
    enemy = kissed.enemyField;
    logs.push(kissed.swapped
      ? `${card.name} kisses ${kissed.swapped.theirs.name}. They trade seats.`
      : `${card.name} holds the sprig up. Nobody is opposite.`);
  }

  if (card?.ability === 'naughty' || card?.ability === 'sack') {
    const face = flipCoin(random);
    const landed = applyCoin({ card: seat >= 0 ? own[seat] : card, face, ownHp: hp, enemyHp: foe, maxHp });
    write(landed.card);
    hp = landed.ownHp;
    foe = landed.enemyHp;
    damageToEnemy += landed.damageToEnemy;
    healing += landed.healing;
    logs.push(landed.log);
  }

  return { ownField: own, enemyField: enemy, ownHp: hp, enemyHp: foe, logs, damageToEnemy, healing };
};
