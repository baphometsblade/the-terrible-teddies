// What a swing will do, before it does it. The board prints the short tail
// on the "Pick a victim" prompt and keeps the full sentence for the same
// element, so a phone with no hover still sees the outcome.

import {
  canSwingFace, effectiveAttack, gainedFuryStack, getValidTargets, resolveCreatureHit,
} from '@/utils/battleUtils';

export const previewStrike = (attacker, target, attackerField) => {
  const { survivor, overkill, dmg } = resolveCreatureHit(attacker, target, attackerField);
  const raw = attackerField ? effectiveAttack(attacker, attackerField) : attacker.attack;
  return {
    dmg,
    kills: survivor == null,
    overkill,
    hpLeft: survivor ? survivor.currentHp : 0,
    halved: target?.ability === 'shield' && attacker?.ability !== 'piercing' && raw > dmg,
    fury: gainedFuryStack(target, survivor),
  };
};

export const previewFace = (attacker, attackerField) => {
  if (!canSwingFace(attacker)) return { blocked: 'creatures', dmg: 0 };
  return { blocked: null, dmg: effectiveAttack(attacker, attackerField) };
};

const lastName = (card) => {
  const bit = String(card?.name || 'them').split(' ').pop();
  return bit.length <= 12 ? bit : `${bit.slice(0, 11)}…`;
};

/**
 * `tail` is the clause after "Pick a victim for Name". `full` is the same
 * fact in a sentence, for the prompt's accessible name.
 */
export const strikePrompt = ({
  attacker,
  attackerField = [],
  defenderField = [],
  focusId = null,
  foeName = 'Chuck',
} = {}) => {
  if (!attacker) return { tail: '', full: '' };
  const targets = getValidTargets(attackerField, defenderField);
  const focused = focusId && focusId !== 'face'
    ? targets.find((t) => t.instanceId === focusId)
    : null;
  const subject = focused || (focusId === 'face' ? null : targets[0]);

  if (subject) {
    const hit = previewStrike(attacker, subject, attackerField);
    if (attacker.ability === 'blackout') {
      return {
        tail: `${hit.dmg} dmg, they pick`,
        full: `${attacker.name} picks a bear. You do not. About ${hit.dmg} if it lands clean.`,
      };
    }
    const who = lastName(subject);
    const tail = hit.kills ? `${hit.dmg} dmg, ruins ${who}` : `${hit.dmg} dmg, ${who} stays`;
    const bits = [`${attacker.name} puts ${hit.dmg} on ${subject.name}.`];
    if (hit.kills) bits.push(hit.overkill ? `Ruins them. ${hit.overkill} keeps going, onto ${foeName}.` : 'Ruins them.');
    else bits.push(`${hit.hpLeft} HP left.`);
    if (hit.halved) bits.push('Rubber takes the edge off.');
    if (hit.fury) bits.push('That one woke the whiskey.');
    return { tail, full: bits.join(' ') };
  }

  const face = previewFace(attacker, attackerField);
  if (face.blocked) {
    return {
      tail: 'creatures only',
      full: `${attacker.name} can take the other bears this turn. ${foeName} waits.`,
    };
  }
  const trap = defenderField.find((c) => c.type === 'trap');
  if (trap) {
    const n = trap.amount || 3;
    return {
      tail: `trap bites, ${n} back`,
      full: `${trap.name} is waiting to bite back for ${n}.`,
    };
  }
  return {
    tail: `${face.dmg} on ${foeName}`,
    full: `${attacker.name} goes for ${foeName}'s mouth, for ${face.dmg}.`,
  };
};
