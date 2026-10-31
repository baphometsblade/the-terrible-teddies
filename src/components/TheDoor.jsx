import { useEffect, useRef, useState } from 'react';
import { useReducedMotionConfig } from 'framer-motion';
import { CircleAlert } from 'lucide-react';
import { CONTENT_NOTICE } from '@/lib/contentNotice';
import { checkAge, DOOR_ART, openingMs } from '@/lib/door';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { ignoreKeyRepeat, useArmedAfterOpen } from '@/lib/keyRepeat';
import { SCREEN_PAD } from '@/lib/safeArea';
import { focusWhenReady } from '@/lib/screenFocus';
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
//   label / placeholder     the year field
//   smallPrint              the plain fact about the year, tied to the field
//   error                   a year that is not four digits in range
//   submit                  the year form's one button
//   birthday*               the follow-up for a player turning 18 this year
//   declined                what a player under 18 is told, and all they are
export const DOOR_COPY = {
  title: 'ID, please · Terrible Teddies',
  declinedTitle: 'Sorry · Terrible Teddies',
  sign: 'ID REQUIRED',
  heading: 'ID.',
  intro: 'Grown-ups only. Show me you are one.',
  notice: `Contains ${CONTENT_NOTICE}.`,
  label: 'Year you were born',
  placeholder: 'YYYY',
  smallPrint: "Only used to check you're 18 or over. It never leaves this device.",
  error: 'Enter the year as four digits.',
  submit: 'Come in',
  birthdayHeading: 'Had your birthday yet this year?',
  birthdayYes: 'Yes',
  birthdayNo: 'Not yet',
  declined: 'Sorry, this room is 18+. Terrible Teddies is for players 18 and over. Thanks for being honest.',
};

// The year field: a well set into the steel, the way the account screens'
// fields are set into their panel (AuthField.jsx), without an icon. Plain
// text with a numeric keypad rather than type=number, which takes an "e" and
// shows spinners; the year is checked on submit, in our own words, not the
// browser's (the form is noValidate).
const FIELD =
  'block w-full h-12 rounded-xl px-4 text-center font-display text-2xl font-extrabold tabular-nums tracking-[0.3em] text-plush-100 ' +
  'placeholder:font-semibold placeholder:text-base placeholder:tracking-normal placeholder:text-plush-300 caret-brass-300 ' +
  'bg-night-950/70 bg-clip-padding border border-white/10 hover:border-white/20 focus-visible:border-brass-300/60 transition-colors ' +
  'aria-[invalid=true]:border-red-400/70 ' +
  'autofill:shadow-[inset_0_0_0_1000px_#1b1328] autofill:[-webkit-text-fill-color:#ece6f2] ' +
  FOCUS_OUTLINE;

// fetchpriority="high" for the art. React 18 passes the attribute through only
// in lowercase (its camelCase form, which React 19 wants, is warned about),
// and the lint rule knows only the camelCase one, so it goes in as a spread,
// before the src that starts the request.
const ASK_FIRST = { fetchpriority: 'high' };

// The full screen the door stands on: the room's backdrop and grain, padded
// clear of an installed phone's status bar and home indicator like the other
// full screens (SCREEN_PAD). dvh where it is supported, because a phone's
// browser toolbars take their share of 100vh.
const ROOM =
  `relative min-h-screen supports-[height:100dvh]:min-h-dvh bar-backdrop flex items-center justify-center overflow-x-clip ${SCREEN_PAD}`;

// The loader painted before the app's JS (index.html) fades out over whatever
// React draws first. BootScreen, which the door's chunk waits behind, matches
// it; the door and the turning away do not, so the loader's medallion and
// wordmark go at once, as App does past BootScreen. A no-op once it is gone.
const useHandedOffLoader = () => {
  useEffect(() => {
    document.getElementById('initial-loader')?.classList.add('to-app');
  }, []);
};

// What a player under 18 is told. Plain: no sign, no bouncer, no joke, no
// retry and no way back. The answer is the device's (src/lib/door.js keeps
// it), so a reload, another tab or a deep link all land here.
const Declined = () => {
  useEffect(() => { document.title = DOOR_COPY.declinedTitle; }, []);
  useHandedOffLoader();
  // The status takes the focus (it is a landing point, not a control): the
  // form the player was in has gone, and a screen reader starts here.
  useEffect(() => focusWhenReady('[data-screen-root="door"] [role="status"]'), []);
  return (
    <div className={ROOM}>
      <div className="fixed inset-0 grain pointer-events-none" aria-hidden="true" />
      <main data-screen-root="door" className="relative z-10 w-full max-w-md">
        <p
          role="status"
          className="panel-glass rounded-2xl px-6 py-8 text-center font-display text-xl font-bold leading-snug text-plush-100 focus:outline-none"
        >
          {DOOR_COPY.declined}
        </p>
      </main>
    </div>
  );
};

