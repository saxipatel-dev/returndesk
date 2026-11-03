// Display labels and colors shared by badges, filters and charts, so a status
// looks the same everywhere in the app.

export const STATUS = {
  pending_review: { label: "Pending review", badge: "bg-amber-50 text-amber-700 ring-amber-600/20", color: "#f59e0b" },
  under_review: { label: "Under review", badge: "bg-sky-50 text-sky-700 ring-sky-600/20", color: "#0ea5e9" },
  approved: { label: "Approved", badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", color: "#10b981" },
  rejected: { label: "Rejected", badge: "bg-rose-50 text-rose-700 ring-rose-600/20", color: "#f43f5e" },
  fulfilled: { label: "Fulfilled", badge: "bg-teal-50 text-teal-700 ring-teal-600/20", color: "#14b8a6" },
  closed: { label: "Closed", badge: "bg-slate-100 text-slate-700 ring-slate-500/20", color: "#64748b" },
  cancelled: { label: "Cancelled", badge: "bg-zinc-50 text-zinc-500 ring-zinc-400/20", color: "#a1a1aa" },
};

export const STATUS_ORDER = Object.keys(STATUS);
export const OPEN_STATUSES = ["pending_review", "under_review", "approved"];

export const REASONS = {
  defective: "Defective",
  damaged_in_transit: "Damaged in transit",
  wrong_item: "Wrong item sent",
  not_as_described: "Not as described",
  size_or_fit: "Size or fit",
  changed_mind: "Changed my mind",
  stopped_working: "Stopped working",
  other: "Other",
};

export const RETURN_REASONS = [
  "defective",
  "damaged_in_transit",
  "wrong_item",
  "not_as_described",
  "size_or_fit",
  "changed_mind",
  "other",
];
export const WARRANTY_REASONS = ["stopped_working", "defective", "other"];

export const RESOLUTIONS = {
  refund: "Refund",
  replacement: "Replacement",
  repair: "Repair",
};

export const RESOLUTIONS_BY_TYPE = {
  return: ["refund", "replacement"],
  warranty: ["repair", "replacement"],
};

export const REQUEST_TYPES = { return: "Return", warranty: "Warranty" };

export const ROLES = { customer: "Customer", employee: "Employee", admin: "Administrator" };

export const EVENT_LABELS = {
  created: "Request submitted",
  assigned: "Assigned",
  unassigned: "Returned to queue",
  status_changed: "Status updated",
  decision: "Decision recorded",
  fulfilled: "Fulfillment recorded",
  closed: "Request closed",
  cancelled: "Request cancelled",
  attachment_added: "File attached",
};

export const statusLabel = (s) => STATUS[s]?.label ?? s;
export const reasonLabel = (r) => REASONS[r] ?? r;
