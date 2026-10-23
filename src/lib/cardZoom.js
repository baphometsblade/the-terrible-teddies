// The widths at which .card-zoom (src/index.css) enlarges the Collection and
// Deck Builder card grids. Below this a grid card is hand size (96px) and the
// 192px thumbnail already covers a 2x screen; from here up it is drawn at
// 120-144px, where the thumbnail would be upscaled on a 2x screen, so the card
// asks for its art responsively instead (TeddyCard's artVariant). Asking for
// it responsively at every width would send a 2x phone the 768px original for
// every card in a 64-card grid. cardZoom.test.js keeps this in step with the
// stylesheet.
export const CARD_ZOOM_QUERY = '(min-width: 768px)';

// The art a grid card should ask for, given whether the grid is zoomed.
export const gridArtVariant = (zoomed) => (zoomed ? 'responsive' : 'thumb');
