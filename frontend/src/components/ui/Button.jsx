import { Link } from "react-router";
import { Loader2 } from "lucide-react";

const VARIANTS = {
  primary: "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 disabled:bg-indigo-300",
  secondary:
    "bg-white text-slate-700 ring-1 ring-slate-300 ring-inset shadow-xs hover:bg-slate-50 disabled:text-slate-400",
  danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-500 disabled:bg-rose-300",
  success: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-500 disabled:bg-emerald-300",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-300",
};

const SIZES = {
  sm: "px-2.5 py-1.5 text-xs gap-1.5",
  md: "px-3.5 py-2 text-sm gap-2",
  lg: "px-4 py-2.5 text-sm gap-2",
};

function classes(variant, size, className) {
  return `inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
}

/** A router link styled like a button (avoids nesting <button> inside <a>). */
export function LinkButton({ to, variant = "primary", size = "md", icon: Icon, className = "", children, ...props }) {
  return (
    <Link to={to} className={classes(variant, size, className)} {...props}>
      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      {children}
    </Link>
  );
}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon: Icon,
  className = "",
  children,
  disabled,
  type = "button",
  ...props
}) {
  return (
    <button type={type} disabled={disabled || loading} className={classes(variant, size, className)} {...props}>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="h-4 w-4" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
