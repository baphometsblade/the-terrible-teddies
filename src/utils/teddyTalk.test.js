import { QUIPS, pickQuip, OPPONENT_NAME, startPoolFor, LATE_UNTIL_HOUR } from './teddyTalk';

describe('teddyTalk', () => {
  it('has a named opponent persona', () => {
    expect(OPPONENT_NAME).toBeTruthy();
  });

  it('every pool is a non-empty array of non-empty strings', () => {
    const pools = Object.keys(QUIPS);
    expect(pools.length).toBeGreaterThan(0);
    for (const pool of pools) {
      expect(QUIPS[pool].length).toBeGreaterThan(0);
      for (const line of QUIPS[pool]) {
        expect(typeof line).toBe('string');
        expect(line.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('picks from the requested pool', () => {
    for (let i = 0; i < 20; i++) {
      expect(QUIPS.oppKills).toContain(pickQuip('oppKills'));
    }
  });

  it('never repeats the previous quip back to back', () => {
    let last = pickQuip('oppWins');
    for (let i = 0; i < 50; i++) {
      const next = pickQuip('oppWins', last);
      expect(next).not.toBe(last);
      last = next;
    }
  });

  it('returns null for an unknown pool instead of crashing', () => {
    expect(pickQuip('nonexistent')).toBeNull();
  });
});

// The two pools the after-dark pass adds. Both are card-agnostic (they never
// follow a card's name), so they carry no more restriction than gameStart.
describe('lastCall, lastCallChuckDown and gameStartLate', () => {
  it('have enough lines to rotate without a pattern', () => {
    expect(QUIPS.lastCall.length).toBeGreaterThanOrEqual(8);
    expect(QUIPS.lastCallChuckDown.length).toBeGreaterThanOrEqual(6);
    expect(QUIPS.gameStartLate.length).toBeGreaterThanOrEqual(4);
  });

  it('are picked from their own pool, and never repeat back to back', () => {
    for (const pool of ['lastCall', 'lastCallChuckDown', 'gameStartLate']) {
      let last = pickQuip(pool);
      expect(QUIPS[pool]).toContain(last);
      for (let i = 0; i < 40; i++) {
        const next = pickQuip(pool, last);
        expect(QUIPS[pool]).toContain(next);
        expect(next).not.toBe(last);
        last = next;
      }
    }
  });

  // The centre-line bubble shows two lines at 320px and clips the rest. The
  // longest line that shipped (63 characters) fits there, and a 62-character
  // line of long words did not, so characters are only a coarse guard: no
  // pool's line runs past the longest that fits, and the lines this pass adds
  // stay a few under it, for a phone font wider than the one they were
  // measured in. e2e/board.spec.js measures every line in the real bubble.
  it('keep every line inside the bubble: 64 characters in any pool, 60 in the new ones', () => {
    for (const [pool, lines] of Object.entries(QUIPS)) {
      for (const line of lines) {
        expect(line.length, `${pool}: "${line}"`).toBeLessThanOrEqual(64);
      }
    }
    for (const pool of ['lastCall', 'lastCallChuckDown', 'gameStartLate']) {
      for (const line of QUIPS[pool]) {
        expect(line.length, `${pool}: "${line}"`).toBeLessThanOrEqual(60);
      }
    }
  });

  it('keep every line the game shipped with before them', () => {
    // The pools that existed are not touched by this pass; one line of each is
    // enough to catch a file that was regenerated instead of extended.
    expect(QUIPS.gameStart).toContain("Fresh meat! I LOVE fresh meat.");
    expect(QUIPS.oppKills).toContain("Someone grab a dustpan.");
    expect(QUIPS.oppWins).toContain("Get stuffed, kid. Literally.");
  });
});

// The hour Chuck's opener is chosen by is the player's local hour, read at the
// deal: past midnight and before five he opens late.
describe('startPoolFor', () => {
  const at = (h, m = 0) => new Date(2027, 0, 15, h, m, 0);

  it('opens late from midnight to five in the morning, and normally otherwise', () => {
    expect(LATE_UNTIL_HOUR).toBe(5);
    expect(startPoolFor(at(23, 59))).toBe('gameStart');
    expect(startPoolFor(at(0, 0))).toBe('gameStartLate');
    expect(startPoolFor(at(2, 30))).toBe('gameStartLate');
    expect(startPoolFor(at(4, 59))).toBe('gameStartLate');
    expect(startPoolFor(at(5, 0))).toBe('gameStart');
    expect(startPoolFor(at(12, 0))).toBe('gameStart');
  });

  it('reads the clock when no time is given, and names a pool that exists', () => {
    expect(Object.keys(QUIPS)).toContain(startPoolFor());
    for (let h = 0; h < 24; h++) expect(Object.keys(QUIPS)).toContain(startPoolFor(at(h)));
  });

  it('is the local hour, so a daylight-saving jump cannot skew it', () => {
    // 2027-03-14 02:30 does not exist in New York; whichever instant the
    // runtime picks, the answer follows the hour the date reports.
    const d = new Date(2027, 2, 14, 2, 30);
    expect(startPoolFor(d)).toBe(d.getHours() < LATE_UNTIL_HOUR ? 'gameStartLate' : 'gameStart');
  });
});

// Chuck's card-attached pools are spoken right after "Chuck slammed down
// {card}" (oppPlays), when his creature kills yours (oppKills) and when yours
// kills his (oppLosesCreature). The card in question can be the Custody-Battle
// Cub, a small cub in Chuck's crew, so these three stay profane and savage
// but are never sexual: no line in them may use a word from this list. The
// pools that follow no card (gameStart, lastCall, oppWins and the rest) have
// no such limit, and nothing here scans for any other kind of word.
describe('the card-attached pools are never sexual', () => {
  const CARD_ATTACHED = ['oppPlays', 'oppKills', 'oppLosesCreature'];
  // Stems, not whole words: a plural or an -ing form ("boners", "sexting",
  // "hookups") is the same word, and wave B writes in exactly those forms. The
  // lookaheads keep the false friends (cocktail, sextant, cumin, Dickens) out.
  const SEXUAL = /\b(?:sex(?!tant|tet|ton|ism)|naked|nude|horny|arous|boner|erection|orgasm|cum(?!in|ulus|ber|quat)|dick(?!ens|ering)|cock(?!tail|pit|roach|ney|eyed)|pussy|pussies|tits?\b|titties|boob|nipple|kink|fetish|foreplay|hook ?up|booty|strip(?:pers?|ped|ping)?\b|blowjob|handjob|lap dance|spank|grope|fondl|molest|thrust|moan|bondage|dildo|slut|whore)/i;
  const SEXUAL_WORDS = [
    'sex', 'sexy', 'sexual', 'naked', 'nude', 'horny', 'aroused', 'boner', 'erection', 'orgasm',
    'cum', 'dick', 'cock', 'pussy', 'tits', 'boobs', 'kinky', 'fetish', 'foreplay', 'hookup',
    'booty', 'stripper', 'blowjob', 'handjob', 'lap dance',
  ];
  const sexualWordIn = (line) => line.match(SEXUAL)?.[0] ?? null;

  it('has all three pools, so a rename cannot take them out from under the check', () => {
    for (const pool of CARD_ATTACHED) {
      expect(Array.isArray(QUIPS[pool]), pool).toBe(true);
      expect(QUIPS[pool].length, pool).toBeGreaterThan(0);
    }
  });

  it('holds no sexual word in any of them', () => {
    for (const pool of CARD_ATTACHED) {
      for (const line of QUIPS[pool]) {
        expect(sexualWordIn(line), `${pool}: "${line}"`).toBeNull();
      }
    }
  });

  // The check must be able to fail: without this, a broken pattern would pass
  // every line and the guard above would guard nothing.
  it('catches each word on the list, and its plural, and the -ing forms spelled out', () => {
    for (const word of SEXUAL_WORDS) {
      for (const form of [word, word.endsWith('s') ? word : `${word}s`]) {
        expect(sexualWordIn(`Chuck says ${form.toUpperCase()}, loudly.`), form).not.toBeNull();
      }
    }
    for (const line of [
      'Dicks out for Chuck.', 'Two cocks walk into a bar.', 'The strippers are leaving.',
      'Hookups ruin everything.', 'Sexting is a crime.', 'Nudes at dawn.', 'Cumming soon.',
      'Chuck is spanking this one.', 'Time to grope the competition.', 'Fetishes galore',
    ]) expect(sexualWordIn(line), line).not.toBeNull();
  });

  it('leaves the false friends alone', () => {
    for (const line of [
      'A cocktail of sextants and cumin.', 'Dickens would approve.', 'Brass knuckles and a glass jaw.',
      'Sussex, cockpit, cucumber.',
    ]) expect(sexualWordIn(line), line).toBeNull();
  });
});

// The copy deck's lines are in every pool, next to the ones that shipped.
describe('the after-dark deck', () => {
  it('grew every pool, and kept what shipped', () => {
    for (const pool of ['gameStart', 'oppPlays', 'oppKills', 'oppHitsFace', 'oppLosesCreature', 'oppTakesFaceHit',
      'oppNearDeath', 'playerRally', 'oppWins', 'oppLoses', 'playerEmote']) {
      expect(QUIPS[pool].length, pool).toBeGreaterThanOrEqual(14);
    }
    expect(QUIPS.gameStartLate.length).toBeGreaterThanOrEqual(10);
    expect(QUIPS.lastCall.length).toBeGreaterThanOrEqual(12);
    expect(QUIPS.oppPlays).toContain('Clock in, buddy. Daddy needs a win.');
    expect(QUIPS.oppLoses).toContain('This is rigged. I want a rematch and a juice box.');
  });

  it('has no line twice in a pool', () => {
    for (const [pool, lines] of Object.entries(QUIPS)) {
      expect(new Set(lines).size, pool).toBe(lines.length);
    }
  });

  // The last-call lines read right whichever side is on the ropes, so Chuck's
  // own pool, used when he is the one down, carries them as well.
  it('says the side-agnostic last call lines when Chuck is the one down too', () => {
    // The first 12 are the shipped gloats aimed at the player (they stay, and
    // would not read right from a bear on the ropes); the deck's follow them.
    for (const line of QUIPS.lastCall.slice(12)) expect(QUIPS.lastCallChuckDown).toContain(line);
  });
});
