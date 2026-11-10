// One door for expansion ids. The ladder stores integers. Each set knows
// its own block. Adding a set is one line here, and the publish and the
// ghost deal both read this instead of a single set.

import { toLadderId as henTo, fromLadderId as henFrom } from '@/data/henDoHavoc';
import { toLadderId as chuckTo, fromLadderId as chuckFrom } from '@/data/chuckCrew';

const SETS = Object.freeze([
  Object.freeze({ toLadderId: chuckTo, fromLadderId: chuckFrom }),
  Object.freeze({ toLadderId: henTo, fromLadderId: henFrom }),
]);

/** Catalog id to the integer a published deck can carry. */
export const toLadderId = (id) => {
  for (const set of SETS) {
    const next = set.toLadderId(id);
    if (next !== id) return next;
  }
  return id;
};

/** Published integer back to the catalog id, when a set owns it. */
export const fromLadderId = (id) => {
  for (const set of SETS) {
    const next = set.fromLadderId(id);
    if (next !== id) return next;
  }
  return id;
};
