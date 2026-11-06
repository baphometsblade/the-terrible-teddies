import { describe, it, expect, vi } from 'vitest';
import { anchorCoachTarget, coachTargetClipped } from './coachAnchor';

const rect = (el, box) => {
  el.getBoundingClientRect = () => box;
  return el;
};

describe('coach ring anchor', () => {
  it('calls a card clipped when it sits outside its scroller', () => {
    const card = rect(document.createElement('div'), { left: 400, right: 480, top: 0, bottom: 40, width: 80, height: 40 });
    const scroller = rect(document.createElement('div'), { left: 0, right: 200, top: 0, bottom: 100, width: 200, height: 100 });
    expect(coachTargetClipped(card, scroller)).toBe(true);
    rect(card, { left: 20, right: 100, top: 10, bottom: 50, width: 80, height: 40 });
    expect(coachTargetClipped(card, scroller)).toBe(false);
  });

  it('scrolls the marked card back only when the resize pushed it out', () => {
    const root = document.createElement('div');
    const scroller = document.createElement('div');
    scroller.setAttribute('data-coach-scroll', '');
    const card = document.createElement('div');
    card.setAttribute('data-coach-target', '');
    card.scrollIntoView = vi.fn();
    scroller.appendChild(card);
    root.appendChild(scroller);
    rect(scroller, { left: 0, right: 200, top: 0, bottom: 100, width: 200, height: 100 });
    rect(card, { left: 20, right: 100, top: 10, bottom: 50, width: 80, height: 40 });
    expect(anchorCoachTarget(root)).toBe(true);
    expect(card.scrollIntoView).not.toHaveBeenCalled();
    rect(card, { left: 400, right: 480, top: 10, bottom: 50, width: 80, height: 40 });
    anchorCoachTarget(root);
    expect(card.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
  });

  it('does nothing when the lesson has no card yet', () => {
    expect(anchorCoachTarget(document.createElement('div'))).toBe(false);
    expect(anchorCoachTarget(null)).toBe(false);
  });
});
