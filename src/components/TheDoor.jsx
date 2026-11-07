import { useEffect, useRef, useState } from 'react';
import { useReducedMotionConfig } from 'framer-motion';
import { CircleAlert } from 'lucide-react';
import { CONTENT_NOTICE } from '@/lib/contentNotice';
import { checkDateOfBirth, openingMs } from '@/lib/door';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { ignoreKeyRepeat, useArmedAfterOpen } from '@/lib/keyRepeat';
import { focusWhenReady } from '@/lib/screenFocus';
import { DECLINED_COPY, DOOR_ROOM as ROOM, useHandedOffLoader } from './DoorDeclined';
import NeonSign from './NeonSign';
import { AUTH_ACTION } from './AuthField';

// Every word the door says, in one place, so the lines can be rewritten
// without touching the layout or the logic. TheDoor.test.jsx holds each one
// to the slot it fills (a 320px phone is the narrowest), and pins the
// declined line, which is the answer a minor gets and stays plain.
//
//   title / declinedTitle   the tab's title while the door is up
//   sign                    the amber neon over the door (a decoration: the
//                           heading says the same in words)
//   heading                 the h1, the one word the bouncer says
//   intro / notice          under it; the notice is the shared content line
//   label / placeholder     the date-of-birth field
//   smallPrint              the plain fact about the date, tied to the field
//   error                   a date the check refuses (true of each refusal)
//   submit                  the form's one button
//   terms / privacy         the plain pages, linked under the form
//   declined                what a player under 18 is told, and all they are
export const DOOR_COPY = {
  title: 'ID, please · Terrible Teddies',
  declinedTitle: DECLINED_COPY.title,
  sign: 'THE SEAMY SIDE',
  heading: 'ID.',
  intro: 'Grown-ups only. Chuck is already inside.',
  notice: `Contains ${CONTENT_NOTICE}.`,
  label: 'Date of birth',
  placeholder: 'YYYY-MM-DD',
  smallPrint: "Only used to check you're 18 or over. The date is never saved or sent.",
  error: 'Enter a real date, 1900 on.',
  submit: 'Check my age',
  terms: 'Terms',
  privacy: 'Privacy',
  declined: DECLINED_COPY.text,
};

// The year field: a well set into the steel, the way the account screens'
// fields are set into their panel (AuthField.jsx), without an icon. Plain
// text with a numeric keypad rather than type=number, which takes an "e" and
// shows spinners; the year is checked on submit, in our own words, not the
// browser's (the form is noValidate).
const FIELD =
  'block w-full h-12 rounded-xl px-4 text-center font-display text-xl font-extrabold tabular-nums tracking-normal text-plush-100 ' +
  'placeholder:font-semibold placeholder:text-base placeholder:tracking-normal placeholder:text-plush-300 caret-brass-300 ' +
  'bg-night-950/70 bg-clip-padding border border-white/10 hover:border-white/20 focus-visible:border-brass-300/60 transition-colors ' +
  'aria-[invalid=true]:border-red-400/70 ' +
  'autofill:shadow-[inset_0_0_0_1000px_#1b1328] autofill:[-webkit-text-fill-color:#ece6f2] ' +
  FOCUS_OUTLINE;

