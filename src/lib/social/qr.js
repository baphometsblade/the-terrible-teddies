// Byte-mode QR, error correction L, versions 1 to 5. Enough for a friend
// invite URL. No dependency: the friends screen is already a lazy chunk, and
// iOS 15 Safari can draw the SVG. qr.test.js checks a scanner can read it.

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
})();

const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

const polyMul = (a, b) => {
  const out = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) out[i + j] ^= gfMul(a[i], b[j]);
  }
  return out;
};

const rsGenerator = (nsym) => {
  let gen = [1];
  for (let i = 0; i < nsym; i += 1) gen = polyMul(gen, [1, EXP[i]]);
  return gen;
};

const rsRemainder = (data, nsym) => {
  const gen = rsGenerator(nsym);
  const res = data.concat(new Array(nsym).fill(0));
  for (let i = 0; i < data.length; i += 1) {
    const coef = res[i];
    if (coef === 0) continue;
    for (let j = 0; j < gen.length; j += 1) res[i + j] ^= gfMul(gen[j], coef);
  }
  return res.slice(data.length);
};

// data codewords, ecc codewords, alignment centers. All one RS block at level L.
const VERSIONS = {
  1: { data: 19, ecc: 7, align: [] },
  2: { data: 34, ecc: 10, align: [6, 18] },
  3: { data: 55, ecc: 15, align: [6, 22] },
  4: { data: 80, ecc: 20, align: [6, 26] },
  5: { data: 108, ecc: 26, align: [6, 30] },
};

const pushBits = (bits, value, length) => {
  for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
};

const codewordsFor = (text) => {
  const bytes = [];
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code > 127) return null;
    bytes.push(code);
  }
  let version = 0;
  let spec = null;
  for (let v = 1; v <= 5; v += 1) {
    const room = VERSIONS[v].data * 8 - 12;
    if (bytes.length * 8 <= room) {
      version = v;
      spec = VERSIONS[v];
      break;
    }
  }
  if (!spec) return null;
  const bits = [];
  pushBits(bits, 0b0100, 4);
  pushBits(bits, bytes.length, 8);
  for (let i = 0; i < bytes.length; i += 1) pushBits(bits, bytes[i], 8);
  const cap = spec.data * 8;
  pushBits(bits, 0, Math.min(4, cap - bits.length));
  while (bits.length % 8) bits.push(0);
  const pads = [0xec, 0x11];
  let pad = 0;
  while (bits.length < cap) {
    pushBits(bits, pads[pad % 2], 8);
    pad += 1;
  }
  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let n = 0;
    for (let b = 0; b < 8; b += 1) n = (n << 1) | bits[i + b];
    data.push(n);
  }
  const ecc = rsRemainder(data, spec.ecc);
  const stream = [];
  for (const byte of data.concat(ecc)) {
    for (let b = 7; b >= 0; b -= 1) stream.push((byte >> b) & 1);
  }
  return { version, stream };
};

const formatBits = (mask) => {
  const data = (0b01 << 3) | mask;
  let rem = data << 10;
  const gen = 0b10100110111;
  for (let i = 14; i >= 10; i -= 1) {
    if ((rem >>> i) & 1) rem ^= gen << (i - 10);
  }
  const raw = ((data << 10) | (rem & 0x3ff)) ^ 0x5412;
  const bits = [];
  for (let i = 14; i >= 0; i -= 1) bits.push((raw >>> i) & 1);
  return bits;
};

const masked = (mask, row, col) => {
  switch (mask) {
    case 0: return (row + col) % 2 === 0;
    case 1: return row % 2 === 0;
    case 2: return col % 3 === 0;
    case 3: return (row + col) % 3 === 0;
    case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5: return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6: return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    default: return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
  }
};

const blank = (n) => Array.from({ length: n }, () => Array(n).fill(false));

const reserveFinder = (matrix, reserved, r0, c0) => {
  const n = matrix.length;
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const rr = r0 + r;
      const cc = c0 + c;
      if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
      const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const edge = r === 0 || r === 6 || c === 0 || c === 6;
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      matrix[rr][cc] = inside && (edge || core);
      reserved[rr][cc] = true;
    }
  }
};

const reserveAlignment = (matrix, reserved, cx, cy) => {
  if (reserved[cy][cx]) return;
  for (let r = -2; r <= 2; r += 1) {
    for (let c = -2; c <= 2; c += 1) {
      const on = Math.max(Math.abs(r), Math.abs(c)) !== 1;
      matrix[cy + r][cx + c] = on;
      reserved[cy + r][cx + c] = true;
    }
  }
};

