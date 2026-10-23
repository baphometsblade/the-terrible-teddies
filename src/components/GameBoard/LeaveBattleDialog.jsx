import { Flag } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDialog } from '@/hooks/useDialog';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { SCRIM_PAD } from '@/lib/safeArea';
import { Medallion } from '@/components/ui/game-chrome';

const BUTTON = 'h-11 w-full rounded-xl px-4 font-display font-bold';

/**
 * The one question before a live battle is given up. Both ways out of it,
 * "← Menu" and Concede, book a loss and end the win streak, so both ask here
 * first, in the board's own materials. Concede used to ask through
 * window.confirm (an unstyled browser box carrying the page's address, and
 * suppressed outright in some in-app webviews) and "← Menu" did not ask at
 * all, so a tap meant as "back" silently cost a streak.
 *
 * Keep playing is first, so it takes the focus, and Escape means it too: the
 * safe answer is the one a stray key gives.
 *
 * @param {'leave'|'concede'} mode which control asked: the menu, or Concede
 * @param {number} streak the win streak a loss would end (0 for none)
 */
export default function LeaveBattleDialog({ mode, streak, onKeepPlaying, onConcede }) {
  const ref = useDialog(onKeepPlaying);
  const leaving = mode === 'leave';
  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-battle-title"
      aria-describedby="leave-battle-body"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      // Fixed rather than absolute: with a mouse the board can be taller than
      // the window and scroll, and the question must be on screen whatever
      // part of it is. Above the rotate-phone card (z-30), like the menu
      // control that opens it.
      className={`fixed inset-0 z-50 dialog-scrim flex items-start justify-center overflow-y-auto ${SCRIM_PAD}`}
    >
      <div className="relative my-auto w-full max-w-sm rounded-2xl dialog-panel px-6 py-6 text-center">
        <Medallion icon={Flag} size="md" className="mx-auto mb-3 flex" />
        <h2 id="leave-battle-title" className="font-display text-2xl font-extrabold text-white">
          {leaving ? 'Leave this battle?' : 'Concede this battle?'}
        </h2>
        <p id="leave-battle-body" className="mt-2 text-plush-200">
          {streak > 0
            ? <>It counts as a loss, and your <span className="font-bold text-brass-200">{streak}-win streak</span> ends here.</>
            : 'It counts as a loss.'}
          {leaving && ' You’ll go back to the menu.'}
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <button type="button" onClick={onKeepPlaying} className={`btn-brass ${BUTTON} ${FOCUS_OUTLINE}`}>
            Keep playing
          </button>
          <button type="button" onClick={onConcede} className={`btn-glass ${BUTTON} ${FOCUS_OUTLINE}`}>
            Concede — counts as a loss
          </button>
        </div>
      </div>
    </motion.div>
  );
}
