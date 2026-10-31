// Notes from management: the passive-aggressive paper the bar tapes up
// wherever it has something to say. Pure data and a picker, no imports, so the
// menu (on the boot path) can read it. The sign-off is one constant, so it can
// be changed in one place.
//
// Rules the tests hold (mgmtNotes.test.js): every note is signed, 44
// characters at most including the sign-off, none is about paying, and none
// repeats within the pool.
//
//   footer   the menu's quiet line at the foot (Chuck-free: the Battle button's
//            line already has him)
//   empty    an empty state that wants a note
//   chuck    names Chuck: for the Battle side and empty states, never the menu
export const MGMT_SIGNOFF = ' — Mgmt.';
export const MGMT_NOTE_MAX = 44;

const note = (body, use) => Object.freeze({ text: `${body}${MGMT_SIGNOFF}`, use });

export const MGMT_NOTES = Object.freeze([
  note('Booth four is not a bedroom.', 'footer'),
  note('The stalls are rated for one.', 'footer'),
  note('Lost and found has your underwear.', 'footer'),
  note('Kindly collect your ex from table 4.', 'footer'),
  note('The back room is not for that.', 'footer'),
  note('The ice machine is not a toilet.', 'footer'),
  note('That thong is part of the decor now.', 'footer'),
  note('Cards on the table. Pants on.', 'footer'),
  note('Please keep your stuffing in.', 'footer'),
  note('Do not pet the staff.', 'footer'),
  note('We validate parking. Not feelings.', 'footer'),
  note('Walk-of-shame exit is out back.', 'footer'),
  note('Lost and found is full of teeth.', 'footer'),
  note("The brownies are not ours. Don't.", 'footer'),
  note('Whoever keeps doing that: stop.', 'footer'),
  note('Yes, we saw that.', 'footer'),
  note('Please stop feeding the regulars.', 'empty'),
  note('No fucking in the walk-in. Again.', 'footer'),
  note("Chuck's tab has its own tab.", 'chuck'),
  note('Do not hand Chuck the keys. Again.', 'chuck'),
  note('Not to name names, but Chuck.', 'chuck'),
  note('Do not make eye contact with Chuck.', 'chuck'),
  note('Put it away, Chuck. We have seen it.', 'chuck'),
]);

const ofUse = (use) => Object.freeze(MGMT_NOTES.filter((n) => n.use === use).map((n) => n.text));
export const FOOTER_NOTES = ofUse('footer');
export const EMPTY_STATE_NOTES = ofUse('empty');
export const CHUCK_NOTES = ofUse('chuck');

/**
 * One line out of a pool, never `avoid` (the line shown last time) unless the
 * pool has no other. `random` is injectable for tests.
 */
export function pickLine(pool, avoid = null, random = Math.random) {
  const options = pool.length > 1 ? pool.filter((line) => line !== avoid) : pool;
  return options[Math.min(options.length - 1, Math.floor(random() * options.length))];
}
