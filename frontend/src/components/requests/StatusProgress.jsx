import { Check } from "lucide-react";

// The happy path a customer cares about. Rejected/cancelled requests end early.
const STEPS = [
  { key: "submitted", label: "Submitted" },
  { key: "review", label: "In review" },
  { key: "decision", label: "Decision" },
  { key: "fulfilled", label: "Resolved" },
];

function reachedStep(request) {
  switch (request.status) {
    case "pending_review":
      return 0;
    case "under_review":
      return 1;
    case "approved":
    case "rejected":
      return 2;
    case "fulfilled":
      return 3;
    case "closed":
      return request.decision === "approved" ? 3 : 2;
    default:
      return 0;
  }
}

export default function StatusProgress({ request }) {
  if (request.status === "cancelled") {
    return <p className="text-sm text-slate-500">This request was cancelled before a decision was made.</p>;
  }
  const reached = reachedStep(request);
  const rejected = request.decision === "rejected";
  return (
    <ol className="flex items-center" aria-label="Progress">
      {STEPS.map((step, index) => {
        const done = index <= reached;
        const isRejected = rejected && index === 2;
        const label = index === 2 && request.decision ? (rejected ? "Rejected" : "Approved") : step.label;
        return (
          <li key={step.key} className={`flex items-center ${index < STEPS.length - 1 ? "flex-1" : ""}`}>
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  isRejected
                    ? "bg-rose-500 text-white"
                    : done
                      ? "bg-indigo-600 text-white"
                      : "border-2 border-slate-200 bg-white text-slate-400"
                }`}
                aria-current={index === reached ? "step" : undefined}
              >
                {done && !isRejected ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span className={`text-xs whitespace-nowrap ${done ? "font-medium text-slate-800" : "text-slate-400"}`}>
                {label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <span
                className={`mx-2 mb-5 h-0.5 flex-1 ${index < reached && !(rejected && index >= 2) ? "bg-indigo-600" : "bg-slate-200"}`}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
