import * as React from "react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"

// Escape belongs to the top layer, and closes only that. Radix closes the
// toast on every Escape (its listener runs first, in the document's capture
// phase), and a toast the player closes is gone for good, so over a dialog
// one key closed the dialog and threw away the announcement on screen with
// it: a battle's achievements, which land over the result dialog, where
// Escape means "Menu". Over a dialog the dialog takes the Escape alone
// (useDialog), and the toast plays on over whatever is under it. A toast the
// player has reached with F8 (the focus is in the list) is the top layer
// itself: Radix closes it, and the key goes no further, so the dialog under
// it stays. Stopped here, not skipped in useDialog by where the focus is:
// that skipped every Escape while the focus sat in the emptied list too, and
// the dialog could no longer be closed from the keyboard.
const leaveEscapeToDialog = (event) => {
  if (!document.documentElement.hasAttribute('data-dialog')) return
  if (event.target instanceof Element && event.target.closest('.toast-viewport')) {
    event.stopPropagation()
    return
  }
  event.preventDefault()
}

// The focus goes back to where F8 took it from once no toast is left open.
// Radix keeps it in the toast list as a toast closes, so the player can move
// on to the next; with none left it sat on an empty list, which neither says
// anything nor leads anywhere.
function useFocusBackFromToasts(viewportRef, anyOpen) {
  const returnTo = React.useRef(null)
  React.useEffect(() => {
    const region = viewportRef.current?.closest('[role="region"]')
    if (!region) return undefined
    const onFocusIn = (event) => {
      if (!region.contains(event.relatedTarget)) returnTo.current = event.relatedTarget
    }
    region.addEventListener('focusin', onFocusIn)
    return () => region.removeEventListener('focusin', onFocusIn)
  }, [viewportRef])
  React.useEffect(() => {
    if (anyOpen) return
    const back = returnTo.current
    returnTo.current = null
    const region = viewportRef.current?.closest('[role="region"]')
    if (back?.isConnected && region?.contains(document.activeElement)) back.focus()
  }, [viewportRef, anyOpen])
}

export function Toaster() {
  const { toasts } = useToast()
  const viewportRef = React.useRef(null)
  useFocusBackFromToasts(viewportRef, toasts.some((t) => t.open))

  return (
    (<ToastProvider>
      {/* `queued` is use-toast's own bookkeeping, not a prop for Radix.
          `icon` is drawn before the text: decoration (aria-hidden), as the
          title says what the toast is. toast-icon is the hook index.css
          uses to drop it where a dialog leaves the toast too little room. */}
      {toasts.map(function ({ id, title, description, action, icon, queued: _queued, ...props }) {
        return (
          (<Toast key={id} onEscapeKeyDown={leaveEscapeToDialog} {...props}>
            {icon && <span aria-hidden="true" className="toast-icon shrink-0">{icon}</span>}
            <div className="grid min-w-0 flex-1 gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>)
        );
      })}
      <ToastViewport ref={viewportRef} />
    </ToastProvider>)
  );
}
