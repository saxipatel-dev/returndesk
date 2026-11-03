import {
  CheckCircle2,
  CircleDot,
  Paperclip,
  PackageCheck,
  Send,
  UserCheck,
  UserMinus,
  XCircle,
  Ban,
  Lock,
} from "lucide-react";
import { EVENT_LABELS, statusLabel } from "../../utils/labels";
import { formatDateTime } from "../../utils/format";

const ICONS = {
  created: { icon: Send, tone: "bg-indigo-100 text-indigo-600" },
  assigned: { icon: UserCheck, tone: "bg-sky-100 text-sky-600" },
  unassigned: { icon: UserMinus, tone: "bg-slate-100 text-slate-500" },
  status_changed: { icon: CircleDot, tone: "bg-slate-100 text-slate-500" },
  fulfilled: { icon: PackageCheck, tone: "bg-teal-100 text-teal-600" },
  closed: { icon: Lock, tone: "bg-slate-100 text-slate-600" },
  cancelled: { icon: Ban, tone: "bg-zinc-100 text-zinc-500" },
  attachment_added: { icon: Paperclip, tone: "bg-slate-100 text-slate-500" },
};

function iconFor(event) {
  if (event.event_type === "decision") {
    return event.to_status === "approved"
      ? { icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-600" }
      : { icon: XCircle, tone: "bg-rose-100 text-rose-600" };
  }
  return ICONS[event.event_type] ?? ICONS.status_changed;
}

function describe(event) {
  if (event.event_type === "decision") return `Request ${statusLabel(event.to_status).toLowerCase()}`;
  if (event.event_type === "status_changed") return `Moved to ${statusLabel(event.to_status).toLowerCase()}`;
  return EVENT_LABELS[event.event_type] ?? event.event_type;
}

export default function Timeline({ events, showActorRole = false }) {
  if (!events.length) return <p className="text-sm text-slate-500">No activity yet.</p>;
  return (
    <ol className="relative space-y-5" aria-label="Request history">
      {events.map((event, index) => {
        const { icon: Icon, tone } = iconFor(event);
        return (
          <li key={event.id} className="relative flex gap-3">
            {index < events.length - 1 && (
              <span className="absolute top-8 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
            )}
            <span
              className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${tone}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm font-medium text-slate-900">{describe(event)}</p>
              <p className="text-xs text-slate-500">
                {formatDateTime(event.created_at)} · {event.actor.name}
                {showActorRole && event.actor.role !== "customer" ? ` (${event.actor.role})` : ""}
              </p>
              {event.note && (
                <p className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{event.note}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
