import { CheckCircle2, ClipboardList, Hourglass, Timer } from "lucide-react";
import { KpiCard } from "../ui/Layout";
import { formatDays, formatRate } from "../../utils/format";

export default function KpiRow({ summary }) {
  const decided = summary.approved_decisions + summary.rejected_decisions;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Total requests"
        value={summary.total_requests}
        hint="Created in the selected period"
        icon={ClipboardList}
      />
      <KpiCard
        label="Pending review"
        value={summary.pending_review}
        hint={`${summary.unassigned_open} open and unassigned`}
        icon={Hourglass}
        tone="amber"
      />
      <KpiCard
        label="Approval rate"
        value={formatRate(summary.approval_rate)}
        hint={decided ? `${summary.approved_decisions} of ${decided} decisions` : "No decisions yet"}
        icon={CheckCircle2}
        tone="emerald"
      />
      <KpiCard
        label="Avg. resolution time"
        value={formatDays(summary.avg_resolution_days)}
        hint="Created to closed, closed requests only"
        icon={Timer}
        tone="sky"
      />
    </div>
  );
}
