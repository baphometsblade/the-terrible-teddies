// Guards the CSP's script-src hash against silent drift. vercel.json's
// Content-Security-Policy allows exactly one inline <script> by its SHA-256
// hash (no 'unsafe-inline'). If a future edit changes that script's content
// without updating the hash, the browser blocks it — and since the loader-
// removal call lives inside that very script, the app would boot correctly
// underneath a loading spinner that never goes away, with no visible error.
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { resolve } from 'path';

// Read a repo file with line endings normalised to LF.
//
// This matters for the hash below. Vercel builds from a fresh git checkout on
// Linux, so the index.html that actually ships has LF endings and the digest
// in vercel.json is the LF one. But git's core.autocrlf=true — the default on
// Windows — rewrites index.html to CRLF in the working tree, which changes the
// bytes and therefore the SHA-256. Hashing the raw file made this test fail on
// every Windows checkout while production was perfectly fine. Normalising is a
// no-op on Linux and CI, and makes the test platform-independent.
function readRepoText(relPath) {
  return readFileSync(resolve(process.cwd(), relPath), 'utf8').replace(/\r\n/g, '\n');
}

function inlineScriptContent(html) {
  const re = /<script((?:\s[^>]*)?)>([\s\S]*?)<\/script>/g;
  const blocks = [];
  let m;
  while ((m = re.exec(html))) blocks.push({ attrs: m[1], content: m[2] });
  const inline = blocks.filter((b) => b.content.trim().length > 0 && !/\bsrc=/.test(b.attrs));
  if (inline.length !== 1) {
    throw new Error(`expected exactly 1 inline (non-src) <script> in index.html, found ${inline.length}`);
  }
  return inline[0].content;
}

