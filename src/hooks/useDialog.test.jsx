import { describe, it, expect, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useDialog } from './useDialog';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const Dialog = ({ name }) => {
  const ref = useDialog(() => {});
  return <div ref={ref} role="dialog" aria-label={name}><button type="button">{name}</button></div>;
};

let root;
let host;
const render = (ui) => act(() => root.render(ui));

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

// index.css moves toasts off a dialog's controls while <html data-dialog> is
// set, so the attribute has to mean exactly "some dialog is open".
describe('useDialog marks the page while a dialog is open', () => {
  it('sets html[data-dialog] on open and clears it on close', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    expect(document.documentElement.hasAttribute('data-dialog')).toBe(false);
    render(<Dialog name="Shop" />);
    expect(document.documentElement.hasAttribute('data-dialog')).toBe(true);
    render(null);
    expect(document.documentElement.hasAttribute('data-dialog')).toBe(false);
  });

  it('keeps it while one of two stacked dialogs is still open', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    render(<><Dialog name="Shop" /><Dialog name="Daily" /></>);
    expect(document.documentElement.hasAttribute('data-dialog')).toBe(true);
    // The first-opened closes first: dialogs do not always close LIFO.
    render(<Dialog name="Daily" />);
    expect(document.documentElement.hasAttribute('data-dialog')).toBe(true);
    render(null);
    expect(document.documentElement.hasAttribute('data-dialog')).toBe(false);
  });
});
