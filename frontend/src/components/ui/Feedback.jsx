import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import Button from "./Button";

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/70 ${className}`} />;
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="divide-y divide-slate-100" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-4">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={`h-4 ${c === 0 ? "w-24" : "flex-1"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className = "h-28" }) {
  return (
    <div className={`card p-5 ${className}`} aria-busy="true">
      <Skeleton className="mb-3 h-3 w-1/3" />
      <Skeleton className="h-6 w-1/2" />
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 rounded-full bg-slate-100 p-3">
        <Icon className="h-6 w-6 text-slate-400" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-slate-500">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 rounded-full bg-rose-50 p-3">
        <AlertTriangle className="h-6 w-6 text-rose-500" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">We couldn't load this</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RefreshCw} className="mt-4" onClick={() => onRetry()}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function InlineError({ children }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {children}
    </div>
  );
}