// "Had your birthday yet this year?" for the one birth year that cannot be
// told from the year alone. It takes the form's place, so its heading takes
// the focus, and the two answers are the same glass: neither is lit, because
// the door does not nudge. Its own mount is its own opening (a fresh
// useArmedAfterOpen): the second tap of a double-tap on "Come in" lands
// where Yes or Not yet now is, and must not answer it.
const BirthdayQuestion = ({ onAnswer }) => {
  const headingRef = useRef(null);
  const { armed, whenArmed } = useArmedAfterOpen();
  useEffect(() => { headingRef.current?.focus(); }, []);
  const key = `btn-glass ${AUTH_ACTION} ${armed ? '' : 'pointer-events-none'}`;
  return (
    <div data-armed={armed ? 'true' : 'false'}>
      <h2 ref={headingRef} tabIndex={-1} className="text-center font-display text-xl font-bold leading-snug text-balance text-white focus:outline-none">
        {DOOR_COPY.birthdayHeading}
      </h2>
      <div className="mt-5 grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
        <button type="button" className={key} onKeyDown={ignoreKeyRepeat} onClick={whenArmed(() => onAnswer(true))}>
          {DOOR_COPY.birthdayYes}
        </button>
        <button type="button" className={key} onKeyDown={ignoreKeyRepeat} onClick={whenArmed(() => onAnswer(false))}>
          {DOOR_COPY.birthdayNo}
        </button>
      </div>
    </div>
  );
};

// The year form. The year lives in this component's state for as long as it
// takes to decide, and is dropped the moment it is decided: never stored,
// logged, or sent anywhere (the form is never submitted to the page, and the
// field has no name for a browser to remember it under).
const YearForm = ({ onVerdict }) => {
  const inputRef = useRef(null);
  const [year, setYear] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [asking, setAsking] = useState(false);
  const { armed, whenArmed } = useArmedAfterOpen();

  const decide = (verdict) => {
    setYear('');
    onVerdict(verdict);
  };
  const submit = whenArmed(() => {
    const verdict = checkAge(year);
    if (verdict === 'invalid') {
      setInvalid(true);
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (verdict === 'ask') {
      setAsking(true);
    } else {
      decide(verdict);
    }
  });

  // The question takes the form's place, and the form stays under it, hidden
  // (visibility: it cannot be reached or read), so the door does not change
  // height and the whole scene, centred on the screen, does not jump.
  return (
    <div className="mt-4 grid">
      <form
        noValidate
        aria-hidden={asking ? 'true' : undefined}
        className={`[grid-area:1/1] ${asking ? 'invisible' : ''}`}
        data-armed={armed ? 'true' : 'false'}
        onSubmit={(e) => { e.preventDefault(); submit(); }}
      >
        <label htmlFor="door-year" className="block label-caps text-plush-200 mb-2">{DOOR_COPY.label}</label>
        <input
          id="door-year"
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="bday-year"
          maxLength={4}
          placeholder={DOOR_COPY.placeholder}
          value={year}
          onChange={(e) => { setYear(e.target.value); setInvalid(false); }}
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
      </form>
      {asking && (
        <div className="[grid-area:1/1] self-center">
          <BirthdayQuestion onAnswer={(had) => decide(checkAge(year, Date.now(), had))} />
        </div>
      )}
    </div>
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
        <NeonSign text={DOOR_COPY.sign} tone="amber" className="mb-3 text-xl min-[375px]:text-2xl" />
        <div className="relative w-full [perspective:1200px]">
          {/* The light behind the door, which only shows once it swings: a
              doorway-shaped glow, fading up (index.css). */}
          <div
            data-spill
            aria-hidden="true"
            className="absolute inset-0 rounded-t-[2rem] rounded-b-xl opacity-0 bg-[linear-gradient(180deg,rgba(255,178,63,0.5),rgba(255,178,63,0.2))] shadow-[0_0_90px_24px_rgba(255,178,63,0.4)]"
          />
          <div className="steel-door w-full rounded-t-[2rem] rounded-b-xl px-5 pb-5 pt-6">
            {/* Bruno's shades in the slot: his card art at full size (the
                crop wants the pixels, the 192px thumbnail blurs at it), asked
                for first because it is what a new player is waiting to see.
                Empty alt: it is decoration, and the heading is the bouncer's
                word. */}
            {/* A little narrower on a short screen, where the slot's 4:1 is
                the one thing that can give a few pixels back. */}
            <div className="peep-slot mx-auto w-full [@media(max-height:620px)]:w-[86%]">
              <img {...ASK_FIRST} src={DOOR_ART} alt="" width="768" height="1024" decoding="async" draggable="false" />
              <span data-rim aria-hidden="true" />
              <span data-shutter aria-hidden="true" />
            </div>
            <h1 tabIndex={-1} className="mt-4 text-center font-display text-4xl font-extrabold leading-none text-white">
              {DOOR_COPY.heading}
            </h1>
            <p className="mt-2 text-center font-display text-base min-[400px]:text-lg font-semibold leading-snug text-balance text-plush-100">{DOOR_COPY.intro}</p>
            <p className="mt-2 text-center text-xs leading-relaxed text-plush-200">{DOOR_COPY.notice}</p>
            <YearForm onVerdict={onVerdict} />
          </div>
        </div>
      </main>
    </div>
  );
};

/**
 * The door (src/components/DoorGate.jsx mounts it, as a lazy chunk, in front
 * of everything): `state` is the gate's, 'ask' or 'opening' (a pass is in) or
 * 'declined'. A year answers it ('in' passes, 'under' declines) through
 * onPass / onDecline, and onOpened says the door is open and the game may be
 * mounted.
 */
const TheDoor = ({ state, onPass, onDecline, onOpened }) => {
  if (state === 'declined') return <Declined />;
  return (
    <Scene
      phase={state === 'opening' ? 'opening' : 'ask'}
      onVerdict={(verdict) => (verdict === 'in' ? onPass() : onDecline())}
      onOpened={onOpened}
    />
  );
};

export default TheDoor;