// The date form. The date lives in this component's state for as long as it
// takes to decide, and is dropped the moment it is decided: never stored,
// logged, or sent anywhere (the form is never submitted to the page, and the
// field has no name for a browser to remember it under).
const DobForm = ({ onVerdict }) => {
  const inputRef = useRef(null);
  const [dob, setDob] = useState('');
  const [invalid, setInvalid] = useState(false);
  const { armed, whenArmed } = useArmedAfterOpen();

  const answered = useRef(false);
  const submit = whenArmed(() => {
    if (answered.current) return;
    const verdict = checkDateOfBirth(dob);
    if (verdict === 'invalid') {
      setInvalid(true);
      inputRef.current?.focus();
      inputRef.current?.select();
      return;
    }
    answered.current = true;
    setDob('');
    onVerdict(verdict);
  });

  return (
    <form
      noValidate
      className="mt-3 [@media(max-height:620px)]:mt-2"
      data-armed={armed ? 'true' : 'false'}
      onSubmit={(e) => { e.preventDefault(); submit(); }}
    >
      <label htmlFor="door-dob" className="block label-caps text-plush-200 mb-2">{DOOR_COPY.label}</label>
      <input
        id="door-dob"
        ref={inputRef}
        type="text"
        inputMode="text"
        autoComplete="bday"
        maxLength={10}
        spellCheck={false}
        placeholder={DOOR_COPY.placeholder}
        value={dob}
        onChange={(e) => { setDob(e.target.value); setInvalid(false); }}
        onKeyDown={ignoreKeyRepeat}
        aria-invalid={invalid || undefined}
        aria-describedby="door-print door-error"
        className={FIELD}
      />
      <p id="door-print" className="mt-2 text-xs leading-snug text-plush-200">{DOOR_COPY.smallPrint}</p>
      {/* Always in the page, so the line is there to be filled and a screen
          reader announces it as it is, and always as tall as one line, so
          the button never moves under a finger when it appears. */}
      <p id="door-error" role="alert" className="mt-2 mb-1 flex min-h-[1.25rem] items-start gap-1.5 text-[13px] font-medium leading-5 text-red-200">
        {invalid && <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-red-300" strokeWidth={2.4} />}
        {invalid ? <span>{DOOR_COPY.error}</span> : null}
      </p>
      <button
        type="submit"
        onKeyDown={ignoreKeyRepeat}
        className={`btn-glass ${AUTH_ACTION} ${armed ? '' : 'pointer-events-none'}`}
      >
        {DOOR_COPY.submit}
      </button>
      <nav className="mt-2 grid grid-cols-2 gap-2" aria-label="Policies">
        <a href="/terms" className={`btn-glass ${AUTH_ACTION}`}>{DOOR_COPY.terms}</a>
        <a href="/privacy" className={`btn-glass ${AUTH_ACTION}`}>{DOOR_COPY.privacy}</a>
      </nav>
    </form>
  );
};

// The door itself, and the room it stands in: the amber sign, the steel
// door, Bruno's shades in the slot and one question. `phase` is 'ask' or
// 'opening' (a pass is in: the slot slides shut, the door swings in on
// amber light, and the game is handed over when it has, see src/lib/door.js's
// openingMs and the rules after the layer in index.css).
const Scene = ({ phase, onVerdict, onOpened }) => {
  const stageRef = useRef(null);
  const reduced = useReducedMotionConfig();
  const onOpenedRef = useRef(onOpened);
  onOpenedRef.current = onOpened;

  useEffect(() => { document.title = DOOR_COPY.title; }, []);
  // The h1 takes the focus, as a screen's heading does (screenFocus.js), so
  // a screen reader starts at "ID." and the keyboard at the form below it.
  useEffect(() => focusWhenReady('[data-screen-root="door"] h1'), []);
  useHandedOffLoader();

  // Once a pass is in, wait out the opening (as long as the player's motion
  // settings leave it) and hand over to the game. Nothing in the room is
  // answerable meanwhile.
  useEffect(() => {
    if (phase !== 'opening') return undefined;
    if (stageRef.current) stageRef.current.inert = true;
    const ms = openingMs({ motionOff: document.documentElement.dataset.motion === 'off', reduced: !!reduced });
    const timer = setTimeout(() => onOpenedRef.current?.(), ms === 0 ? 0 : ms + 40);
    return () => clearTimeout(timer);
  }, [phase, reduced]);

  return (
    <div data-door-room data-phase={phase} className={ROOM}>
      <div className="fixed inset-0 grain pointer-events-none" aria-hidden="true" />
      <main
        ref={stageRef}
        data-screen-root="door"
        data-door-stage
        aria-hidden={phase === 'opening' ? 'true' : undefined}
        className="relative z-10 w-full max-w-sm flex flex-col items-center"
      >
        <NeonSign text={DOOR_COPY.sign} tone="amber" className="mb-2 text-xl min-[375px]:text-2xl [@media(max-height:620px)]:mb-1" />
        <div className="relative w-full [perspective:1200px]">
          {/* The light behind the door, which only shows once it swings: a
              doorway-shaped glow, fading up (index.css). */}
          <div
            data-spill
            aria-hidden="true"
            className="absolute inset-0 rounded-t-[2rem] rounded-b-xl opacity-0 bg-[linear-gradient(180deg,rgba(255,178,63,0.5),rgba(255,178,63,0.2))] shadow-[0_0_90px_24px_rgba(255,178,63,0.4)]"
          />
          <div className="steel-door w-full rounded-t-[2rem] rounded-b-xl px-5 pb-4 pt-5 [@media(max-height:620px)]:pb-3 [@media(max-height:620px)]:pt-3">
            {/* Shades in the slot, drawn, not a card. The adult catalog's
                pictures stay unloaded until the gate has let someone in. */}
            <div className="peep-slot mx-auto w-full [@media(max-height:620px)]:w-[70%]">
              <span data-lenses aria-hidden="true" className="absolute inset-0 flex items-center justify-center gap-5">
                <span className="h-7 w-12 rounded-full bg-night-950 border border-brass-300/50 shadow-[inset_0_0_0_3px_rgba(0,0,0,0.65)]" />
                <span className="h-7 w-12 rounded-full bg-night-950 border border-brass-300/50 shadow-[inset_0_0_0_3px_rgba(0,0,0,0.65)]" />
              </span>
              <span data-rim aria-hidden="true" />
              <span data-shutter aria-hidden="true" />
            </div>
            <h1 tabIndex={-1} className="mt-4 text-center font-display text-4xl font-extrabold leading-none text-white">
              {DOOR_COPY.heading}
            </h1>
            <p className="mt-2 text-center font-display text-base min-[400px]:text-lg font-semibold leading-snug text-balance text-plush-100">{DOOR_COPY.intro}</p>
            <p className="mt-2 text-center text-xs leading-relaxed text-balance text-plush-200">{DOOR_COPY.notice}</p>
            <DobForm onVerdict={onVerdict} />
          </div>
        </div>
      </main>
    </div>
  );
};

/**
 * The door (src/components/DoorGate.jsx mounts it, as a lazy chunk, in front
 * of everything): `state` is the gate's, 'ask' or 'opening' (a pass is in).
 * A date of birth answers it ('in' passes, 'under' declines) through onPass /
 * onDecline, and onOpened says the door is open and the game may be mounted.
 * The turning away is not here: the gate draws it itself (DoorDeclined.jsx).
 */
const TheDoor = ({ state, onPass, onDecline, onOpened }) => (
  <Scene
    phase={state === 'opening' ? 'opening' : 'ask'}
    onVerdict={(verdict) => {
      // Only an explicit answer moves the door. Anything else (a stale
      // 'invalid' reaching here) is nothing, never a decline: a decline is
      // for good on this device.
      if (verdict === 'in') onPass();
      else if (verdict === 'under') onDecline();
    }}
    onOpened={onOpened}
  />
);

export default TheDoor;
