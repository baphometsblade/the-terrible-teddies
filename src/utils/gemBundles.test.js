// Guards the four gem-bundle price tables against drift. Two shipped bugs
// (false Starter Bundle contents, an inverted price curve) were caused by
// these tables disagreeing — the webhook refuses to credit on any mismatch,
// so drift doesn't just mislead the UI, it breaks fulfillment.
import { readFileSync } from 'fs';
import { resolve } from 'path';

const root = process.cwd();
const read = (p) => readFileSync(resolve(root, p), 'utf8');

// { id: { gems, bonus, price } } from the Deno edge functions (price in cents)
function parseServerTable(source) {
  const table = {};
  const re = /(\w+):\s*\{\s*gems:\s*(\d+),\s*bonus:\s*(\d+),\s*price:\s*(\d+)/g;
  let m;
  while ((m = re.exec(source))) {
    table[m[1]] = { gems: Number(m[2]), bonus: Number(m[3]), price: Number(m[4]) };
  }
  return table;
}

const checkout = parseServerTable(read('supabase/functions/create-checkout-session/index.ts'));
const webhook = parseServerTable(read('supabase/functions/stripe-webhook/index.ts'));
const shopSrc = read('src/components/Shop.jsx');
const purchaseSrc = read('src/components/PurchaseSuccess.jsx');

// Shop gem-bundle tiles: { id, gems, price (dollars), bonus }
function parseShopBundles() {
  const out = [];
  const re = /id:\s*'(\w+)',\s*gems:\s*(\d+),\s*price:\s*([\d.]+),\s*bonus:\s*(\d+)/g;
  let m;
  while ((m = re.exec(shopSrc))) {
    out.push({ id: m[1], gems: Number(m[2]), price: Number(m[3]), bonus: Number(m[4]) });
  }
  return out;
}

// Special-offer buy buttons: handleGemPurchase({ id, gems, bonus, price })
function parseShopOffers() {
  const out = [];
  const re = /handleGemPurchase\(\{\s*id:\s*'(\w+)',\s*gems:\s*(\d+),\s*bonus:\s*(\d+),\s*price:\s*([\d.]+)/g;
  let m;
  while ((m = re.exec(shopSrc))) {
    out.push({ id: m[1], gems: Number(m[2]), bonus: Number(m[3]), price: Number(m[4]) });
  }
  return out;
}

// PurchaseSuccess analytics prices: { id: dollars }
function parseAnalyticsPrices() {
  const block = purchaseSrc.match(/const BUNDLE_PRICES = \{([\s\S]*?)\};/)[1];
  const out = {};
  const re = /(\w+):\s*([\d.]+)/g;
  let m;
  while ((m = re.exec(block))) out[m[1]] = Number(m[2]);
  return out;
}

describe('gem bundle price tables stay in sync', () => {
  it('parsed a plausible number of bundles from each source', () => {
    expect(Object.keys(checkout).length).toBeGreaterThanOrEqual(7);
    expect(Object.keys(webhook).length).toBeGreaterThanOrEqual(7);
    expect(parseShopBundles().length).toBeGreaterThanOrEqual(5);
    expect(parseShopOffers().length).toBeGreaterThanOrEqual(2);
  });

  it('checkout and webhook tables are identical', () => {
    expect(webhook).toEqual(checkout);
  });

  it('every Shop tile matches the server table (gems, bonus, price)', () => {
    for (const b of [...parseShopBundles(), ...parseShopOffers()]) {
      const server = checkout[b.id];
      expect(server, `unknown bundle id in Shop.jsx: ${b.id}`).toBeDefined();
      expect(server.gems, `${b.id} gems`).toBe(b.gems);
      expect(server.bonus, `${b.id} bonus`).toBe(b.bonus);
      expect(server.price, `${b.id} price (cents)`).toBe(Math.round(b.price * 100));
    }
  });

  it('analytics BUNDLE_PRICES match the server prices', () => {
    const analytics = parseAnalyticsPrices();
    for (const [id, dollars] of Object.entries(analytics)) {
      expect(checkout[id], `unknown bundle id in BUNDLE_PRICES: ${id}`).toBeDefined();
      expect(Math.round(dollars * 100), `${id} analytics price`).toBe(checkout[id].price);
    }
  });

  it('no bundle strictly dominates a pricier one (price curve sanity)', () => {
    // Sort by price ascending; total gems must strictly increase with price —
    // otherwise a cheaper SKU gives more gems and the pricier one is dead
    // weight (the "Mega Gem Pack at $1.99" bug).
    const rows = Object.values(checkout)
      .map(b => ({ price: b.price, total: b.gems + b.bonus }))
      .sort((a, b) => a.price - b.price);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].total, `bundle at $${rows[i].price / 100} must out-gem the cheaper $${rows[i - 1].price / 100}`)
        .toBeGreaterThan(rows[i - 1].total);
    }
  });
});
