// How Chuck spends a turn, by the difficulty the fight was dealt at.
// Easy and Normal and Hard already differed in energy and in the crew.
// This is the part where they differ in judgement.
//
// The balance sim does not call this. It keeps both sides on the neutral
// greedy player (chooseOpponentPlays / chooseAttackTarget) so a card's win
// rate is about the card, not about which stool Chuck is on.

import { damageToCreatureHp, effectiveAttack, effectiveCost, getValidTargets } from './battleUtils';
import { chooseAttackTarget, chooseOpponentPlays } from './opponentAI';
import { OPPONENT_NAME } from './teddyTalk';

export const MIND_LINES = {
  easy: `${OPPONENT_NAME} is swinging wild. Aim was never his strong suit.`,
  normal: `${OPPONENT_NAME} is playing the top card. He does that with people, too.`,
  hard: `${OPPONENT_NAME} is reading the table. And the neckline. Mostly the neckline.`,
};

export const mindLine = (difficulty) => MIND_LINES[difficulty] || MIND_LINES.normal;

const costOf = (card, field) => effectiveCost(card, field) ?? 0;

const scoreCard = (card, field, enemyField, ownHp, already) => {
  const board = [...field, ...already];
  const cost = costOf(card, board);
  let score = (card.attack || 0) + (card.defense || 0) - cost;
  const enemies = enemyField.filter((c) => c.type === 'action' && !c.stealthActive);
  if (card.ability === 'taunt') score += enemies.length ? 5 : 1;
  if (card.ability === 'protect') score += enemies.length ? 4 : 1;
  if (card.ability === 'shield') score += 2;
  if (card.ability === 'royal') score += board.some((c) => c.type === 'action') ? 4 : 1;
  if (card.ability === 'swarm') score += board.some((c) => c.type === 'action') ? 2 : 0;
  if (card.ability === 'fury') score += 1;
  if (card.ability === 'rush') {
    const kills = enemies.some((c) => damageToCreatureHp(card, c, board) >= (c.currentHp ?? c.defense ?? 0));
    score += kills ? 7 : (enemies.length ? 3 : -1);
  }
  if (card.type === 'special' && card.effect === 'heal') score += ownHp < 20 ? 6 : -6;
  if (card.type === 'special' && card.effect === 'buff') score += board.some((c) => c.type === 'action') ? 5 : -8;
  if (card.type === 'trap') score += 2;
  return score;
};

const planHard = ({ deck, field, energy, maxField, enemyField, ownHp }) => {
  const plays = [];
  const left = [...deck];
  let energyLeft = energy;
  while (plays.length + field.length < maxField && energyLeft > 0) {
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < left.length; i += 1) {
      const cost = costOf(left[i], [...field, ...plays]);
      if (cost > energyLeft) continue;
      const score = scoreCard(left[i], field, enemyField, ownHp, plays);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best < 0 || bestScore < 0) break;
    const [card] = left.splice(best, 1);
    energyLeft -= costOf(card, [...field, ...plays]);
    plays.push(card);
  }
  if (plays.length === 0) return chooseOpponentPlays(deck, field.length, energy, maxField, field);
  const played = new Set(plays);
  return { plays, remainingDeck: deck.filter((c) => !played.has(c)), energyLeft };
};

const planEasy = ({ deck, field, energy, maxField }) => {
  const greedy = chooseOpponentPlays(deck, field.length, energy, maxField, field);
  if (greedy.plays.length <= 1) return greedy;
  const play = greedy.plays.reduce((best, card) => (
    costOf(card, field) < costOf(best, field) ? card : best
  ));
  return {
    plays: [play],
    remainingDeck: deck.filter((c) => c !== play),
    energyLeft: energy - costOf(play, field),
  };
};

/**
 * Which cards Chuck plays this turn.
 * Easy plays a single cheap card. Normal is the old deck-order greedy pass.
 * Hard spends the energy on the cards that answer the table.
 */
export const planOpponentPlays = ({
  difficulty = 'normal',
  deck,
  field = [],
  energy,
  maxField = 3,
  enemyField = [],
  ownHp = 30,
} = {}) => {
  const args = { deck, field, energy, maxField, enemyField, ownHp };
  if (difficulty === 'hard') return planHard(args);
  if (difficulty === 'easy') return planEasy(args);
  return chooseOpponentPlays(deck, field.length, energy, maxField, field);
};

const worstTarget = (targets) => targets.reduce((best, t) => {
  const atk = t.attack ?? 0;
  const hp = t.currentHp ?? t.defense ?? 0;
  const bestAtk = best.attack ?? 0;
  const bestHp = best.currentHp ?? best.defense ?? 0;
  if (atk !== bestAtk) return atk < bestAtk ? t : best;
  return hp > bestHp ? t : best;
});

/**
 * Who this attacker hits. Easy picks the smallest threat. Normal and Hard
 * take the kill the neutral chooser already prefers.
 */
export const planAttackTarget = ({
  difficulty = 'normal',
  attacker,
  targets,
  attackerField,
} = {}) => {
  if (!targets || targets.length === 0) return null;
  if (difficulty === 'easy' && targets.length > 1) return worstTarget(targets);
  return chooseAttackTarget(targets, attacker, attackerField);
};

const killsBlocker = (attacker, blockers, attackerField) => blockers.some((t) => (
  damageToCreatureHp(attacker, t, attackerField) >= (t.currentHp ?? t.defense ?? 0)
));

/**
 * Hard sends the bear who can drop a Catcall or a Wingman first, then the
 * hardest hit. Easy and Normal keep the order the field already has.
 */
export const orderAttackers = ({
  difficulty = 'normal',
  attackers = [],
  attackerField = [],
  enemyField = [],
} = {}) => {
  if (difficulty !== 'hard' || attackers.length < 2) return attackers;
  const blockers = getValidTargets(null, enemyField).filter((t) => t.ability === 'taunt' || t.ability === 'protect');
  return attackers.map((card, index) => ({ card, index })).sort((a, b) => {
    if (blockers.length) {
      const rank = Number(killsBlocker(b.card, blockers, attackerField))
        - Number(killsBlocker(a.card, blockers, attackerField));
      if (rank) return rank;
    }
    const swing = effectiveAttack(b.card, attackerField) - effectiveAttack(a.card, attackerField);
    if (swing) return swing;
    return a.index - b.index;
  }).map(({ card }) => card);
};
