import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Info } from "lucide-react";
import { STATUS, reasonLabel, statusLabel } from "../../utils/labels";
import { formatMonth } from "../../utils/format";

const COLORS = {
  primary: "#4f46e5",
  primarySoft: "#a5b4fc",
  approved: STATUS.approved.color,
  rejected: STATUS.rejected.color,
  grid: "#e2e8f0",
  axis: "#64748b",
};

const axisProps = {
  tick: { fontSize: 12, fill: COLORS.axis },
  tickLine: false,
  axisLine: { stroke: COLORS.grid },
};

const tooltipProps = {
  contentStyle: {
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    boxShadow: "0 4px 12px rgb(15 23 42 / 0.08)",
    fontSize: 13,
  },
  cursor: { fill: "rgb(99 102 241 / 0.06)" },
};

/**
 * Card wrapper for every chart: title, the metric definition, a text summary
 * for screen readers, and an empty state when there's nothing to plot.
 */
export function ChartCard({ title, definition, summary, isEmpty, height = 260, className = "", children }) {
  return (
    <figure className={`card flex flex-col p-5 ${className}`}>
      <figcaption className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-0.5 flex items-start gap-1 text-xs text-slate-500">
          <Info className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
          {definition}
        </p>
      </figcaption>
      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center" style={{ minHeight: height }}>
          <BarChart3 className="h-6 w-6 text-slate-300" aria-hidden="true" />
          <p className="mt-2 text-sm text-slate-500">No data for the selected filters.</p>
        </div>
      ) : (
        <>
          <p className="sr-only">{summary}</p>
          <div style={{ height }} aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              {children}
            </ResponsiveContainer>
          </div>
        </>
      )}
    </figure>
  );
}

const sum = (rows, key) => rows.reduce((total, row) => total + (row[key] ?? 0), 0);

export function MonthlyRequestsChart({ data }) {
  const rows = data.map((d) => ({ ...d, label: formatMonth(d.month) }));
  return (
    <ChartCard
      title="Monthly return requests"
      definition="Requests grouped by the month they were created."
      isEmpty={sum(rows, "count") === 0}
      summary={rows.map((r) => `${r.label}: ${r.count}`).join(", ")}
    >
      <LineChart data={rows} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis allowDecimals={false} {...axisProps} />
        <Tooltip {...tooltipProps} formatter={(v) => [v, "Requests"]} />
        <Line
          type="monotone"
          dataKey="count"
          name="Requests"
          stroke={COLORS.primary}
          strokeWidth={2.5}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ChartCard>
  );
}

export function CategoryChart({ data }) {
  return (
    <ChartCard
      title="Returns by product category"
      definition="Requests grouped by the category of the purchased product."
      isEmpty={data.length === 0}
      summary={data.map((r) => `${r.category}: ${r.count}`).join(", ")}
    >
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="category" {...axisProps} interval={0} tickFormatter={(v) => v.split(" ")[0]} />
        <YAxis allowDecimals={false} {...axisProps} />
        <Tooltip {...tooltipProps} formatter={(v) => [v, "Requests"]} />
        <Bar dataKey="count" name="Requests" fill={COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ChartCard>
  );
}

export function StatusDonut({ data }) {
  const rows = data.map((d) => ({ ...d, label: statusLabel(d.status) }));
  const total = sum(rows, "count");
  return (
    <ChartCard
      title="Request status distribution"
      definition="Requests grouped by their current status."
      isEmpty={total === 0}
      summary={rows.map((r) => `${r.label}: ${r.count}`).join(", ")}
    >
      <PieChart>
        <Pie data={rows} dataKey="count" nameKey="label" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
          {rows.map((r) => (
            <Cell key={r.status} fill={STATUS[r.status]?.color ?? COLORS.primary} stroke="#fff" />
          ))}
        </Pie>
        <Tooltip {...tooltipProps} formatter={(v, name) => [`${v} (${Math.round((v / total) * 100)}%)`, name]} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ChartCard>
  );
}

export function ReasonsChart({ data }) {
  const rows = data.map((d) => ({ ...d, label: reasonLabel(d.reason) }));
  return (
    <ChartCard
      title="Most common return reasons"
      definition="Requests grouped by the reason the customer selected."
      isEmpty={rows.length === 0}
      summary={rows.map((r) => `${r.label}: ${r.count}`).join(", ")}
    >
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 20, bottom: 0 }}>
        <CartesianGrid stroke={COLORS.grid} horizontal={false} />
        <XAxis type="number" allowDecimals={false} {...axisProps} />
        <YAxis type="category" dataKey="label" width={120} {...axisProps} />
        <Tooltip {...tooltipProps} formatter={(v) => [v, "Requests"]} />
        <Bar dataKey="count" name="Requests" fill={COLORS.primary} radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ChartCard>
  );
}

export function ResolutionChart({ data }) {
  const rows = data.map((d) => ({ ...d, label: formatMonth(d.month) }));
  return (
    <ChartCard
      title="Average resolution time"
      definition="Mean days from creation to closure, for closed requests, by month closed."
      isEmpty={!rows.some((r) => r.avg_days !== null)}
      summary={rows
        .filter((r) => r.avg_days !== null)
        .map((r) => `${r.label}: ${r.avg_days} days`)
        .join(", ")}
    >
      <LineChart data={rows} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} unit="d" />
        <Tooltip
          {...tooltipProps}
          formatter={(v, _name, item) => [`${v} days (${item.payload.closed_count} closed)`, "Average"]}
        />
        <Line
          type="monotone"
          dataKey="avg_days"
          name="Average days"
          stroke="#0ea5e9"
          strokeWidth={2.5}
          dot={{ r: 3 }}
          connectNulls
        />
      </LineChart>
    </ChartCard>
  );
}

export function WorkloadChart({ data, unassigned, className = "" }) {
  const rows = data.map((d) => ({ ...d, first: d.name.split(" ")[0] }));
  return (
    <ChartCard
      title="Employee workload"
      className={className}
      definition={`Open requests (pending, under review or approved) assigned to each active staff member.${
        unassigned !== undefined ? ` Unassigned: ${unassigned}.` : ""
      }`}
      isEmpty={rows.length === 0}
      summary={rows.map((r) => `${r.name}: ${r.open_requests}`).join(", ")}
    >
      <BarChart data={rows} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="first" {...axisProps} interval={0} />
        <YAxis allowDecimals={false} {...axisProps} />
        <Tooltip
          {...tooltipProps}
          labelFormatter={(_, payload) => payload?.[0]?.payload.name ?? ""}
          formatter={(v) => [v, "Open requests"]}
        />
        <Bar dataKey="open_requests" name="Open requests" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ChartCard>
  );
}

export function DecisionsChart({ data }) {
  const rows = data.map((d) => ({ ...d, label: formatMonth(d.month) }));
  return (
    <ChartCard
      title="Approval vs. rejection trends"
      definition="Approve and reject decisions grouped by the month the decision was made."
      isEmpty={sum(rows, "approved") + sum(rows, "rejected") === 0}
      summary={rows.map((r) => `${r.label}: ${r.approved} approved, ${r.rejected} rejected`).join("; ")}
    >
      <BarChart data={rows} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis allowDecimals={false} {...axisProps} />
        <Tooltip {...tooltipProps} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="approved" name="Approved" fill={COLORS.approved} radius={[3, 3, 0, 0]} maxBarSize={20} />
        <Bar dataKey="rejected" name="Rejected" fill={COLORS.rejected} radius={[3, 3, 0, 0]} maxBarSize={20} />
      </BarChart>
    </ChartCard>
  );
}
