import { describe, expect, it } from 'vitest';
import { ribbonFor, cleanTag, cleanGangName, reportReason, GANG_MAX, CUP_ROUNDS } from './room';
import { TAUNTS, tauntLine, tauntPublic, tauntId } from './taunts';

const EXPLICIT = /\b(fuck|shit|cock|dick|pussy|slut|whore|nude|naked|porn|nipple|orgasm|horny)\b/i;

describe('the back room', () => {
  it('names a ribbon only for a week that was played', () => {
    expect(ribbonFor(1, true)).toBe('Top stool');
    expect(ribbonFor(3, true)).toBe('On the podium');
    expect(ribbonFor(10, true)).toBe('Trouble');
    expect(ribbonFor(11, true)).toBe('Showed up');
    expect(ribbonFor(1, false)).toBeNull();
  });

  it('keeps gang tags and names boring', () => {
    expect(cleanTag(' ab ')).toBe('');
    expect(cleanTag('hot')).toBe('HOT');
    expect(cleanTag('TOOLONG')).toBe('');
    expect(cleanGangName('The Night Shift')).toBe('The Night Shift');
    expect(cleanGangName('<script>')).toBe('');
    expect(GANG_MAX).toBe(12);
    expect(CUP_ROUNDS).toBe(3);
    expect(reportReason('cheat')).toBe(true);
    expect(reportReason('murder')).toBe(false);
  });

  it('keeps the public taunt a wink and the id an allowlist', () => {
    expect(TAUNTS).toHaveLength(8);
    for (const taunt of TAUNTS) {
      expect(taunt.public).not.toMatch(EXPLICIT);
      expect(taunt.public).not.toBe(taunt.line);
      expect(taunt.short.length).toBeLessThanOrEqual(8);
    }
    expect(tauntLine(1)).toMatch(/stool/);
    expect(tauntPublic(1)).toMatch(/seat/);
    expect(tauntLine(99)).toBeNull();
    expect(tauntId(3)).toBe(3);
    expect(tauntId('nope')).toBeNull();
  });
});
