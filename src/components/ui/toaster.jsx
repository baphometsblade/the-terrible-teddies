import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"

// Escape belongs to the top layer. Radix closes the toast on every Escape
// (its listener runs first, in the document's capture phase), and a toast the
// player closes is gone for good, so over a dialog one key closed the dialog
// and threw away the announcement on screen with it: a battle's achievements,
// which land over the result dialog, where Escape means "Menu". Over a
// dialog the dialog takes the Escape alone (useDialog), and the toast plays
// on over whatever is under it. A toast the player has reached with F8 (the
// focus is in the list) is the top layer itself, and Escape closes it, not
// the dialog.
const leaveEscapeToDialog = (event) => {
  if (!document.documentElement.hasAttribute('data-dialog')) return
  if (event.target instanceof Element && event.target.closest('.toast-viewport')) return
  event.preventDefault()
}

export function Toaster() {
  const { toasts } = useToast()

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
      <ToastViewport />
    </ToastProvider>)
  );
}
