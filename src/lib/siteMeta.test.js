// @vitest-environment node
// (It imports vite.config.js, whose plugins need Node's own TextEncoder.)
import fs from 'node:fs';
import path from 'node:path';
import { siteUrlFrom, socialMetaTags, OG_IMAGE } from './siteMeta';
import { socialMeta } from '../../vite.config.js';

const root = path.resolve(__dirname, '../..');

// Shared links got no picture: index.html's og:image was a relative URL,
// which Facebook's, X's and LinkedIn's scrapers do not resolve. The build now
// writes absolute ones from the site's address, and none without one.
describe('the link preview tags', () => {
  it('takes the site from VITE_SITE_URL, then Vercel\'s production domain, else none', () => {
    expect(siteUrlFrom({ VITE_SITE_URL: 'https://teddies.example/' })).toBe('https://teddies.example');
    expect(siteUrlFrom({ VITE_SITE_URL: 'https://example.com/play/' })).toBe('https://example.com/play');
    expect(siteUrlFrom({ VERCEL_PROJECT_PRODUCTION_URL: 'teddies.vercel.app' })).toBe('https://teddies.vercel.app');
    expect(siteUrlFrom({ VITE_SITE_URL: 'https://a.example', VERCEL_PROJECT_PRODUCTION_URL: 'b.vercel.app' })).toBe('https://a.example');
    expect(siteUrlFrom({})).toBeNull();
    expect(siteUrlFrom({ VITE_SITE_URL: '  ' })).toBeNull();
  });

  it('refuses an address that is not an absolute http(s) URL, rather than ship a broken one', () => {
    expect(() => siteUrlFrom({ VITE_SITE_URL: 'teddies.example' })).toThrow(/absolute URL/);
    expect(() => siteUrlFrom({ VITE_SITE_URL: 'ftp://teddies.example' })).toThrow(/http/);
  });

  it('are all absolute, and describe the image that ships', () => {
    const tags = socialMetaTags('https://teddies.example');
    const content = (key, value) => tags.find((t) => t.attrs[key] === value)?.attrs.content;
    expect(content('property', 'og:url')).toBe('https://teddies.example/');
    expect(content('property', 'og:image')).toBe('https://teddies.example/og-image.jpg');
    expect(content('name', 'twitter:image')).toBe('https://teddies.example/og-image.jpg');
    expect(content('property', 'og:image:alt')).toBeTruthy();
    // The size the tags claim is the size of the file in public/.
    const jpeg = fs.readFileSync(path.join(root, 'public', OG_IMAGE.path));
    const sof = jpeg.findIndex((b, i) => b === 0xff && (jpeg[i + 1] === 0xc0 || jpeg[i + 1] === 0xc2));
    expect(jpeg.readUInt16BE(sof + 7)).toBe(Number(content('property', 'og:image:width')));
    expect(jpeg.readUInt16BE(sof + 5)).toBe(Number(content('property', 'og:image:height')));
  });

  it('are injected by the build plugin only when there is a site to point at', () => {
    const run = (env) => {
      const plugin = socialMeta();
      plugin.configResolved({ env, command: 'build', logger: { warn() {} } });
      return plugin.transformIndexHtml();
    };
    const saved = { site: process.env.VITE_SITE_URL, vercel: process.env.VERCEL_PROJECT_PRODUCTION_URL };
    delete process.env.VITE_SITE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    try {
      expect(run({})).toEqual([]);
      expect(run({ VITE_SITE_URL: 'https://teddies.example' })).toEqual(socialMetaTags('https://teddies.example'));
    } finally {
      if (saved.site !== undefined) process.env.VITE_SITE_URL = saved.site;
      if (saved.vercel !== undefined) process.env.VERCEL_PROJECT_PRODUCTION_URL = saved.vercel;
    }
  });

  it('leave no relative og:image or twitter:image in index.html', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    expect(html).not.toMatch(/property="og:image"/);
    expect(html).not.toMatch(/name="twitter:image"/);
  });
});
