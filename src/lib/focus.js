// The two focus indicators every screen uses. One place, because the screens
// drifted: half drew a ring on the brass and glass controls, half an outline.
//
// FOCUS_OUTLINE is for anything carrying a material (.btn-brass, .btn-glass,
// .panel-glass, .seg-on): a Tailwind ring is a box-shadow, and it replaces the
// material's own — the rim light, the brass lip, the depth — for as long as
// the control has focus. An outline is drawn outside the box and leaves the
// shadow alone.
export const FOCUS_OUTLINE =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-300';

// FOCUS_RING is for plain elements with no material shadow to lose (inputs,
// links, list rows, unselected segments).
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-300 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-night-900';
