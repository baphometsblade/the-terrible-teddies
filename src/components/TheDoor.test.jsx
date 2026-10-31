import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import { CONTENT_NOTICE } from '@/lib/contentNotice';
import { DOOR_ART, OPENING_MS } from '@/lib/door';
import TheDoor, { DOOR_COPY } from './TheDoor';

// The door's scene, rendered. The gate that decides who sees it is
// DoorGate.test.jsx, the pure rules are door.test.js, and what a real browser
// makes of the layout is e2e/door.spec.js; this is what each control does.

const YEAR = new Date().getFullYear();

let mounted = [];
const render = (props = {}, { reduced = null } = {}) => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const calls = { pass: vi.fn(), decline: vi.fn(), opened: vi.fn() };
  const door = createElement(TheDoor, {
    state: 'ask', onPass: calls.pass, onDecline: calls.decline, onOpened: calls.opened, ...props,
  });
  act(() => root.render(reduced === null ? door : createElement(MotionConfig, { reducedMotion: reduced }, door)));
  mounted.push({ host, root });
  return { host, calls };
};

const armed = () => act(() => { vi.advanceTimersByTime(450); });
const type = (input, value) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
const submit = (host) => click(host.querySelector('button[type="submit"]'));
const field = (host) => host.querySelector('#door-year');
const alertText = (host) => host.querySelector('#door-error').textContent;
const buttons = (host) => [...host.querySelectorAll('button')].filter((b) => getComputedStyle(b).visibility !== 'hidden' && !b.closest('[aria-hidden="true"]'));
const heldEnter = (el) => {
  const e = new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true });
  act(() => { el.dispatchEvent(e); });
  return e.defaultPrevented;
};

beforeEach(() => {
  vi.useFakeTimers();
  document.title = 'Terrible Teddies - Card Battle Game';
  document.documentElement.removeAttribute('data-motion');
  document.body.insertAdjacentHTML('afterbegin', '<div id="initial-loader"></div>');
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  for (const { host, root } of mounted) {
    act(() => root.unmount());
    host.remove();
  }
  mounted = [];
  document.getElementById('initial-loader')?.remove();
  document.documentElement.removeAttribute('data-motion');
  vi.useRealTimers();
});

// Every line is held to the slot it fills, so the final copy can be dropped
// in without a layout pass. The widths are for a 320px phone at the sizes the
// door sets them in (the door's inner width there is 256px).
describe('DOOR_COPY', () => {
  const BUDGET = {
    title: 40,
    declinedTitle: 40,
    sign: 14, // the neon over the door (SIGN_MAX): one line at 20px
    heading: 8, // the h1, at 36px
    intro: 48, // two lines at 16px
    notice: null, // the shared content line, checked below
    label: 20, // small caps, one line
    placeholder: 6,
    smallPrint: 80, // two lines at 12px
    error: 36, // one line at 14px
    submit: 14,
    birthdayHeading: 44, // two lines at 20px
    birthdayYes: 12,
    birthdayNo: 12,
    declined: 110, // four lines at 20px
  };

  it('has a budget for every line, and no line without one', () => {
    expect(Object.keys(DOOR_COPY).sort()).toEqual(Object.keys(BUDGET).sort());
  });

  it.each(Object.entries(BUDGET).filter(([, max]) => max !== null))('%s fits in %i characters', (key, max) => {
    const line = DOOR_COPY[key];
    expect(line.length, line).toBeGreaterThan(0);
    expect(line.length, line).toBeLessThanOrEqual(max);
    expect(line, 'no stray whitespace').toBe(line.trim());
  });

  // One content line for the whole game (src/lib/contentNotice.js): the door
  // says what the sign-in screen and the tutorial say, from the same string.
  it('says what the game contains in the shared words, and no others', () => {
    expect(DOOR_COPY.notice).toBe(`Contains ${CONTENT_NOTICE}.`);
  });

  // What a player under 18 is told is plain, accurate and the same for
  // everyone (lead-decisions.md section 4): pinned word for word.
  it('tells a player under 18 exactly this, and no joke', () => {
    expect(DOOR_COPY.declined).toBe('Sorry, this room is 18+. Terrible Teddies is for players 18 and over. Thanks for being honest.');
  });

  it('asks for the year in the neutral words, and says what becomes of it', () => {
    expect(DOOR_COPY.label).toBe('Year you were born');
    expect(DOOR_COPY.smallPrint).toBe("Only used to check you're 18 or over. It never leaves this device.");
    expect(DOOR_COPY.birthdayHeading).toBe('Had your birthday yet this year?');
    expect([DOOR_COPY.birthdayYes, DOOR_COPY.birthdayNo]).toEqual(['Yes', 'Not yet']);
  });
});

