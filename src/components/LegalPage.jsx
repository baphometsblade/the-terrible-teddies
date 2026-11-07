import { useEffect } from 'react';
import { SCREEN_PAD } from '@/lib/safeArea';
import { FOCUS_OUTLINE } from '@/lib/focus';

// Plain pages. The funny lives in the bar, never in the rules a player is
// asked to read before they are let in. Adults only, said as a fact.
const LINK = `underline underline-offset-4 decoration-brass-300/70 hover:decoration-brass-300 ${FOCUS_OUTLINE}`;

const COPY = {
  terms: {
    title: 'Terms of use · Terrible Teddies',
    heading: 'Terms of use',
    lede: 'Terrible Teddies is an adults-only game. You must be 18 or older to play.',
  },
  privacy: {
    title: 'Privacy · Terrible Teddies',
    heading: 'Privacy',
    lede: 'Terrible Teddies is for adults 18 and over. The date you type at the door is not kept.',
  },
};

const Terms = () => (
  <>
    <p>
      Terrible Teddies is a card battler for adults. It contains profanity, crude sexual
      humor, cartoon violence and jokes about drinking. Every character is a grown-up.
      If you are under 18, do not play.
    </p>
    <p>
      The door asks for your date of birth and lets you in only if that date makes you
      18 or older today. You are telling us yourself. We do not check an identity
      document. The date is compared on this device and then thrown away. What this
      device remembers is only that you were let in, or that you were not.
    </p>
    <p>
      Cards, coins and gems are part of the game. Gems are bought with real money
      through Stripe. If a payment is refunded or charged back, the gems from that
      payment are taken back, including from gems you receive later if you already
      spent them. The shop on the Buy Gems tab says the same thing.
    </p>
    <p>
      Play fair with the other people in the bar. Do not abuse the service, and do not
      try to take payments or accounts that are not yours. We can refuse a session
      that breaks these terms.
    </p>
  </>
);

const Privacy = () => (
  <>
    <p>
      Terrible Teddies is adults-only. The age gate asks for a date of birth so it can
      refuse anyone under 18. That date is used for the check and is not saved, not
      logged and not sent to us. This device stores only the answer: let in, or turned
      away, plus the time the answer was given.
    </p>
    <p>
      The game itself is saved on this device. If you create an account, your email
      and a copy of that save are stored with the account so you can pick the game up
      on another device. You do not have to create an account to play.
    </p>
    <p>
      If you buy gems, the payment is handled by Stripe. We learn that the payment
      succeeded and which bundle it was. We do not see your full card number.
    </p>
    <p>
      Product analytics start only after the age gate has let you in and you have
      allowed them. A device that was turned away does not load them. Refusing the
      notice means they never start. They count how the game is played and do not
      include your name or email. You can change the choice later in Settings.
    </p>
    <p>
      From Settings you can download a copy of the data on your account, or delete
      the account. Deleting removes the profile, the cloud save and the activity
      counted for the staff desk. Payment records stay, with the account taken off
      them, because the payment itself is still a record.
    </p>
  </>
);

const LegalPage = ({ kind }) => {
  const page = COPY[kind] ?? COPY.terms;
  useEffect(() => {
    document.title = page.title;
    document.documentElement.dataset.content = 'sfw';
    document.getElementById('initial-loader')?.classList.add('to-app');
  }, [page.title]);

  return (
    <div className={`relative min-h-screen supports-[height:100dvh]:min-h-dvh bar-backdrop text-plush-100 ${SCREEN_PAD}`}>
      <div className="fixed inset-0 grain pointer-events-none" aria-hidden="true" />
      <main data-screen-root="legal" className="relative z-10 mx-auto w-full max-w-xl py-10">
        <p className="label-caps text-brass-300">Adults only · 18+</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold text-white">{page.heading}</h1>
        <p className="mt-4 text-base font-semibold leading-snug text-plush-100">{page.lede}</p>
        <div className="panel-glass mt-6 space-y-4 p-5 text-sm leading-relaxed text-plush-100">
          {kind === 'privacy' ? <Privacy /> : <Terms />}
        </div>
        <nav className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm" aria-label="Policies">
          <a className={LINK} href="/terms">Terms of use</a>
          <a className={LINK} href="/privacy">Privacy</a>
          <a className={LINK} href="/">Back to the door</a>
        </nav>
      </main>
    </div>
  );
};

export default LegalPage;
