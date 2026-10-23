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
// The pause between one leaving and the next arriving, so the last one's
// exit is seen rather than overwritten.
const QUEUE_GAP_MS = 400

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

// Brings on the next announcement once nothing is showing.
function showNext() {
  if (nextTimer || showing() || waiting.length === 0) return
  nextTimer = setTimeout(() => {
    nextTimer = null
    if (showing() || waiting.length === 0) return
    dispatch({ type: "ADD_TOAST", toast: waiting.shift() })
  }, QUEUE_GAP_MS)
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
    waiting.push(entry)
    // Straight on if the spot is free; otherwise after what is showing.
    if (!showing() && !nextTimer) {
      dispatch({ type: "ADD_TOAST", toast: waiting.shift() })
    } else {
      showNext()
    }
  } else {
    // Feedback takes the spot now. An announcement it interrupts is not
    // lost: it goes back to the front of the line, to be shown again whole.
    const cut = showing()
    if (cut?.queued) waiting.unshift({ ...cut, open: true })
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
// clears everything, waiting announcements included: the battle board calls
// it so that nothing at all sits on a turn banner, the leave question or the
// result, and an announcement queued behind a callout would otherwise land
// there a moment later.
function dismissToast(toastId) {
  if (toastId === undefined) {
    waiting = []
    clearTimeout(nextTimer)
    nextTimer = null
  } else {
    waiting = waiting.filter((t) => t.id !== toastId)
  }
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