describe('the door, asking', () => {
  it('draws the scene: an h1, the sign, the shades in the slot, and one labelled field', () => {
    const { host } = render();
    expect(host.querySelector('main[data-screen-root="door"] h1').textContent).toBe('ID.');
    // The h1 is a landing point the focus goes to, never a tab stop.
    expect(host.querySelector('h1').getAttribute('tabindex')).toBe('-1');
    // The sign is decoration; the heading says it in words.
    const sign = host.querySelector('.neon');
    expect(sign.textContent).toBe('ID REQUIRED');
    expect(sign.getAttribute('data-tone')).toBe('amber');
    expect(sign.closest('[aria-hidden="true"]')).not.toBeNull();
    // Bruno's art at full size, asked for first, with no alt (decoration).
    const art = host.querySelector('.peep-slot img');
    expect(art.getAttribute('src')).toBe(DOOR_ART);
    expect(art.getAttribute('alt')).toBe('');
    expect(art.getAttribute('fetchpriority')).toBe('high');
    expect(host.textContent).toContain(DOOR_COPY.notice);
    expect(host.textContent).toContain(DOOR_COPY.intro);
  });

  it('labels the year field, describes it, and asks for a numeric keypad', () => {
    const { host } = render();
    const input = field(host);
    expect(host.querySelector('label[for="door-year"]').textContent).toBe('Year you were born');
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.getAttribute('autocomplete')).toBe('bday-year');
    expect(input.getAttribute('maxlength')).toBe('4');
    // Described by the small print and the error line, both of which exist.
    const ids = input.getAttribute('aria-describedby').split(' ');
    expect(ids).toEqual(['door-print', 'door-error']);
    expect(host.querySelector('#door-print').textContent).toBe(DOOR_COPY.smallPrint);
    expect(host.querySelector('#door-error').getAttribute('role')).toBe('alert');
    // Nothing for a browser to remember the year under.
    expect(input.hasAttribute('name')).toBe(false);
  });

  it('has one button, and it is glass: no brass anywhere on the door', () => {
    const { host } = render();
    expect(buttons(host)).toHaveLength(1);
    expect(buttons(host)[0].textContent).toBe('Come in');
    expect(buttons(host)[0].type).toBe('submit');
    expect(host.querySelector('.btn-glass')).not.toBeNull();
    expect(host.innerHTML).not.toContain('btn-brass');
    expect(host.innerHTML).not.toMatch(/text-brass-gradient|trim-brass/);
  });

  it('takes the focus to its heading, and sets its own title', () => {
    const { host } = render();
    act(() => { vi.advanceTimersByTime(50); });
    expect(document.activeElement).toBe(host.querySelector('h1'));
    expect(document.title).toBe(DOOR_COPY.title);
  });

  // index.html's loader fades out over whatever React draws first; the door
  // is not the loader's layout, so it hands the loader off as App does.
  it('hands the loader off at once', () => {
    render();
    expect(document.getElementById('initial-loader').classList.contains('to-app')).toBe(true);
  });

  describe('a year that is not one', () => {
    it.each(['', '  ', '19', '1990 5', 'abcd', '1899', String(YEAR + 1)])('says so, in place, for "%s"', (text) => {
      const { host, calls } = render();
      armed();
      type(field(host), text);
      submit(host);
      expect(alertText(host)).toBe(DOOR_COPY.error);
      expect(field(host).getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(field(host));
      expect(calls.pass).not.toHaveBeenCalled();
      expect(calls.decline).not.toHaveBeenCalled();
    });

    it('clears the message as soon as the player types again', () => {
      const { host } = render();
      armed();
      submit(host);
      expect(alertText(host)).toBe(DOOR_COPY.error);
      type(field(host), '1');
      expect(alertText(host)).toBe('');
      expect(field(host).hasAttribute('aria-invalid')).toBe(false);
    });

    // The error line is always in the page and always a line tall, so the
    // button never moves under a finger when it appears.
    it('has the line to put it in before it is needed', () => {
      const { host } = render();
      expect(host.querySelector('#door-error')).not.toBeNull();
      expect(host.querySelector('#door-error').className).toContain('min-h-[1.25rem]');
    });
  });

  describe('an adult', () => {
    it('is let in, once', () => {
      const { host, calls } = render();
      armed();
      type(field(host), '1990');
      submit(host);
      expect(calls.pass).toHaveBeenCalledTimes(1);
      expect(calls.decline).not.toHaveBeenCalled();
    });

    it('is let in by the form submitting, whichever way it is submitted', () => {
      const { host, calls } = render();
      armed();
      type(field(host), ' 1985 ');
      act(() => { host.querySelector('form').requestSubmit(); });
      expect(calls.pass).toHaveBeenCalledTimes(1);
    });
  });

  describe('a minor', () => {
    it('is turned away, once, and nothing lets them in', () => {
      const { host, calls } = render();
      armed();
      type(field(host), String(YEAR - 12));
      submit(host);
      expect(calls.decline).toHaveBeenCalledTimes(1);
      expect(calls.pass).not.toHaveBeenCalled();
    });
  });

  describe('the year', () => {
    // Typed, compared, dropped. Nothing is stored, logged or sent.
    it('is not stored, logged or sent, whichever way the answer goes', () => {
      const secret = String(YEAR - 31);
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
      const logged = ['log', 'info', 'warn', 'error', 'debug'].map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
      const beacon = vi.fn();
      Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
      for (const year of [secret, String(YEAR - 10), String(YEAR - 18)]) {
        const { host } = render();
        armed();
        type(field(host), year);
        submit(host);
        if (host.querySelector('h2')) {
          armed();
          click(buttons(host).find((b) => b.textContent === 'Yes'));
        }
        // Dropped from the field the moment it is decided.
        expect(field(host).value).toBe('');
      }
      const everything = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
      for (const year of [secret, String(YEAR - 10), String(YEAR - 18)]) expect(everything).not.toContain(year);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(beacon).not.toHaveBeenCalled();
      for (const spy of logged) {
        for (const args of spy.mock.calls) expect(JSON.stringify(args)).not.toContain(secret);
      }
      vi.unstubAllGlobals();
      delete navigator.sendBeacon;
    });

    it('is never submitted to the page', () => {
      const { host } = render();
      armed();
      type(field(host), '1990');
      const e = new Event('submit', { bubbles: true, cancelable: true });
      act(() => { host.querySelector('form').dispatchEvent(e); });
      expect(e.defaultPrevented).toBe(true);
    });
  });

  describe('a player turning 18 this year', () => {
    const toTheQuestion = () => {
      const result = render();
      armed();
      type(field(result.host), String(YEAR - 18));
      submit(result.host);
      return result;
    };

    it('is asked whether their birthday has been, in the form\'s place, and the heading takes the focus', () => {
      const { host, calls } = toTheQuestion();
      const heading = host.querySelector('h2');
      expect(heading.textContent).toBe('Had your birthday yet this year?');
      act(() => { vi.advanceTimersByTime(50); });
      expect(document.activeElement).toBe(heading);
      // The form is still in the page, to hold the door's height, but hidden
      // from everything: nothing in it can be reached or read.
      expect(host.querySelector('form').getAttribute('aria-hidden')).toBe('true');
      expect(host.querySelector('form').className).toContain('invisible');
      expect(calls.pass).not.toHaveBeenCalled();
      expect(calls.decline).not.toHaveBeenCalled();
    });

    it('has two answers, the same glass, and neither is lit', () => {
      const { host } = toTheQuestion();
      const [yes, notYet] = buttons(host);
      expect([yes.textContent, notYet.textContent]).toEqual(['Yes', 'Not yet']);
      expect(yes.className).toBe(notYet.className);
      expect(yes.className).toContain('btn-glass');
      expect(host.innerHTML).not.toContain('btn-brass');
      expect(buttons(host)).toHaveLength(2);
    });

    it('is let in by Yes and turned away by Not yet', () => {
      let { host, calls } = toTheQuestion();
      armed();
      click(buttons(host).find((b) => b.textContent === 'Yes'));
      expect(calls.pass).toHaveBeenCalledTimes(1);
      expect(calls.decline).not.toHaveBeenCalled();
      ({ host, calls } = toTheQuestion());
      armed();
      click(buttons(host).find((b) => b.textContent === 'Not yet'));
      expect(calls.decline).toHaveBeenCalledTimes(1);
      expect(calls.pass).not.toHaveBeenCalled();
    });

    // The second tap of a double-tap on "Come in" lands where an answer now
    // is: it must not give one.
    it('does not take an answer from the tap that brought it up', () => {
      const { host, calls } = toTheQuestion();
      click(buttons(host).find((b) => b.textContent === 'Yes'));
      click(buttons(host).find((b) => b.textContent === 'Not yet'));
      expect(calls.pass).not.toHaveBeenCalled();
      expect(calls.decline).not.toHaveBeenCalled();
      expect(buttons(host)[0].className).toContain('pointer-events-none');
      armed();
      expect(buttons(host)[0].className).not.toContain('pointer-events-none');
      click(buttons(host).find((b) => b.textContent === 'Yes'));
      expect(calls.pass).toHaveBeenCalledTimes(1);
    });

    it('does not take a held Enter for an answer', () => {
      const { host } = toTheQuestion();
      for (const button of buttons(host)) expect(heldEnter(button), button.textContent).toBe(true);
    });
  });

  // The double-tap that launched the app lands on whatever the door has
  // drawn by then; for the first moments nothing on it answers.
  describe('in its first moments', () => {
    it('does not answer, and does not complain, to a tap that arrives at once', () => {
      const { host, calls } = render();
      type(field(host), '1990');
      submit(host);
      expect(calls.pass).not.toHaveBeenCalled();
      expect(alertText(host)).toBe('');
      expect(host.querySelector('button[type="submit"]').className).toContain('pointer-events-none');
      expect(host.querySelector('form').getAttribute('data-armed')).toBe('false');
      armed();
      expect(host.querySelector('form').getAttribute('data-armed')).toBe('true');
      submit(host);
      expect(calls.pass).toHaveBeenCalledTimes(1);
    });

    it('does not take Enter in the field for an answer either', () => {
      const { host, calls } = render();
      type(field(host), '1990');
      act(() => { host.querySelector('form').requestSubmit(); });
      expect(calls.pass).not.toHaveBeenCalled();
    });
  });

  // Chrome clicks a focused button on every auto-repeat of a held Enter.
  it('does not take a held Enter for an answer, on the button or in the field', () => {
    const { host } = render();
    expect(heldEnter(host.querySelector('button[type="submit"]'))).toBe(true);
    expect(heldEnter(field(host))).toBe(true);
  });
});