describe('CSP script-src hash matches the actual inline script in index.html', () => {
  it('the computed sha256 of the inline script is present in vercel.json\'s CSP', () => {
    const html = readRepoText('index.html');
    const content = inlineScriptContent(html);
    const hash = createHash('sha256').update(content, 'utf8').digest('base64');

    const vercelConfig = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'));
    const cspHeader = vercelConfig.headers
      .flatMap((h) => h.headers)
      .find((h) => h.key === 'Content-Security-Policy')?.value;

    expect(cspHeader, 'no Content-Security-Policy header found in vercel.json').toBeDefined();
    expect(
      cspHeader.includes(`'sha256-${hash}'`),
      `index.html's inline script hash (sha256-${hash}) is not present in vercel.json's ` +
        `script-src — the CSP is stale. Recompute and update the hash, or the loader script ` +
        `will be silently blocked in production (the app boots but the loading spinner never ` +
        `clears, since the removal call lives inside the blocked script).`
    ).toBe(true);
  });

  it("the PostHog api_host configured in analytics.js is allowed by the CSP's connect-src", () => {
    // This drifted once: analytics.js configured 'https://app.posthog.com',
    // which posthog-js silently rewrites to 'https://us.i.posthog.com' — a
    // host the CSP didn't allow. Result: in production every analytics event
    // AND the ErrorBoundary fatal-crash reporting was CSP-blocked, silently
    // (local verification without a PostHog key never initializes posthog and
    // so can't catch it). Pin the two files to each other: the exact host
    // string configured in analytics.js must appear in connect-src, and it
    // must be the canonical ingestion host (not the legacy app.posthog.com
    // that posthog-js rewrites away).
    const analyticsSrc = readFileSync(resolve(process.cwd(), 'src/utils/analytics.js'), 'utf8');
    const hostMatch = analyticsSrc.match(/api_host:\s*'([^']+)'/);
    expect(hostMatch, 'no api_host found in src/utils/analytics.js').not.toBeNull();
    const apiHost = hostMatch[1];

    expect(
      apiHost,
      "api_host must not be the legacy 'https://app.posthog.com' — posthog-js rewrites it " +
        'internally to us.i.posthog.com, so the configured host would never match real traffic'
    ).not.toBe('https://app.posthog.com');

    const vercelConfig = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'));
    const cspHeader = vercelConfig.headers
      .flatMap((h) => h.headers)
      .find((h) => h.key === 'Content-Security-Policy')?.value;
    const connectSrc = cspHeader.split(';').map((d) => d.trim()).find((d) => d.startsWith('connect-src'));

    expect(
      connectSrc.includes(apiHost),
      `analytics.js sends PostHog traffic to ${apiHost}, but vercel.json's connect-src ` +
        `(${connectSrc}) does not allow it — all analytics and crash reports would be ` +
        'silently CSP-blocked in production'
    ).toBe(true);
  });

  it("the CSP's connect-src also allows PostHog's -assets host (remote config)", () => {
    // Ingestion (events) and static assets/remote-config live on DIFFERENT
    // hosts: api_host us.i.posthog.com but config/array assets on
    // us-assets.i.posthog.com. Allowing only the ingestion host lets events
    // through while silently blocking the remote-config fetch — a partial,
    // hard-to-spot breakage. Derive the assets host from api_host by the
    // documented "<region>-assets.i.posthog.com" convention and require it.
    const analyticsSrc = readFileSync(resolve(process.cwd(), 'src/utils/analytics.js'), 'utf8');
    const apiHost = analyticsSrc.match(/api_host:\s*'([^']+)'/)[1];
    const assetsHost = apiHost.replace(/^https:\/\/([a-z]+)\.i\.posthog\.com$/, 'https://$1-assets.i.posthog.com');
    expect(assetsHost, `could not derive an assets host from api_host ${apiHost}`).not.toBe(apiHost);

    const vercelConfig = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'));
    const cspHeader = vercelConfig.headers
      .flatMap((h) => h.headers)
      .find((h) => h.key === 'Content-Security-Policy')?.value;
    const connectSrc = cspHeader.split(';').map((d) => d.trim()).find((d) => d.startsWith('connect-src'));

    expect(
      connectSrc.includes(assetsHost),
      `PostHog serves remote config from ${assetsHost}, but vercel.json's connect-src ` +
        `(${connectSrc}) does not allow it — remote config would be silently CSP-blocked`
    ).toBe(true);
  });

  it('index.html has no dynamically-injected inline event-handler or style attributes', () => {
    // Both would be silently dropped by this CSP (script-src has no
    // 'unsafe-inline'; style-src's 'unsafe-inline' only covers markup that's
    // present in the initial parse, not injected via innerHTML after the
    // fact in every browser). Keep the fallback UI's interactivity wired
    // through addEventListener + CSS classes, not onclick=/style= strings.
    const html = readRepoText('index.html');
    // Require the actual attribute shape (name=" or name=') so this doesn't
    // false-positive on a comment merely discussing onclick=/style= by name.
    expect(html).not.toMatch(/\bonclick\s*=\s*["']/i);
    expect(html).not.toMatch(/\.innerHTML\s*=[\s\S]*?\bstyle\s*=\s*["']/i);
  });
it('the boot-failure timeout does not kill the mount poll', () => {
    // Regression guard: the 10s "Couldn't load the game" fallback used to call
    // clearInterval(poll) before swapping in the error card. On a slow boot
    // that mounts React AFTER the timeout fires (congested mobile, a
    // stalled-then-resumed chunk), killing the poll left the error card
    // covering a fully working app forever. The poll must survive the timeout
    // so a late mount still triggers removeLoader(). This asserts the ONLY
    // clearInterval(poll) is the one inside the poll's own success branch, not
    // inside the setTimeout handler.
    const html = readRepoText('index.html');
    const script = inlineScriptContent(html);
    // Anchor on the poll's own "}, 100);" so the capture starts at the 10s
    // setTimeout, not an earlier one (a loose match would swallow the poll body
    // and its legitimate clearInterval).
    const timeoutBody = /\}, 100\);\s*setTimeout\(function \(\) \{([\s\S]*?)\}, 10000\)/.exec(script);
    expect(timeoutBody, 'could not find the 10s boot-failure timeout in index.html').toBeTruthy();
    expect(
      /clearInterval\(poll\)/.test(timeoutBody[1]),
      'the boot-failure timeout clears the mount poll — a late React mount would then ' +
        'never remove the "Couldn\'t load" overlay from a working app. Leave the poll running.'
    ).toBe(false);
    // And there is exactly one clearInterval(poll) total (the poll's success branch).
    expect((script.match(/clearInterval\(poll\)/g) || []).length).toBe(1);
  });
});
