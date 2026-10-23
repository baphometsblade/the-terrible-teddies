// Room for the phone's own furniture. index.html opts the game into drawing
// under it when it is installed to the home screen (viewport-fit=cover and a
// black-translucent status bar), so there the clock and battery sit over the
// top of the page and the home indicator over its foot, and on a sideways
// iPhone the notch over one side. env(safe-area-inset-*) is how far each one
// reaches in. It is 0 in a browser tab and on a desktop, where each of these
// is exactly the plain padding it replaced.
//
// Utilities, not a rule in the .dialog-scrim material: a padding there would
// lose to the p-* utility every scrim carried. Written out in full because
// Tailwind only generates classes it can read whole in the source.

// Every dialog's scrim: 12px round the panel on a phone, 24px from sm (the
// p-3 sm:p-6 most of them had), plus the insets.
export const SCRIM_PAD =
  'pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] ' +
  'pl-[calc(0.75rem+env(safe-area-inset-left))] pr-[calc(0.75rem+env(safe-area-inset-right))] ' +
  'sm:pt-[calc(1.5rem+env(safe-area-inset-top))] sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] ' +
  'sm:pl-[calc(1.5rem+env(safe-area-inset-left))] sm:pr-[calc(1.5rem+env(safe-area-inset-right))]';

// The pack reveal's scrim goes down to 8px below 360px, where its card fan
// needs every pixel. Added after SCRIM_PAD.
export const SCRIM_PAD_NARROW =
  'max-[359px]:pt-[calc(0.5rem+env(safe-area-inset-top))] max-[359px]:pb-[calc(0.5rem+env(safe-area-inset-bottom))] ' +
  'max-[359px]:pl-[calc(0.5rem+env(safe-area-inset-left))] max-[359px]:pr-[calc(0.5rem+env(safe-area-inset-right))]';

// The Collection and Deck Builder screens (16px, 32px from md). Their
// "← Menu" sits in the top-left corner of this box, so it moves down with
// the content rather than onto it.
export const SCREEN_PAD =
  'pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] ' +
  'pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] ' +
  'md:pt-[calc(2rem+env(safe-area-inset-top))] md:pb-[calc(2rem+env(safe-area-inset-bottom))] ' +
  'md:pl-[calc(2rem+env(safe-area-inset-left))] md:pr-[calc(2rem+env(safe-area-inset-right))]';

// The main menu: 16px at the top on a phone (24px from md), 20px at the foot,
// 16px at the sides (32px from md).
export const MENU_PAD =
  'pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1.25rem+env(safe-area-inset-bottom))] ' +
  'pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] ' +
  'md:pt-[calc(1.5rem+env(safe-area-inset-top))] ' +
  'md:pl-[calc(2rem+env(safe-area-inset-left))] md:pr-[calc(2rem+env(safe-area-inset-right))]';
