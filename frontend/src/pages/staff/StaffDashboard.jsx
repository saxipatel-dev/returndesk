import { Link } from "react-router";
import { ArrowRight, Inbox, UserCheck } from "lucide-react";
import { analyticsApi, returnsApi } from "../../api";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../context/AuthContext";
import { Card, PageHeader } from "../../components/ui/Layout";
import { LinkButton } from "../../components/ui/Button";
import { CardSkeleton, EmptyState, ErrorState, TableSkeleton } from "../../components/ui/Feedback";
import RequestsTable from "../../components/requests/RequestsTable";
import { StatusDonut, WorkloadChart } from "../../components/charts/Charts";
import KpiRow from "../../components/charts/KpiRow";

export default function StaffDashboard() {
  const { user } = useAuth();
  const summary = useAsync(() => analyticsApi.summary(), []);
  const trends = useAsync(() => analyticsApi.trends(), []);
  const mine = useAsync(
    () => returnsApi.list({ assigned: "me", open_only: true, sort: "created_at", page_size: 6 }),
    [],
  );
  const unassigned = useAsync(
    () => returnsApi.list({ assigned: "unassigned", status: "pending_review", sort: "created_at", page_size: 5 }),
    [],
  );

  return (
    <>
      <PageHeader
        title={`Good to see you, ${user.name.split(" ")[0]}`}
        description="Your open work and the state of the queue."
        actions={
          <LinkButton to="/staff/queue" icon={Inbox}>
            Open work queue
          </LinkButton>
        }
      />

      {summary.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : summary.error ? (
        <Card>
          <ErrorState message={summary.error} onRetry={summary.reload} />
        </Card>
      ) : (
        <KpiRow summary={summary.data} />
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card
          title="Assigned to me"
          description="Open requests, oldest first."
          className="xl:col-span-2"
          bodyClassName=""
          actions={
            <LinkButton to="/staff/queue?assigned=me" variant="ghost" size="sm">
              See all <ArrowRight className="h-3.5 w-3.5" />
            </LinkButton>
          }
        >
          {mine.loading ? (
            <TableSkeleton rows={4} />
          ) : mine.error ? (
            <ErrorState message={mine.error} onRetry={mine.reload} />
          ) : mine.data.items.length === 0 ? (
            <EmptyState icon={UserCheck} title="Nothing assigned to you">
              Pick up an unassigned request from the queue.
            </EmptyState>
          ) : (
            <RequestsTable items={mine.data.items} linkTo={(r) => `/staff/returns/${r.id}`} showCustomer />
          )}
        </Card>

        <Card
          title="Waiting for pickup"
          description={unassigned.data ? `${unassigned.data.total} unassigned and pending review` : undefined}
          bodyClassName="p-0"
        >
          {unassigned.loading ? (
            <TableSkeleton rows={4} cols={2} />
          ) : unassigned.error ? (
            <ErrorState message={unassigned.error} onRetry={unassigned.reload} />
          ) : unassigned.data.items.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">The queue is clear.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {unassigned.data.items.map((r) => (
                <li key={r.id}>
                  <Link to={`/staff/returns/${r.id}`} className="block px-5 py-3 hover:bg-slate-50">
                    <p className="text-sm font-medium text-indigo-600">{r.reference}</p>
                    <p className="truncate text-sm text-slate-700">{r.product.name}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {trends.loading ? (
          <>
            <CardSkeleton className="h-80" />
            <CardSkeleton className="h-80" />
          </>
        ) : trends.error ? (
          <Card className="lg:col-span-2">
            <ErrorState message={trends.error} onRetry={trends.reload} />
          </Card>
        ) : (
          <>
            <WorkloadChart data={trends.data.workload} unassigned={summary.data?.unassigned_open} />
            <StatusDonut data={trends.data.by_status} />
          </>
        )}
      </div>
    </>
  );
}
