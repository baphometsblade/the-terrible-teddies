// A neon sign: the .neon material (index.css) on a piece of text, with an
// optional paper note taped under it. The door's amber THE SEAMY SIDE and the
// menu's bar-clock sign are this.
//
// It is decoration, always: aria-hidden, with no tab stop and no pointer, so
// nothing about it is read out or reached. Whatever it says is also said in
// plain words where a screen reader finds them (the door's heading, the
// Battle button's line), and the sign is only ever drawn alongside them.
// Static imports only, because the menu draws it on the boot path.
//
// `className` is the placement (and, through the font size it sets, the
// sign's size: the lettering takes the size of the box it hangs in, the
// note keeps its own).
//
//   text     the lettering; the material sets it in caps
//   tone     'amber' | 'pink' | 'teal' | 'red'
//   lit      'full', or 'half' for a sign only half switched on
//   flicker  the idle flicker (the menu's last call, and nothing else)
//   note     a line on a paper note taped under the sign, or none
//   noteClassName  for a note that only shows at some sizes (max-lg:hidden)
const NeonSign = ({ text, tone = 'amber', lit = 'full', flicker = false, note = null, className = '', noteClassName = '' }) => (
  <div aria-hidden="true" className={`pointer-events-none select-none ${className}`}>
    <div className="flex flex-col items-center gap-3">
      <span
        className="neon"
        data-tone={tone}
        data-lit={lit === 'half' ? 'half' : undefined}
        data-flicker={flicker ? '' : undefined}
      >
        {text}
      </span>
      {note ? (
        <span className={`note-taped ${noteClassName}`}>
          <span data-tape="l" />
          <span data-tape="r" />
          {note}
        </span>
      ) : null}
    </div>
  </div>
);

export default NeonSign;
