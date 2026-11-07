import { HOUSE_RULES, writeHouseRule } from '@/lib/houseRules';
import { FOCUS_OUTLINE } from '@/lib/focus';

// One rule a night. Each row is a 44px control so a thumb can hit it on a
// phone, and the chosen one is pressed for assistive tech.
const HouseRulesPicker = ({ rule, onChange }) => (
  <div className="grid gap-1.5" role="group" aria-label="House rules">
    {HOUSE_RULES.map((option) => {
      const on = rule.id === option.id;
      return (
        <button
          key={option.id}
          type="button"
          aria-pressed={on}
          onClick={() => onChange(writeHouseRule(option.id))}
          className={`flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 text-left ${FOCUS_OUTLINE} ${on ? 'btn-brass' : 'btn-glass'}`}
        >
          <span className="font-display text-sm font-extrabold">{option.label}</span>
          <span className={`min-w-0 text-right text-xs leading-tight ${on ? 'text-night-950' : 'text-plush-300'}`}>{option.blurb}</span>
        </button>
      );
    })}
  </div>
);

export default HouseRulesPicker;
