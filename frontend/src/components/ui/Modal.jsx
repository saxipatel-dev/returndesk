import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import Button from "./Button";

export function Modal({ open, title, onClose, children, footer, size = "max-w-lg" }) {
  const panel = useRef(null);
  // Parents usually pass an inline onClose; keep the latest one in a ref so the
  // focus effect below only runs when the dialog opens, not on every render.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const onKey = (e) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    // Move focus into the dialog, and back to where it was when it closes.
    const focusable = panel.current?.querySelector("textarea, input, select, button:not([data-close])");
    (focusable || panel.current)?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={`relative w-full ${size} rounded-xl bg-white shadow-xl focus:outline-none`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="modal-title" className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            data-close
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 rounded-b-xl border-t border-slate-100 bg-slate-50 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = "Confirm",
  variant = "primary",
  loading,
  disabled,
  onConfirm,
  onClose,
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={loading ? () => {} : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Go back
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading} disabled={disabled}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-slate-600">{children}</div>
    </Modal>
  );
}
