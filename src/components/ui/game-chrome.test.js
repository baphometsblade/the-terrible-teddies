import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PackBalanceChip, WalletChips, Medallion } from './game-chrome';

const html = (el) => renderToStaticMarkup(el);
const text = (markup) => markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');

// The Shop's pack chip counted standard packs only, so a player holding one
// Legendary pack read 0 there, while Card Packs counted every tier and printed
// "1 (0+0P+1L)". One chip now, used by both.
describe('PackBalanceChip', () => {
  it('counts every tier, and says the breakdown rather than printing notation', () => {
    const out = html(createElement(PackBalanceChip, { regular: 2, premium: 0, legendary: 1 }));
    expect(text(out)).toBe('3 packs to open: 2 standard, 1 legendary');
    expect(out).not.toMatch(/\d+\+\d+P\+\d+L/);
    // One pip per special-or-held tier: standard and legendary here.
    expect(out.match(/data-pack-pips[^>]*>(.*?)<\/span><span class="sr-only"/)[1].match(/<span/g)).toHaveLength(2);
  });

  it('shows no pips for standard packs alone', () => {
    const out = html(createElement(PackBalanceChip, { regular: 4 }));
    expect(text(out)).toBe('4 packs to open');
    expect(out).not.toContain('data-pack-pips');
  });
});

describe('WalletChips', () => {
  it('renders only the balances it is given', () => {
    expect(text(html(createElement(WalletChips, { coins: 1234, gems: 56 })))).toBe('1,234 coins 56 gems');
    expect(text(html(createElement(WalletChips, {
      coins: 0, gems: 0, packs: { regular: 1, premium: 1, legendary: 0 },
    })))).toBe('0 coins 0 gems 2 packs to open: 1 standard, 1 premium');
  });

  it('is the wallet both store dialogs show, with no local copies left behind', () => {
    for (const file of ['src/components/Shop.jsx', 'src/components/CardPackOpening.jsx']) {
      const src = read(file);
      expect(src, `${file} should render <WalletChips>`).toMatch(/<WalletChips[\s\S]*?packs=\{\{\s*regular: cardPacks, premium: premiumPacks, legendary: legendaryPacks\s*\}\}/);
      expect(src, `${file} still defines its own tile hover`).not.toMatch(/TILE_HOVER|hover:\[background-image/);
      expect(src, `${file} still defines its own SectionHeading`).not.toMatch(/const SectionHeading\s*=/);
    }
  });
});

describe('Medallion', () => {
  // The Battle Pass header hand-built its own medallion because none of these
  // sizes stepped from 48px to 56px, and its tiles needed one that fits their
  // 32px art slot. Both are sizes here now.
  it('has the tile size and the header size that steps up at lg', () => {
    expect(html(createElement(Medallion, { size: 'xs' }))).toMatch(/class="[^"]*\bh-8 w-8\b/);
    const header = html(createElement(Medallion, { size: 'smToLg' }));
    expect(header).toMatch(/class="[^"]*\bh-12 w-12\b[^"]*\blg:h-14 lg:w-14\b/);
  });

  it('is the Battle Pass header medallion, not a local copy', () => {
    const src = read('src/components/BattlePass.jsx');
    expect(src).toMatch(/<Medallion\s+size="smToLg"\s+icon=\{Trophy\}/);
    expect(src, 'BattlePass.jsx hand-builds a medallion again').not.toMatch(/style=\{\{ background: RARITY_METAL\.legendary \}\}/);
  });
});
