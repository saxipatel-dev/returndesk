import { useId } from "react";

/** Label + control + help/error text, wired up for screen readers. */
export function Field({ label, error, hint, required, children, className = "" }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {required && <span className="text-rose-500"> *</span>}
        </label>
      )}
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-rose-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function TextInput({ label, error, hint, required, className, ...props }) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {(a11y) => <input className={`input ${error ? "input-error" : ""}`} required={required} {...a11y} {...props} />}
    </Field>
  );
}

export function TextArea({ label, error, hint, required, className, rows = 4, ...props }) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {(a11y) => (
        <textarea
          rows={rows}
          className={`input resize-y ${error ? "input-error" : ""}`}
          required={required}
          {...a11y}
          {...props}
        />
      )}
    </Field>
  );
}

export function Select({ label, error, hint, required, className, children, ...props }) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {(a11y) => (
        <select className={`input pr-8 ${error ? "input-error" : ""}`} required={required} {...a11y} {...props}>
          {children}
        </select>
      )}
    </Field>
  );
}
