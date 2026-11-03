import { useSearchParams } from "react-router";
import { Inbox, RotateCcw, Search } from "lucide-react";
import { returnsApi, staffApi } from "../../api";
import { useAsync, useDebouncedValue } from "../../hooks/useAsync";
import { useAuth } from "../../context/AuthContext";
import { Card, PageHeader, Pagination } from "../../components/ui/Layout";
import Button from "../../components/ui/Button";
import { EmptyState, ErrorState, TableSkeleton } from "../../components/ui/Feedback";
import RequestsTable from "../../components/requests/RequestsTable";
import { STATUS, STATUS_ORDER } from "../../utils/labels";

const PAGE_SIZE = 15;
const DEFAULTS = {
  q: "",
  status: "",
  type: "",
  assigned: "",
  open: "1",
  sort: "created_at",
  page: "1",
  from: "",
  to: "",
};

export default function Queue() {
  const { user } = useAuth();
  // Filters live in the URL so a filtered queue can be bookmarked or shared.
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, params.get(k) ?? v]));
  const page = Number(filters.page) || 1;
  const q = useDebouncedValue(filters.q);

  const staff = useAsync(() => staffApi.staff(), []);
  const requests = useAsync(
    () =>
      returnsApi.list({
        q,
        status: filters.status,
        request_type: filters.type,
        assigned: filters.assigned,
        open_only: filters.open === "1" && !filters.status,
        date_from: filters.from,
        date_to: filters.to,
        sort: filters.sort,
        page,
        page_size: PAGE_SIZE,
      }),
    [q, filters.status, filters.type, filters.assigned, filters.open, filters.from, filters.to, filters.sort, page],
  );

  const set = (patch, resetPage = true) => {
    const next = { ...filters, ...patch, ...(resetPage ? { page: "1" } : {}) };
    const cleaned = Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== DEFAULTS[k]));
    setParams(cleaned, { replace: true });
  };

  const isFiltered = Object.entries(filters).some(([k, v]) => k !== "page" && k !== "sort" && v !== DEFAULTS[k]);

  return (
    <>
      <PageHeader
        title={user.role === "admin" ? "Request monitor" : "Work queue"}
        description="Search, filter and pick up return and warranty requests."
      />

      <Card bodyClassName="">
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                className="input pl-9"
                placeholder="Reference, order number, product or customer"
                aria-label="Search requests"
                value={filters.q}
                onChange={(e) => set({ q: e.target.value })}
              />
            </div>
            <select
              className="input lg:w-44"
              aria-label="Status"
              value={filters.status}
              onChange={(e) => set({ status: e.target.value })}
            >
              <option value="">{filters.open === "1" ? "All open statuses" : "All statuses"}</option>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS[s].label}
                </option>
              ))}
            </select>
            <select
              className="input lg:w-48"
              aria-label="Assignment"
              value={filters.assigned}
              onChange={(e) => set({ assigned: e.target.value })}
            >
              <option value="">Anyone</option>
              <option value="me">Assigned to me</option>
              <option value="unassigned">Unassigned</option>
              {(staff.data ?? [])
                .filter((s) => s.id !== user.id)
                .map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="input w-36"
              aria-label="Request type"
              value={filters.type}
              onChange={(e) => set({ type: e.target.value })}
            >
              <option value="">All types</option>
              <option value="return">Returns</option>
              <option value="warranty">Warranty</option>
            </select>
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              From
              <input
                type="date"
                className="input w-40"
                value={filters.from}
                onChange={(e) => set({ from: e.target.value })}
                aria-label="Submitted from"
              />
            </label>
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              To
              <input
                type="date"
                className="input w-40"
                value={filters.to}
                onChange={(e) => set({ to: e.target.value })}
                aria-label="Submitted to"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                checked={filters.open === "1"}
                onChange={(e) => set({ open: e.target.checked ? "1" : "0" })}
                disabled={Boolean(filters.status)}
              />
              Open requests only
            </label>
            {isFiltered && (
              <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setParams({}, { replace: true })}>
                Reset filters
              </Button>
            )}
            {requests.data && <span className="ml-auto text-sm text-slate-500">{requests.data.total} requests</span>}
          </div>
        </div>

        {requests.loading && !requests.data ? (
          <TableSkeleton rows={8} cols={6} />
        ) : requests.error ? (
          <ErrorState message={requests.error} onRetry={requests.reload} />
        ) : requests.data.items.length === 0 ? (
          <EmptyState icon={Inbox} title={isFiltered ? "No requests match these filters" : "The queue is empty"}>
            {isFiltered ? "Try widening the filters." : "New requests from customers will appear here."}
          </EmptyState>
        ) : (
          <div className={requests.loading ? "opacity-60" : ""}>
            <RequestsTable
              items={requests.data.items}
              linkTo={(r) => `/staff/returns/${r.id}`}
              showCustomer
              showAssignee
              sort={filters.sort}
              onSort={(sort) => set({ sort })}
            />
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={requests.data.total}
              onChange={(p) => set({ page: String(p) }, false)}
            />
          </div>
        )}
      </Card>
    </>
  );
}
