import { describe, it, expect, vi, afterEach } from 'vitest';
import { DOOR_KEY, doorRecord } from '@/lib/door';
import ErrorBoundary from './ErrorBoundary';

// "Clear Data & Restart" wipes the game's data. The door's answer is the
// device's, not the game's: a decline is for good, and a button on a crash
// screen must not be a way back in.
describe('the crash screen\'s Clear Data & Restart', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });
  const press = () => {
    vi.stubGlobal('confirm', () => true);
    // jsdom cannot reload and says so on the console; that is not under test.
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    try { new ErrorBoundary({}).handleClearData(); } finally { quiet.mockRestore(); }
  };

  it('clears the game and keeps a decline', () => {
    const declined = doorRecord('declined', 5);
    localStorage.setItem(DOOR_KEY, declined);
    localStorage.setItem('terrible-teddies-save', '{"coins":9}');
    press();
    expect(localStorage.getItem(DOOR_KEY)).toBe(declined);
    expect(localStorage.getItem('terrible-teddies-save')).toBeNull();
  });

  it('keeps a pass too, and invents no record where there was none', () => {
    const pass = doorRecord('pass', 5);
    localStorage.setItem(DOOR_KEY, pass);
    press();
    expect(localStorage.getItem(DOOR_KEY)).toBe(pass);
    localStorage.clear();
    press();
    expect(localStorage.getItem(DOOR_KEY)).toBeNull();
  });
});
