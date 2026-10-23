import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"

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
          (<Toast key={id} {...props}>
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
