import { describe, expect, it } from 'vitest';
import { renderSlipPage } from './slipPage';
import { TAUNTS } from './taunts';

const EXPLICIT = /\b(fuck|shit|cock|dick|pussy|slut|whore|nude|naked|porn|nipple|orgasm|horny)\b/i;

describe('fight slip page', () => {
  it('tells the public result and the polite taunt, never the deck or the dirty line', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const html = renderSlipPage({
      id,
      name: 'Ada & <b>',
      rival: 'DreadBear',
      won: true,
      tier: 'Getting Handsy',
      taunt: 1,
    });
    expect(html).toContain('Ada &amp; &lt;b&gt; was still standing');
    expect(html).toContain('They saved you a seat.');
    expect(html).toContain(`https://terribleteddies.vercel.app/slip/${id}`);
    expect(html).not.toContain(TAUNTS[0].line);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(EXPLICIT);
    expect(html).not.toMatch(/user_id|deck/i);
  });

  it('stays generic for a bad id', () => {
    const html = renderSlipPage({ id: 'nope' });
    expect(html).toContain('Someone had a night out');
    expect(html).toContain('href="/"');
  });

  it('links a public tape and ignores a code that is not one', () => {
    const html = renderSlipPage({ id: '11111111-1111-4111-8111-111111111111', replay: 'abc123def456' });
    expect(html).toContain('https://terribleteddies.vercel.app/?replay=abc123def456');
    expect(html).toContain('Watch it back');
    expect(html).not.toMatch(/<script/i);
    const junk = renderSlipPage({ id: '11111111-1111-4111-8111-111111111111', replay: '../secret' });
    expect(junk).not.toContain('Watch it back');
  });
});