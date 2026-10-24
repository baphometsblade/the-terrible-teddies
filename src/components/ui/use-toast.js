// Inspired by react-hot-toast library
import * as React from "react"

// One toast on screen at a time: they share one spot (the top of a phone,
// the table's centre line in a battle), and two at once covered what was
// under them twice over.
const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

// Two kinds of toast share that spot. Feedback on what the player just did
// ("Not enough energy!", "Deck Saved!") shows at once and replaces whatever
// is up: it answers the last tap, and a stale answer is worse than none.
// An announcement (`queue: true`: an achievement, a level-up, a season's
// delivery) is news the player did not ask for, and several arrive at the
// same moment; each used to replace the last, so all but one were cut short
// or never seen. Announcements wait their turn and stay for their reading
// time, and one that feedback interrupts goes back to the front of the line
// to be shown again in full.
//
// The pause before an announcement comes on: after the last one leaves, so
// its exit is seen rather than overwritten, and after it is raised, so that
// whatever raised it lands first (a claim's receipt, the result dialog).
const QUEUE_GAP_MS = 400

// How long the line holds after the spot is cleared (a dismissal without an
// id). The battle board clears it for its turn banner (up 1.3 s), the leave
// question and the result dialog's entrance; the line picks up after that.
const CLEAR_HOLD_MS = 1500

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString();
}

/**
 * How long a toast takes to read: about 55 ms a character, plus a second to
 * notice it, between `min` and `max`. The battle board's callouts use the
 * same rate with a shorter floor; announcements default to this.
 */
export function readingTime(title = '', description = '', { min = 4000, max = 10000 } = {}) {
  const chars = `${typeof title === 'string' ? title : ''} ${typeof description === 'string' ? description : ''}`.length
  return Math.min(max, Math.max(min, 1000 + 55 * chars))
}

const toastTimeouts = new Map()

const addToRemoveQueue = (toastId) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state, action) => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t),
      };

    case "DISMISS_TOAST": {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t),
      };
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
}

const listeners = []

let memoryState = { toasts: [] }

// Announcements waiting their turn, oldest first, and the pending hand-over
// to the next one.
let waiting = []
let nextTimer = null

function dispatch(action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

const showing = () => memoryState.toasts.find((t) => t.open)

// Brings on the next announcement once nothing is showing, after `delay`.
// A pending hand-over is left alone, so a hold is never cut short.
function showNext(delay = QUEUE_GAP_MS) {
  if (nextTimer || showing() || waiting.length === 0) return
  nextTimer = setTimeout(() => {
    nextTimer = null
    if (showing() || waiting.length === 0) return
    dispatch({ type: "ADD_TOAST", toast: waiting.shift() })
  }, delay)
}

// An announcement cut short goes back to the front of the line, to be shown
// again whole.
function requeueIfCut(cut) {
  if (cut?.queued) waiting.unshift({ ...cut, open: true })
}

function toast({
  queue = false,
  ...props
}) {
  const id = genId()

  const update = (props) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dismissToast(id)

  const entry = {
    duration: queue ? readingTime(props.title, props.description) : undefined,
    // How a screen reader hears it (Radix's type). An announcement is news
    // the player did not ask for, so it waits for a pause in the speech
    // ('background': polite) rather than cutting off whatever is being read
    // (the result dialog, a claim's own status line). Feedback answers the
    // last action, and a rule refusing it ("Not enough energy!") must be
    // heard now ('foreground': assertive).
    type: queue ? 'background' : 'foreground',
    ...props,
    id,
    queued: queue,
    open: true,
    onOpenChange: (open) => {
      if (!open) dismiss()
    },
  }
  if (entry.duration === undefined) delete entry.duration

  if (queue) {
    // A beat from now if the spot is free; otherwise after what is showing.
    waiting.push(entry)
    showNext()
  } else {
    // Feedback takes the spot now. An announcement it interrupts is not lost.
    requeueIfCut(showing())
    dispatch({ type: "ADD_TOAST", toast: entry })
  }

  return {
    id: id,
    dismiss,
    update,
  }
}

// One function for every caller and every render. The template this file
// came from returned a fresh arrow here on each render, so a component that
// listed `dismiss` in an effect's dependencies re-ran that effect on every
// render of its own — and the battle board's did, dismissing each toast the
// moment it appeared and achievement unlocks under the result dialog.
//
// With an id it closes that toast (or takes it out of the line, if it has
// not been shown yet), and the next one waiting comes on. Without one it
// clears the spot: whatever is showing closes, and the line holds for
// CLEAR_HOLD_MS. The battle board does this at every turn boundary, as it
// asks whether to leave and at game over. It does not empty the line: it
// once did, and that discarded every achievement a battle earned, because
// they are raised in the same moment as the game-over clear (sometimes just
// before it). An announcement the clear cuts short comes back whole.
function dismissToast(toastId) {
  if (toastId === undefined) {
    requeueIfCut(showing())
    clearTimeout(nextTimer)
    nextTimer = null
    dispatch({ type: "DISMISS_TOAST", toastId })
    showNext(CLEAR_HOLD_MS)
    return
  }
  waiting = waiting.filter((t) => t.id !== toastId)
  dispatch({ type: "DISMISS_TOAST", toastId })
  showNext()
}

function useToast() {
  const [state, setState] = React.useState(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    };
  }, [state])

  return {
    ...state,
    toast,
    dismiss: dismissToast,
  };
}

// For tests: an empty spot and an empty line, as a fresh page has them.
function resetToasts() {
  waiting = []
  clearTimeout(nextTimer)
  nextTimer = null
  memoryState = { toasts: [] }
  listeners.forEach((listener) => listener(memoryState))
}

export { useToast, toast, resetToasts }
