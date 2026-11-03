import { Link } from "react-router";
import { CheckCircle2, ClipboardList, Clock, FilePlus2, ShoppingBag } from "lucide-react";
import { catalogApi, returnsApi } from "../../api";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../context/AuthContext";
import { Card, KpiCard, PageHeader } from "../../components/ui/Layout";
import { LinkButton } from "../../components/ui/Button";
import { CardSkeleton, EmptyState, ErrorState, TableSkeleton } from "../../components/ui/Feedback";
import RequestsTable from "../../components/requests/RequestsTable";
import { OPEN_STATUSES } from "../../utils/labels";
import { daysUntil, formatDate } from "../../utils/format";

export default function CustomerDashboard() {
  const { user } = useAuth();
  const requests = useAsync(() => returnsApi.list({ page_size: 100 }), []);
  const purchases = useAsync(() => catalogApi.purchases(), []);

  const items = requests.data?.items ?? [];
  const open = items.filter((r) => OPEN_STATUSES.includes(r.status)).length;
  const resolved = items.filter((r) => ["fulfilled", "closed"].includes(r.status)).length;

  const returnable = (purchases.data ?? [])
    .flatMap((p) => p.items.map((item) => ({ ...item, order: p })))
    .filter((item) => item.eligibility.can_return)
    .sort((a, b) => new Date(a.eligibility.return_window_ends) - new Date(b.eligibility.return_window_ends));

  return (
    <>
      <PageHeader
        title={`Hi, ${user.name.split(" ")[0]}`}
        description="Here's where your returns and warranty claims stand."
        actions={
          <LinkButton to="/returns/new" icon={FilePlus2}>
            New request
          </LinkButton>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {requests.loading ? (
          Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <KpiCard label="All requests" value={requests.data?.total ?? 0} icon={ClipboardList} />
            <KpiCard label="In progress" value={open} icon={Clock} tone="amber" />
            <KpiCard label="Resolved" value={resolved} icon={CheckCircle2} tone="emerald" />
            <KpiCard
              label="Items you can return"
              value={purchases.loading ? "…" : returnable.length}
              icon={ShoppingBag}
              tone="sky"
            />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card
          title="Recent requests"
          className="xl:col-span-2"
          bodyClassName=""
          actions={
            <Link to="/returns" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              View all
            </Link>
          }
        >
          {requests.loading ? (
            <TableSkeleton rows={4} />
          ) : requests.error ? (
            <ErrorState message={requests.error} onRetry={requests.reload} />
          ) : items.length === 0 ? (
            <EmptyState
              title="No requests yet"
              action={
                <LinkButton to="/returns/new" size="sm">
                  Start a return
                </LinkButton>
              }
            >
              When you return an item or file a warranty claim, it will show up here.
            </EmptyState>
          ) : (
            <RequestsTable items={items.slice(0, 5)} linkTo={(r) => `/returns/${r.id}`} />
          )}
        </Card>

        <Card title="Return window closing soon" description="Items still eligible for a standard return.">
          {purchases.loading ? (
            <TableSkeleton rows={3} cols={2} />
          ) : purchases.error ? (
            <ErrorState message={purchases.error} onRetry={purchases.reload} />
          ) : returnable.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing is inside its return window right now.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {returnable.slice(0, 5).map((item) => {
                const days = daysUntil(item.eligibility.return_window_ends);
                return (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{item.product.name}</p>
                      <p className="text-xs text-slate-500">
                        {days <= 1 ? "Last day" : `${days} days left`} · until{" "}
                        {formatDate(item.eligibility.return_window_ends)}
                      </p>
                    </div>
                    <Link
                      to={`/returns/new?item=${item.id}`}
                      className="shrink-0 text-sm font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      Return
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
