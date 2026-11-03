import { useState } from "react";
import { ClipboardList, FilePlus2, Search } from "lucide-react";
import { returnsApi } from "../../api";
import { useAsync, useDebouncedValue } from "../../hooks/useAsync";
import { Card, PageHeader, Pagination } from "../../components/ui/Layout";
import { LinkButton } from "../../components/ui/Button";
import { EmptyState, ErrorState, TableSkeleton } from "../../components/ui/Feedback";
import RequestsTable from "../../components/requests/RequestsTable";
import { STATUS, STATUS_ORDER } from "../../utils/labels";

const PAGE_SIZE = 10;

export default function MyRequests() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState("-created_at");
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(query);

  const requests = useAsync(
    () => returnsApi.list({ q, status, request_type: type, sort, page, page_size: PAGE_SIZE }),
    [q, status, type, sort, page],
  );

  const filtered = q || status || type;
  const resetPage = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="My requests"
        description="Every return and warranty claim you've submitted."
        actions={
          <LinkButton to="/returns/new" icon={FilePlus2}>
            New request
          </LinkButton>
        }
      />

      <Card bodyClassName="">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              className="input pl-9"
              placeholder="Search by reference, order or product"
              aria-label="Search requests"
              value={query}
              onChange={resetPage(setQuery)}
            />
          </div>
          <select
            className="input sm:w-44"
            aria-label="Filter by status"
            value={status}
            onChange={resetPage(setStatus)}
          >
            <option value="">All statuses</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS[s].label}
              </option>
            ))}
          </select>
          <select className="input sm:w-40" aria-label="Filter by type" value={type} onChange={resetPage(setType)}>
            <option value="">All types</option>
            <option value="return">Returns</option>
            <option value="warranty">Warranty</option>
          </select>
        </div>

        {requests.loading && !requests.data ? (
          <TableSkeleton />
        ) : requests.error ? (
          <ErrorState message={requests.error} onRetry={requests.reload} />
        ) : requests.data.items.length === 0 ? (
          <EmptyState icon={ClipboardList} title={filtered ? "No matching requests" : "No requests yet"}>
            {filtered ? "Try clearing the filters." : "Start a return from one of your purchases."}
          </EmptyState>
        ) : (
          <>
            <RequestsTable
              items={requests.data.items}
              linkTo={(r) => `/returns/${r.id}`}
              sort={sort}
              onSort={(next) => {
                setSort(next);
                setPage(1);
              }}
            />
            <Pagination page={page} pageSize={PAGE_SIZE} total={requests.data.total} onChange={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
