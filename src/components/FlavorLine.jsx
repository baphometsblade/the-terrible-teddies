// A card's flavor line, drawn the one way. The Collection's card detail set the
// style, and the pack reveal and the Deck Builder draw it through here too, so
// there is one visual reference: change the look in FLAVOR_LINE and every
// screen that shows a line changes with it.
//
// The line is the card's `description` exactly as the data has it. Nothing is
// wrapped around it (no quotation marks, no "<name> says"), so a rewrite of the
// data reaches every screen as written. A card with no line draws nothing.
// Real content, not decoration: a screen reader reads it where it sits.
export const FLAVOR_LINE = 'text-sm leading-relaxed text-plush-200';

// The slot a line has to fit. The tightest is the pack reveal's caption: at 320
// it is 268px wide, about 36 characters to a line at this size, and it keeps
// room for two lines and grows by a third. A hundred characters is three lines
// with room for wide words; the longest line shipped is 90.
export const FLAVOR_MAX = 100;

export default function FlavorLine({ card, className = '', ...rest }) {
  if (!card?.description) return null;
  return (
    <p {...rest} className={className ? `${FLAVOR_LINE} ${className}` : FLAVOR_LINE}>
      {card.description}
    </p>
  );
}
