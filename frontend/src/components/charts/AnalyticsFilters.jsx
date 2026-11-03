import { STATUS, STATUS_ORDER } from "../../utils/labels";
import { RANGES } from "../../utils/dateRanges";

export default function AnalyticsFilters({ filters, onChange }) {
  const set = (patch) => onChange({ ...filters, ...patch });
  return (
    <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
      <div>
        <label htmlFor="range" className="label">
          Date range
        </label>
        <select
          id="range"
          className="input w-44"
          value={filters.range}
          onChange={(e) => set({ range: e.target.value })}
        >
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      {filters.range === "custom" && (
        <>
          <div>
            <label htmlFor="from" className="label">
              From
            </label>
            <input
              id="from"
              type="date"
              className="input"
              value={filters.from}
              onChange={(e) => set({ from: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="to" className="label">
              To
            </label>
            <input
              id="to"
              type="date"
              className="input"
              value={filters.to}
              onChange={(e) => set({ to: e.target.value })}
            />
          </div>
        </>
      )}
      <div>
        <label htmlFor="status" className="label">
          Status
        </label>
        <select
          id="status"
          className="input w-44"
          value={filters.status}
          onChange={(e) => set({ status: e.target.value })}
        >
          <option value="">All statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS[s].label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="type" className="label">
          Type
        </label>
        <select id="type" className="input w-36" value={filters.type} onChange={(e) => set({ type: e.target.value })}>
          <option value="">All types</option>
          <option value="return">Returns</option>
          <option value="warranty">Warranty</option>
        </select>
      </div>
      <p className="w-full text-xs text-slate-500">
        Dates are calendar days in UTC, filtered by when the request was created.
      </p>
    </div>
  );
}
