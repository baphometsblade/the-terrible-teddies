import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { encodeQr, qrSvg } from './qr.js';
import { friendInviteUrl } from './friends.js';

const raster = (modules) => {
  const n = modules.length;
  const quiet = 4;
  const scale = 4;
  const size = (n + quiet * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const row = Math.floor(y / scale) - quiet;
      const col = Math.floor(x / scale) - quiet;
      const on = row >= 0 && col >= 0 && row < n && col < n && modules[row][col];
      const i = (y * size + x) * 4;
      const v = on ? 0 : 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, size };
};

describe('invite QR', () => {
  it('scans back to the invite URL', () => {
    const url = friendInviteUrl('abcdef123456');
    const modules = encodeQr(url);
    expect(modules).toBeTruthy();
    const { data, size } = raster(modules);
    const scanned = jsQR(data, size, size);
    expect(scanned && scanned.data).toBe(url);
  });

  it('draws an SVG with a quiet zone and no script', () => {
    const svg = qrSvg('https://terribleteddies.vercel.app/?friend=abcdef123456');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).not.toMatch(/<script/i);
  });
});
