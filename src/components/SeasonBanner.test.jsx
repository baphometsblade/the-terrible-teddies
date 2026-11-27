import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { NAUGHTY_LIST_SEASON } from '@/data/naughtyList';
import {
  applySeasonSnapshot, resetSeasonSnapshot, seasonsForPacks, setSeasonPreview,
} from '@/lib/seasons';
import {
  DOOR_BUTTON, DOOR_DUE, DOOR_KICKER, DOOR_ODDS, DOOR_UNKNOWN, DOOR_WAIT, doorClock, peekLine,
} from '@/lib/seasonDoorCopy';
import SeasonBanner from './SeasonBanner';

let mounted = [];
const render = (props = {}) => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(SeasonBanner, props)));
  mounted.push({ host, root });
  return host;
};

const load = (status, extra = {}) => applySeasonSnapshot({
  serverNow: '2026-11-27T00:00:00.000Z',
  seasons: [{ ...NAUGHTY_LIST_SEASON, status, ...extra }],
  loaded: true,
  previewId: '',
});

beforeEach(() => {
  localStorage.clear();
  resetSeasonSnapshot();
  setSeasonPreview('');
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-12-25T00:00:00.000Z'));
});

afterEach(() => {
  for (const { host, root } of mounted) {
    act(() => root.unmount());
    host.remove();
  }
  mounted = [];
  resetSeasonSnapshot();
  setSeasonPreview('');
  vi.useRealTimers();
});

describe('the season door', () => {
  it('says nothing until the server has a row', () => {
    expect(render().querySelector('section')).toBeNull();
  });

  it('counts a shut door from the server, and the laptop clock cannot open it', () => {
    load('upcoming');
    const host = render({ onOpen() {} });
    const section = host.querySelector('section');
    expect(section.getAttribute('data-season-state')).toBe('upcoming');
    expect(section.textContent).toContain(DOOR_KICKER);
    expect(section.textContent).toContain('The Naughty List');
    expect(section.querySelector('[data-season-clock]').textContent).toBe(doorClock('3d 14h'));
    expect(section.textContent).toContain(DOOR_WAIT);
    expect(section.textContent).toContain(DOOR_ODDS);
    expect(section.textContent).not.toMatch(/On the floor/);
    expect(section.querySelector('button').textContent).toBe(DOOR_BUTTON);
    expect(section.querySelector('button').className).toContain('btn-glass');
    expect(section.querySelector('button').className).not.toContain('btn-brass');
    expect(seasonsForPacks()).toEqual([]);
  });

  it('says the door is due without opening packs when the server clock has caught up', () => {
    load('upcoming', { starts_at: '2026-11-27T00:00:00.000Z' });
    const host = render();
    expect(host.textContent).toContain(DOOR_DUE);
    expect(host.textContent).not.toContain('Opens in');
    expect(seasonsForPacks()).toEqual([]);
  });

  it('does not invent a clock the server did not send', () => {
    applySeasonSnapshot({
      serverNow: null,
      seasons: [{ ...NAUGHTY_LIST_SEASON, status: 'upcoming' }],
      loaded: true,
      previewId: '',
    });
    expect(render().textContent).toContain(DOOR_UNKNOWN);
  });

  it('keeps an open season on the floor', () => {
    load('active');
    const open = render({ onOpen() {} });
    expect(open.querySelector('[data-season-state]').getAttribute('data-season-state')).toBe('active');
    expect(open.textContent).toContain('On the floor for');
    expect(open.querySelector('button').textContent).toBe('The Naughty List');
    expect(open.querySelector('button').className).toContain('btn-brass');
  });

  it('a preview dresses the floor and still says the packs are waiting', () => {
    load('upcoming');
    setSeasonPreview('naughty-list');
    const preview = render();
    expect(preview.querySelector('[data-season-state]').getAttribute('data-season-state')).toBe('preview');
    expect(preview.textContent).toContain('Preview. Packs still wait for the server.');
    expect(preview.textContent).not.toMatch(/On the floor/);
    expect(preview.textContent).not.toContain('Opens in');
    expect(seasonsForPacks()).toEqual([]);
  });

  it('hands the peek to the caller and never writes the save', () => {
    load('upcoming');
    const onOpen = vi.fn();
    const host = render({ onOpen });
    act(() => host.querySelector('button').click());
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('the door copy', () => {
  const lines = [DOOR_KICKER, DOOR_BUTTON, DOOR_WAIT, DOOR_ODDS, DOOR_UNKNOWN, DOOR_DUE, peekLine(10), doorClock('3d 14h')];

  it('stays in the house voice: no shout, no hand-written odds', () => {
    for (const line of lines) {
      expect(line, line).not.toMatch(/!/);
      expect(line, line).not.toMatch(/\d+(\.\d+)?%/);
    }
    expect(peekLine(10)).toContain('These ten stay');
    expect(peekLine(1)).toContain('This one stays');
    expect(peekLine(12)).toContain('These cards stay');
    expect(doorClock('')).toBe('');
  });
});
