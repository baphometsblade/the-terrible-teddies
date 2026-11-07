import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Tutorial from './Tutorial';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

describe('How to play', () => {
  it('offers Replay the lesson, and that is the button that starts the coached fight', async () => {
    const onReplayLesson = vi.fn();
    await act(async () => {
      root.render(<Tutorial onClose={() => {}} onStartGame={() => {}} onReplayLesson={onReplayLesson} />);
    });
    const replay = [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Replay the lesson');
    expect(replay).toBeTruthy();
    expect(replay.className).toMatch(/h-11/);
    await act(async () => { replay.click(); });
    expect(onReplayLesson).toHaveBeenCalledTimes(1);
  });

  it('lets a new player sit down and fight without paging the speech', async () => {
    const onStartGame = vi.fn();
    await act(async () => {
      root.render(<Tutorial onClose={() => {}} onStartGame={onStartGame} onReplayLesson={() => {}} />);
    });
    const sit = [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Sit down and fight');
    expect(sit).toBeTruthy();
    expect(sit.className).toMatch(/h-11/);
    await act(async () => { sit.click(); });
    expect(onStartGame).toHaveBeenCalledTimes(1);
  });
});
