import { useDialog } from '@/hooks/useDialog';
import { SCRIM_PAD } from '@/lib/safeArea';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { DialogClose } from '@/components/ui/game-chrome';

const ACTION = `inline-flex h-11 items-center justify-center rounded-xl px-4 font-display font-bold ${FOCUS_OUTLINE}`;

/**
 * The briefing for tonight's fight. `fight` is dailyFightFor(). `record` is
 * what the save already has for this device. One sitting: once a result is
 * stored for this key, the button does not start another.
 */
const DailyFight = ({ fight, record, onClose, onStart }) => {
  const ref = useDialog(onClose);
  const sat = record?.dailyKey === fight.key && record?.dailyResult;
  const streak = record?.dailyStreak || 0;
  const best = record?.dailyBest || 0;
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Nightly"
      className={`fixed inset-0 z-50 dialog-scrim flex items-start justify-center overflow-y-auto ${SCRIM_PAD}`}
    >
      <div className="relative my-auto w-full max-w-md rounded-2xl dialog-panel p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <h2 className="min-w-0 flex-1 font-display text-2xl font-extrabold leading-tight text-white">
            {fight.modifier.name}
          </h2>
          <DialogClose label="Close nightly" onClick={onClose} />
        </div>
        <p className="mt-3 text-sm leading-snug text-plush-200">{fight.modifier.flavour}</p>
        <p data-daily-rules="" className="mt-3 text-sm font-semibold leading-snug text-brass-200">
          {fight.modifier.rules}
        </p>
        <p className="mt-3 text-sm text-plush-300">
          Across the felt: {fight.crew.name}.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="panel-glass rounded-xl px-3 py-2">
            <dt className="label-caps text-plush-400">Streak</dt>
            <dd className="font-display text-xl font-extrabold text-white">{streak}</dd>
          </div>
          <div className="panel-glass rounded-xl px-3 py-2">
            <dt className="label-caps text-plush-400">Best</dt>
            <dd className="font-display text-xl font-extrabold text-white">{best}</dd>
          </div>
        </dl>
        {sat ? (
          <p className="mt-4 text-sm text-plush-100" role="status">
            {record.dailyResult === 'win'
              ? 'You already won tonight. The seat is cold until tomorrow.'
              : 'You already sat tonight. Come back tomorrow.'}
          </p>
        ) : (
          <button type="button" className={`${ACTION} btn-brass mt-4 w-full`} onClick={onStart}>
            Take the seat
          </button>
        )}
      </div>
    </div>
  );
};

export default DailyFight;
