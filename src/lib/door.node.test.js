// @vitest-environment node
import { describe, it, expect } from 'vitest';

// door.js is imported by Playwright's Node process (e2e/helpers/session.js
// seeds the pass from it), where there is no window, no document and no
// localStorage. So the proof that it is pure is to import it there, and use
// it.
describe('door.js in an environment with no page', () => {
  it('has no window to find, and imports cleanly', async () => {
    expect(typeof window).toBe('undefined');
    const door = await import('./door');
    expect(door.DOOR_KEY).toBe('terrible-teddies-door');
    expect(door.doorRecord('pass', 0)).toBe('{"v":1,"state":"pass","at":0}');
  });

  it('asks, rather than throwing, with no storage to read', async () => {
    const { createDoor, readDoor } = await import('./door');
    expect(readDoor(undefined)).toBe('ask');
    const door = createDoor(); // the page's localStorage, which is not here
    expect(door.read()).toBe('ask');
    // ...and a pass still lives in memory.
    expect(door.pass(1)).toBe('pass');
    expect(door.read()).toBe('pass');
  });
});
