import fs from 'node:fs';
import path from 'node:path';

// game-chrome.jsx is the chrome every lazy dialog shares. Nothing on the boot
// path needed it until TeddyCard (drawn by the main menu) struck its cost on
// BrassCoin, and that one import put the whole module in the entry chunk for
// every visitor. The coin is now a leaf module (coin.jsx) that game-chrome
// re-exports. This walks the static imports from src/main.jsx — dynamic
// import() is the lazy boundary and is not followed — and fails if
// game-chrome is reachable again.
const SRC = path.resolve(__dirname, '../..');
const EXTENSIONS = ['', '.js', '.jsx', '/index.js', '/index.jsx'];

const resolveImport = (from, spec) => {
  let base;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null; // a package
  for (const ext of EXTENSIONS) {
    const file = base + ext;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  return null;
};

// `import x from '…'`, `import '…'` and `export … from '…'`, not `import(…)`.
const STATIC_IMPORT = /^\s*(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/gm;

const bootGraph = () => {
  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file) || !/\.jsx?$/.test(file)) return;
    seen.add(file);
    const source = fs.readFileSync(file, 'utf8');
    for (const [, spec] of source.matchAll(STATIC_IMPORT)) {
      const target = resolveImport(file, spec);
      if (target) walk(target);
    }
  };
  walk(path.join(SRC, 'main.jsx'));
  return seen;
};

describe('the boot path', () => {
  const graph = bootGraph();
  const rel = (f) => path.relative(SRC, f);

  it('finds the modules it should (the walk still works)', () => {
    const files = [...graph].map(rel);
    expect(files).toContain('App.jsx');
    expect(files).toContain(path.join('components', 'MainMenu.jsx'));
    expect(files).toContain(path.join('components', 'TeddyCard.jsx'));
    expect(files).toContain(path.join('components', 'ui', 'coin.jsx'));
  });

  it('does not reach game-chrome.jsx, which belongs to the lazy dialogs', () => {
    expect([...graph].map(rel)).not.toContain(path.join('components', 'ui', 'game-chrome.jsx'));
  });
});
