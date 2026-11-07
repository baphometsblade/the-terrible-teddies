import { mvpLine } from '@/lib/matchNight';
import { FOCUS_OUTLINE } from '@/lib/focus';

// The end of the night: who did the work, and a recap you open if you want
// the gossip. Closed by default so Play Again stays in reach.
const NightSlip = ({ mvp, recap = [] }) => (
  <div className="relative mb-4">
    <p data-mvp="" className="text-sm font-semibold text-brass-200">{mvpLine(mvp)}</p>
    {recap.length > 0 && (
      <details className="mt-2 text-left">
        <summary className={`flex h-11 cursor-pointer list-none items-center justify-center rounded-xl text-sm font-bold text-plush-100 btn-glass ${FOCUS_OUTLINE}`}>
          How the night went
        </summary>
        <ol className="mt-2 max-h-36 space-y-1 overflow-y-auto px-1 text-xs leading-snug text-plush-200">
          {recap.map((line, index) => (
            <li key={`${index}-${line}`}>{line}</li>
          ))}
        </ol>
      </details>
    )}
  </div>
);

export default NightSlip;
