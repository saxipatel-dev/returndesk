import { STATUS, REQUEST_TYPES } from "../../utils/labels";

export function Badge({ className = "", children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const meta = STATUS[status] ?? { label: status, badge: "bg-slate-100 text-slate-600" };
  return (
    <Badge className={meta.badge}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </Badge>
  );
}

export function TypeBadge({ type }) {
  const style =
    type === "warranty"
      ? "bg-violet-50 text-violet-700 ring-violet-600/20"
      : "bg-indigo-50 text-indigo-700 ring-indigo-600/20";
  return <Badge className={style}>{REQUEST_TYPES[type] ?? type}</Badge>;
}