const buildFunction = (version) => {
  const n = 21 + (version - 1) * 4;
  const matrix = blank(n);
  const reserved = blank(n);
  reserveFinder(matrix, reserved, 0, 0);
  reserveFinder(matrix, reserved, 0, n - 7);
  reserveFinder(matrix, reserved, n - 7, 0);
  for (let i = 0; i < n; i += 1) {
    if (!reserved[6][i]) {
      matrix[6][i] = i % 2 === 0;
      reserved[6][i] = true;
    }
    if (!reserved[i][6]) {
      matrix[i][6] = i % 2 === 0;
      reserved[i][6] = true;
    }
  }
  const centers = VERSIONS[version].align;
  for (let a = 0; a < centers.length; a += 1) {
    for (let b = 0; b < centers.length; b += 1) {
      reserveAlignment(matrix, reserved, centers[a], centers[b]);
    }
  }
  matrix[n - 8][8] = true;
  reserved[n - 8][8] = true;
  const formatPos = [];
  const near = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
    [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  for (let i = 0; i < 15; i += 1) {
    formatPos.push(near[i]);
    reserved[near[i][0]][near[i][1]] = true;
  }
  for (let i = 0; i < 7; i += 1) {
    const pos = [n - 1 - i, 8];
    formatPos.push(pos);
    reserved[pos[0]][pos[1]] = true;
  }
  for (let i = 0; i < 8; i += 1) {
    const pos = [8, n - 8 + i];
    formatPos.push(pos);
    reserved[pos[0]][pos[1]] = true;
  }
  return { matrix, reserved, formatPos };
};

const placeData = (matrix, reserved, stream) => {
  const n = matrix.length;
  let bit = 0;
  let upward = true;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    for (let i = 0; i < n; i += 1) {
      const row = upward ? n - 1 - i : i;
      for (let k = 0; k < 2; k += 1) {
        const c = col - k;
        if (reserved[row][c]) continue;
        matrix[row][c] = bit < stream.length ? stream[bit] === 1 : false;
        bit += 1;
      }
    }
    upward = !upward;
  }
};

const applyMask = (matrix, reserved, mask) => {
  const n = matrix.length;
  const out = blank(n);
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      let on = matrix[r][c];
      if (!reserved[r][c] && masked(mask, r, c)) on = !on;
      out[r][c] = on;
    }
  }
  return out;
};

const writeFormat = (matrix, formatPos, bits) => {
  for (let i = 0; i < 15; i += 1) {
    const [r, c] = formatPos[i];
    matrix[r][c] = bits[i] === 1;
    const [r2, c2] = formatPos[15 + i];
    matrix[r2][c2] = bits[i] === 1;
  }
};

const penalty = (matrix) => {
  const n = matrix.length;
  let score = 0;
  const run = (get) => {
    for (let i = 0; i < n; i += 1) {
      let count = 1;
      for (let j = 1; j < n; j += 1) {
        if (get(i, j) === get(i, j - 1)) {
          count += 1;
          if (count === 5) score += 3;
          else if (count > 5) score += 1;
        } else count = 1;
      }
    }
  };
  run((i, j) => matrix[i][j]);
  run((i, j) => matrix[j][i]);
  for (let r = 0; r < n - 1; r += 1) {
    for (let c = 0; c < n - 1; c += 1) {
      const v = matrix[r][c];
      if (v === matrix[r][c + 1] && v === matrix[r + 1][c] && v === matrix[r + 1][c + 1]) score += 3;
    }
  }
  let dark = 0;
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) if (matrix[r][c]) dark += 1;
  }
  score += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return score;
};

/** Boolean modules, dark is true. Null when the text is not ASCII or too long. */
export const encodeQr = (text) => {
  const packed = codewordsFor(String(text ?? ''));
  if (!packed) return null;
  const { matrix, reserved, formatPos } = buildFunction(packed.version);
  placeData(matrix, reserved, packed.stream);
  let best = null;
  let bestScore = Infinity;
  let bestMask = 0;
  for (let mask = 0; mask < 8; mask += 1) {
    const drawn = applyMask(matrix, reserved, mask);
    writeFormat(drawn, formatPos, formatBits(mask));
    const score = penalty(drawn);
    if (score < bestScore) {
      bestScore = score;
      best = drawn;
      bestMask = mask;
    }
  }
  writeFormat(best, formatPos, formatBits(bestMask));
  return best;
};

/**
 * SVG markup for a quiet-zone QR. The caller puts the accessible name on the
 * wrapper; the graphic itself is hidden from the accessibility tree.
 */
export const qrSvg = (text) => {
  const modules = encodeQr(text);
  if (!modules) return '';
  const n = modules.length;
  const quiet = 4;
  const size = n + quiet * 2;
  let rects = '';
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (!modules[r][c]) continue;
      rects += `<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
};
