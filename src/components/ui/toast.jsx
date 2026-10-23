import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva } from "class-variance-authority";
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    // pointer-events-none on the list, auto on each toast (below): the list's
    // padded box spans the screen edge, and while a toast was open it blocked
    // taps on whatever sat around it. toast-viewport is the hook the
    // placement rules in index.css target (the battle board's, the deck
    // builder's, and the one for a toast over a dialog), and toast-title /
    // toast-description let the dialog rule set the type tighter on a phone.
    // Inset by the safe area, top on a phone and bottom from sm, so on a
    // home-screen install it clears the status bar and the home indicator.
    className={cn(
      "toast-viewport pointer-events-none fixed top-[env(safe-area-inset-top)] z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-[env(safe-area-inset-bottom)] sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
      className
    )}
    {...props} />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-xl px-5 py-4 pr-8 transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    // Dark glass with a coloured left edge, not shadcn's defaults. Those
    // resolve to the LIGHT theme (.dark is never applied here), so every
    // in-game notification was a glaring white slab dropped over a dark bar
    // scene — the single loudest off-brand element on the battle board.
    // bg-night-900 makes the glass opaque: panel-glass's fill is translucent
    // (right for a tile on the room), but a toast lands on top of text — the
    // currency row, a dialog's heading — which read through it. The utility
    // sets background-color under the material's gradient image.
    variants: {
      variant: {
        default: "panel-glass bg-night-900 border-l-[3px] border-l-brass-400 text-plush-100",
        destructive:
          "destructive group panel-glass bg-night-900 border-l-[3px] border-l-red-500 text-plush-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef(({ className, variant, ...props }, ref) => {
  return (
    (<ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props} />)
  );
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
      className
    )}
    {...props} />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-plush-300 opacity-0 transition-opacity hover:text-white focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-brass-300 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
      className
    )}
    toast-close=""
    aria-label="Dismiss notification"
    {...props}>
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Title ref={ref} className={cn("toast-title font-display text-base font-extrabold text-white group-[.destructive]:text-red-200", className)} {...props} />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

// plush-200 on the glass fill is ~10:1; the old opacity-90 on the light theme
// would have been fine there and is not needed here.
const ToastDescription = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Description ref={ref} className={cn("toast-description text-sm text-plush-200", className)} {...props} />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

export { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose, ToastAction };