describe('the door, turning someone away', () => {
  it('is plain: one status line, the words, and nothing to press', () => {
    const { host } = render({ state: 'declined' });
    const status = host.querySelector('[role="status"]');
    expect(status.textContent).toBe(DOOR_COPY.declined);
    // No retry, no way back, no joke, no scene.
    expect(host.querySelectorAll('button, a, input, form, img, .neon, .steel-door')).toHaveLength(0);
    expect(host.textContent).toBe(DOOR_COPY.declined);
  });

  it('takes the focus and sets its own title', () => {
    const { host } = render({ state: 'declined' });
    act(() => { vi.advanceTimersByTime(50); });
    expect(document.activeElement).toBe(host.querySelector('[role="status"]'));
    expect(document.title).toBe(DOOR_COPY.declinedTitle);
  });

  it('is in the page the way the scene is, for the shell\'s sake', () => {
    const { host } = render({ state: 'declined' });
    expect(host.querySelector('main[data-screen-root="door"]')).not.toBeNull();
    expect(document.getElementById('initial-loader')).not.toBeNull();
  });
});

describe('the door, opening', () => {
  const opening = (config) => render({ state: 'opening' }, config);
  const waitedFor = (ms) => act(() => { vi.advanceTimersByTime(ms); });

  it('hands over to the game when the swing is done', () => {
    const { host, calls } = opening();
    expect(host.querySelector('[data-door-room]').getAttribute('data-phase')).toBe('opening');
    waitedFor(OPENING_MS.full - 1);
    expect(calls.opened).not.toHaveBeenCalled();
    waitedFor(100);
    expect(calls.opened).toHaveBeenCalledTimes(1);
    waitedFor(5000);
    expect(calls.opened).toHaveBeenCalledTimes(1);
  });

  it('crossfades for 200ms under reduced motion', () => {
    const { calls } = opening({ reduced: 'always' });
    waitedFor(OPENING_MS.reduced - 1);
    expect(calls.opened).not.toHaveBeenCalled();
    waitedFor(100);
    expect(calls.opened).toHaveBeenCalledTimes(1);
  });

  // The in-game Animations switch is no ceremony at all.
  it('does not wait at all with the Animations switch off', () => {
    document.documentElement.dataset.motion = 'off';
    const { calls } = opening({ reduced: 'always' });
    waitedFor(1);
    expect(calls.opened).toHaveBeenCalledTimes(1);
  });

  // The door is leaving: nothing on it is read, reached or answered.
  it('is out of reach while it swings', () => {
    const { host } = opening();
    const stage = host.querySelector('[data-door-stage]');
    expect(stage.inert).toBe(true);
    expect(stage.getAttribute('aria-hidden')).toBe('true');
  });

  it('does not hand over if the door goes first', () => {
    const { calls } = opening();
    act(() => { mounted.pop().root.unmount(); });
    waitedFor(5000);
    expect(calls.opened).not.toHaveBeenCalled();
  });
});
