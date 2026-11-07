import { describe, expect, it } from 'vitest';
import { previewFace, previewStrike, strikePrompt } from './combatPreview';

const bear = (over) => ({
  type: 'action', instanceId: 'a', name: 'Barry', attack: 4, defense: 2, ability: 'none', ...over,
});

describe('previewStrike', () => {
  it('says when the hit kills, halves, tramples, or grows fury', () => {
    const kill = previewStrike(bear({ attack: 4 }), bear({ instanceId: 't', name: 'Sally', defense: 2, currentHp: 2 }), []);
    expect(kill.kills).toBe(true);
    expect(kill.overkill).toBe(2);

    const shield = previewStrike(
      bear({ attack: 4 }),
      bear({ instanceId: 's', ability: 'shield', defense: 5, currentHp: 5 }),
      [],
    );
    expect(shield.halved).toBe(true);
    expect(shield.dmg).toBe(2);
    expect(shield.kills).toBe(false);

    const fury = previewStrike(
      bear({ attack: 1 }),
      bear({ instanceId: 'f', ability: 'fury', attack: 2, defense: 4, currentHp: 4 }),
      [],
    );
    expect(fury.fury).toBe(true);
    expect(fury.hpLeft).toBe(3);
  });
});

describe('strikePrompt', () => {
  it('names the kill on the first legal target, and the one under the finger', () => {
    const sally = bear({ instanceId: 's', name: 'Shit-Talk Sally', attack: 2, defense: 2, currentHp: 2 });
    const mick = bear({ instanceId: 'm', name: 'Sticky Mickey', attack: 1, defense: 5, currentHp: 5 });
    const open = strikePrompt({
      attacker: bear({ name: 'Bar-Fight Barry', attack: 2 }),
      defenderField: [mick, sally],
    });
    expect(open.tail).toMatch(/dmg/);
    expect(open.full).toContain('Sticky Mickey');

    const aimed = strikePrompt({
      attacker: bear({ name: 'Bar-Fight Barry', attack: 4 }),
      defenderField: [mick, sally],
      focusId: 's',
    });
    expect(aimed.tail).toContain('ruins Sally');
    expect(aimed.full).toContain('onto Chuck');
  });

  it('tells a Quickie it cannot reach the face yet', () => {
    const rush = bear({ name: 'Quickie Quinn', ability: 'rush', summoningSick: true, attack: 2 });
    expect(previewFace(rush, [rush]).blocked).toBe('creatures');
    const line = strikePrompt({ attacker: rush, attackerField: [rush], defenderField: [] });
    expect(line.tail).toBe('creatures only');
    expect(line.full).toMatch(/Chuck waits/);
  });

  it('prices a clear face, and a trap that would spring', () => {
    const attacker = bear({ name: 'Barry', attack: 3, summoningSick: false });
    expect(strikePrompt({ attacker, attackerField: [attacker], defenderField: [] }).tail).toBe('3 on Chuck');
    const trap = { type: 'trap', name: 'Honey Trap', amount: 3, instanceId: 't' };
    expect(strikePrompt({
      attacker, attackerField: [attacker], defenderField: [trap],
    }).tail).toBe('trap bites, 3 back');
  });
});
