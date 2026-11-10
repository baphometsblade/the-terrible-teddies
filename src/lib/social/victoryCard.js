// A share card for a ladder result. Canvas, no card art: the pictures behind
// the age gate do not leave with the link. Web Share when the browser can
// take a file (iOS 15 Safari can), otherwise the image stays on screen and
// a download is offered. toBlob is the callback form, which iOS 15 has.

import { safeName, tierAt } from './ladder.js';

export const CARD_W = 720;
export const CARD_H = 960;

const PUBLIC_FOOTER = 'A night out. The messy part stayed in.';

/**
 * The words drawn on the card. Every one of them is safe to share.
 * `won` null is a standing, not a result.
 */
export function victorySpec({ name, won = null, tier, rating, rivalName } = {}) {
  const who = safeName(name, 'A player');
  const rung = tier || tierAt(rating).name;
  const figure = Number.isFinite(Number(rating)) ? String(Math.trunc(Number(rating))) : '1000';
  let title = 'On the ladder';
  let line = `${rung} · ${figure}`;
  if (won === true) {
    title = 'Still standing';
    line = `Against ${safeName(rivalName, 'a rival')}`;
  } else if (won === false) {
    title = 'Tapped out';
    line = `Against ${safeName(rivalName, 'a rival')}`;
  }
  return {
    kicker: 'TERRIBLE TEDDIES',
    title,
    name: who,
    line,
    tier: rung,
    rating: figure,
    footer: PUBLIC_FOOTER,
    aria: `${who}, ${rung}, rating ${figure}. ${title}.`,
    fileName: 'terrible-teddies-brawl.png',
  };
}

/**
 * Draw into a 2d context. Returns false when there is nothing to draw on
 * (jsdom, an old webview). Positions are fixed so a missing font still fits.
 */
export function drawVictoryCard(ctx, spec, width = CARD_W, height = CARD_H) {
  if (!ctx || !spec) return false;
  ctx.fillStyle = '#140e1c';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 8;
  ctx.strokeRect(28, 28, width - 56, height - 56);

  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(28, 28, width - 56, 10);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#d6b25e';
  ctx.font = '600 22px Georgia, "Times New Roman", serif';
  ctx.fillText(spec.kicker, width / 2, 88);

  ctx.fillStyle = '#f8f1e3';
  ctx.font = '700 54px Georgia, "Times New Roman", serif';
  ctx.fillText(spec.title, width / 2, 160);

  ctx.fillStyle = '#fbbf24';
  ctx.font = '700 40px Georgia, "Times New Roman", serif';
  ctx.fillText(spec.name, width / 2, 280);

  ctx.fillStyle = '#e7dcc8';
  ctx.font = '400 28px Georgia, "Times New Roman", serif';
  ctx.fillText(spec.line, width / 2, 360);

  ctx.fillStyle = '#1a1208';
  roundRect(ctx, width / 2 - 180, 460, 360, 120, 16);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.font = '700 28px Georgia, "Times New Roman", serif';
  ctx.fillText(spec.tier, width / 2, 488);
  ctx.font = '700 36px Georgia, "Times New Roman", serif';
  ctx.fillText(spec.rating, width / 2, 530);

  ctx.fillStyle = '#cbb59a';
  ctx.font = '400 20px Georgia, "Times New Roman", serif';
  ctx.fillText(spec.footer, width / 2, height - 120);
  return true;
}

function roundRect(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  // iOS 15 has no Path2D.roundRect (that arrived in 16). A plain rect still
  // reads as a plaque, and the stroke around the card does the framing.
  ctx.beginPath();
  ctx.rect(x, y, w, h);
}

/** PNG blob from a canvas. Callback toBlob, then toDataURL if the blob is empty. */
export function canvasBlob(canvas) {
  return new Promise((resolve) => {
    if (!canvas || typeof canvas.toBlob !== 'function') {
      resolve(null);
      return;
    }
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      try {
        const url = canvas.toDataURL('image/png');
        const binary = atob(url.split(',')[1] || '');
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        resolve(new Blob([bytes], { type: 'image/png' }));
      } catch {
        resolve(null);
      }
    }, 'image/png');
  });
}

/**
 * Share the card. Files when the platform accepts them, text otherwise.
 * A cancelled sheet is 'dismissed', not a failure. 'download' means the
 * caller should keep the image on screen and offer a save.
 */
export async function shareCard(blob, spec, nav = typeof navigator === 'undefined' ? undefined : navigator) {
  const text = `${spec.name} · ${spec.tier} · ${spec.rating}. Terrible Teddies. Your move.`;
  const title = 'Terrible Teddies';
  if (!nav || typeof nav.share !== 'function') return 'download';
  try {
    const file = blob && typeof File === 'function'
      ? new File([blob], spec.fileName, { type: 'image/png' })
      : null;
    if (file && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], text, title });
      return 'shared';
    }
    await nav.share({ text, title });
    return 'shared-text';
  } catch (error) {
    if (error && error.name === 'AbortError') return 'dismissed';
    return 'download';
  }
}

/** Download fallback. iOS often ignores the download attribute; the on-screen image is the real save. */
export function saveBlob(blob, fileName) {
  if (!blob || typeof document === 'undefined') return false;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/**
 * Copy text. Clipboard API first, then a selected textarea, which is what
 * iOS 15 does when the async clipboard is refused outside a secure gesture
 * it did not like. Returns whether the copy landed.
 */
export async function copyText(text) {
  const value = String(text ?? '');
  if (!value || typeof document === 'undefined') return false;
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the textarea.
  }
  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}
