// One door for expansion ids. The ladder stores integers. Each set knows
// its own block. Adding a set is one line here, and the ghost deal reads
// this before the prefix table.

import { toLadderId as chuckTo, fromLadderId as chuckFrom } from '@/data/chuckCrew';
import { toLadderId as ordersTo, fromLadderId as ordersFrom } from '@/data/expansion-last-orders';
import { toLadderId as henTo, fromLadderId as henFrom } from '@/data/henDoHavoc';

const SETS = Object.freeze([
  Object.freeze({ toLadderId: chuckTo, fromLadderId: chuckFrom }),
  Object.freeze({ toLadderId: ordersTo, fromLadderId: ordersFrom }),
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
