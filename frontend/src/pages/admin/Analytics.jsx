import { useState } from "react";
import { Download } from "lucide-react";
import { analyticsApi } from "../../api";
import { errorMessage } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../context/ToastContext";
import { Card, PageHeader } from "../../components/ui/Layout";
import KpiRow from "../../components/charts/KpiRow";
import Button from "../../components/ui/Button";
import { CardSkeleton, ErrorState } from "../../components/ui/Feedback";
import AnalyticsFilters from "../../components/charts/AnalyticsFilters";
import { rangeToDates } from "../../utils/dateRanges";
import {
  CategoryChart,
  DecisionsChart,
  MonthlyRequestsChart,
  ReasonsChart,
  ResolutionChart,
  StatusDonut,
  WorkloadChart,
} from "../../components/charts/Charts";

export default function Analytics() {
  const toast = useToast();
  const [filters, setFilters] = useState({ range: "365", from: "", to: "", status: "", type: "" });
  const [exporting, setExporting] = useState(false);

  const params = {
    ...rangeToDates(filters.range, { from: filters.from, to: filters.to }),
    status: filters.status,
    request_type: filters.type,
  };
  const key = JSON.stringify(params);
  const summary = useAsync(() => analyticsApi.summary(params), [key]);
  const trends = useAsync(() => analyticsApi.trends(params), [key]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await analyticsApi.exportCsv(params);
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `returndesk-report-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(errorMessage(error, "The report couldn't be downloaded."));
    } finally {
      setExporting(false);
    }
  };

  const loading = summary.loading || trends.loading;
  const error = summary.error || trends.error;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Return and warranty activity, calculated live from the database."
        actions={
          <Button variant="secondary" icon={Download} loading={exporting} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />

      <AnalyticsFilters filters={filters} onChange={setFilters} />

      {error ? (
        <Card>
          <ErrorState
            message={error}
            onRetry={() => {
              summary.reload();
              trends.reload();
            }}
          />
        </Card>
      ) : loading && !(summary.data && trends.data) ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} className="h-80" />
            ))}
          </div>
        </>
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loading}>
          <KpiRow summary={summary.data} />
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <MonthlyRequestsChart data={trends.data.monthly_requests} />
            <StatusDonut data={trends.data.by_status} />
            <CategoryChart data={trends.data.by_category} />
            <ReasonsChart data={trends.data.by_reason} />
            <ResolutionChart data={trends.data.resolution_time} />
            <DecisionsChart data={trends.data.decisions} />
            <WorkloadChart
              data={trends.data.workload}
              unassigned={summary.data.unassigned_open}
              className="lg:col-span-2"
            />
          </div>
        </div>
      )}
    </>
  );
}
