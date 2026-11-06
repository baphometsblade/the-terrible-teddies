import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import DailyFight from './DailyFight';
import { dailyFightFor } from '@/lib/dailyFight';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
const fight = dailyFightFor(new Date(2026, 10, 6, 21));

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

const button = (name) => [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === name);

describe('Nightly', () => {
  it('states the rules in plain words and starts the fight', async () => {
    const onStart = vi.fn();
    await act(async () => {
      root.render(<DailyFight fight={fight} record={{}} onClose={() => {}} onStart={onStart} />);
    });
    expect(container.querySelector('[data-daily-rules]').textContent).toBe(fight.modifier.rules);
    expect(container.textContent).toContain(fight.crew.name);
    await act(async () => { button('Take the seat').click(); });
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('will not offer a second sitting once tonight is booked', async () => {
    const onStart = vi.fn();
    await act(async () => {
      root.render(
        <DailyFight
          fight={fight}
          record={{ dailyKey: fight.key, dailyResult: 'win', dailyStreak: 2, dailyBest: 4 }}
          onClose={() => {}}
          onStart={onStart}
        />,
      );
    });
    expect(button('Take the seat')).toBeFalsy();
    expect(container.textContent).toContain('You already won tonight');
    expect(container.textContent).toContain('2');
  });
});
