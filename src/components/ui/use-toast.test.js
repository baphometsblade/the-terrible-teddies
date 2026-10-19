import { describe, it, expect } from 'vitest';
import { createElement, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { useToast } from './use-toast';

// Effects list `dismiss` (and `toast`) as dependencies — the battle board's
// turn-banner and game-over effects do. If either changed identity on each
// render, those effects would re-run on every render of their component, and
// the board's would dismiss each toast the moment it appeared.
describe('useToast', () => {
  it('returns the same toast and dismiss functions on every render', () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const seen = [];
    let bump;
    const Probe = () => {
      const [, setN] = useState(0);
      bump = () => setN((n) => n + 1);
      const { toast, dismiss } = useToast();
      useEffect(() => { seen.push({ toast, dismiss }); });
      return null;
    };
    const host = document.createElement('div');
    const root = createRoot(host);
    act(() => root.render(createElement(Probe)));
    act(() => bump());
    act(() => bump());
    act(() => root.unmount());
    expect(seen.length).toBe(3);
    expect(new Set(seen.map((s) => s.dismiss)).size).toBe(1);
    expect(new Set(seen.map((s) => s.toast)).size).toBe(1);
  });
});
