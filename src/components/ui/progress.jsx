import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

// The share of the track that is filled, as a percentage in 0..100. Clamped
// once here: Radix rejects (and logs) a value outside its range, and an
// overshoot (XP past the next level, say) would otherwise slide the fill off
// its track.
export const fillPercent = (value) =>
  (Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0);

// The indicator is the full width of the track, slid left by the unfilled
// share. A gradient on it (callers pass one with [&>div]:bg-gradient-to-r)
// would span the whole track, so only its right-hand end ever showed: a bar at
// 15% was a stub of the darkest colour while one at 90% showed nearly the
// whole ramp, and bars in one list read as different colours. Sizing the
// background to the filled share and pinning it right puts the whole ramp on
// the part that is visible, at any value. A plain background colour ignores
// background-size, so a solid fill is unaffected.
//
// Both move together: transform and background-size are linear in the value,
// so one transition keeps them in step on the way.
export const indicatorStyle = (value) => {
  const v = fillPercent(value);
  return { transform: `translateX(-${100 - v}%)`, backgroundSize: `${v}% 100%` };
};

const Progress = React.forwardRef(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    // Forward value to Radix itself (not just the indicator's inline style)
    // so it computes aria-valuenow/data-state instead of always reporting
    // "indeterminate" — callers still just pass `value` as before. No value
    // at all stays indeterminate, as Radix means it.
    value={value == null ? null : fillPercent(value)}
    className={cn("relative h-4 w-full overflow-hidden rounded-full bg-secondary", className)}
    {...props}>
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary bg-right bg-no-repeat transition-all"
      style={indicatorStyle(value)} />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
