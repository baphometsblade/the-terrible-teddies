import fs from 'node:fs';
import path from 'node:path';

// The icons index.html and the manifest declare, checked against the files.
// The favicon was a 48px PNG named favicon.ico, declared as an SVG in the
// page and as an ICO of size "any" in the manifest, and every manifest icon
// was purpose "any", so Android shrank it onto a white disc.
const root = path.resolve(__dirname, '..');
const pub = (src) => path.join(root, 'public', src.replace(/^\//, ''));
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

// What a file actually is: its type from its first bytes, and a PNG's size.
const sniff = (file) => {
  const b = fs.readFileSync(file);
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { type: 'image/png', size: `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`, alpha: [4, 6].includes(b[25]) || b.includes('tRNS') };
  }
  if (b.readUInt16LE(0) === 0 && b.readUInt16LE(2) === 1) {
    const count = b.readUInt16LE(4);
    const sizes = [...Array(count).keys()].map((i) => b[6 + 16 * i] || 256);
    return { type: 'image/x-icon', sizes };
  }
  return { type: 'unknown' };
};

const manifest = JSON.parse(read('public/manifest.json'));
const html = read('index.html');

describe('the app icons', () => {
  it('are each the type and size the manifest says', () => {
    for (const icon of manifest.icons) {
      const file = sniff(pub(icon.src));
      expect(file.type, icon.src).toBe(icon.type);
      expect(file.size, icon.src).toBe(icon.sizes);
    }
  });

  it('include maskable icons for adaptive launchers, and keep the "any" ones', () => {
    const purposes = (p) => manifest.icons.filter((i) => i.purpose.split(' ').includes(p)).map((i) => i.sizes);
    expect(purposes('maskable')).toEqual(expect.arrayContaining(['512x512']));
    expect(purposes('any')).toEqual(expect.arrayContaining(['192x192', '512x512']));
    // A maskable icon is full bleed: no transparency for the mask to show.
    for (const icon of manifest.icons.filter((i) => i.purpose === 'maskable')) {
      expect(sniff(pub(icon.src)).alpha, icon.src).toBe(false);
    }
  });

  it('give the installed app a stable id', () => {
    expect(manifest.id).toBe('/');
  });

  it('declare the tab icon as what it is', () => {
    const links = [...html.matchAll(/<link rel="icon"([^>]*)>/g)].map(([, attrs]) => ({
      href: attrs.match(/href="([^"]+)"/)[1],
      type: attrs.match(/type="([^"]+)"/)?.[1],
      sizes: attrs.match(/sizes="([^"]+)"/)?.[1],
    }));
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const file = sniff(pub(link.href));
      expect(file.type, link.href).toBe(link.type);
      if (link.sizes) expect(file.size, link.href).toBe(link.sizes);
    }
  });

  it('keep a real /favicon.ico for the clients that ask for it unprompted', () => {
    const ico = sniff(pub('/favicon.ico'));
    expect(ico.type).toBe('image/x-icon');
    expect(ico.sizes).toEqual(expect.arrayContaining([16, 32]));
  });

  it('give iOS an opaque 180px touch icon', () => {
    const href = html.match(/<link rel="apple-touch-icon"[^>]*href="([^"]+)"/)[1];
    expect(sniff(pub(href))).toMatchObject({ type: 'image/png', size: '180x180', alpha: false });
  });
});
