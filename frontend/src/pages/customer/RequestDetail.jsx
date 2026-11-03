import { useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, XCircle } from "lucide-react";
import { returnsApi } from "../../api";
import { errorMessage } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../context/ToastContext";
import { Card, PageHeader } from "../../components/ui/Layout";
import Button from "../../components/ui/Button";
import { StatusBadge, TypeBadge } from "../../components/ui/Badge";
import { CardSkeleton, ErrorState } from "../../components/ui/Feedback";
import { ConfirmDialog } from "../../components/ui/Modal";
import Timeline from "../../components/requests/Timeline";
import CommentsPanel from "../../components/requests/CommentsPanel";
import AttachmentsPanel from "../../components/requests/AttachmentsPanel";
import RequestOverview from "../../components/requests/RequestOverview";
import StatusProgress from "../../components/requests/StatusProgress";
import { formatDateTime } from "../../utils/format";

export default function CustomerRequestDetail() {
  const { id } = useParams();
  const toast = useToast();
  const request = useAsync(() => returnsApi.get(id), [id]);
  const events = useAsync(() => returnsApi.events(id), [id]);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const cancel = async () => {
    setCancelling(true);
    try {
      const updated = await returnsApi.cancel(id);
      request.setData(updated);
      events.reload({ quiet: true });
      toast.success("Your request was cancelled.");
      setConfirmCancel(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setCancelling(false);
    }
  };

  if (request.loading) {
    return (
      <div className="space-y-6">
        <CardSkeleton className="h-24" />
        <CardSkeleton className="h-72" />
      </div>
    );
  }
  if (request.error) {
    return (
      <Card>
        <ErrorState message={request.error} onRetry={request.reload} />
      </Card>
    );
  }

  const r = request.data;
  const canCancel = r.allowed_actions.includes("cancel");

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {r.reference}
            <StatusBadge status={r.status} />
            <TypeBadge type={r.request_type} />
          </span>
        }
        description={`Submitted ${formatDateTime(r.created_at)}`}
        actions={
          canCancel && (
            <Button variant="secondary" icon={XCircle} onClick={() => setConfirmCancel(true)}>
              Cancel request
            </Button>
          )
        }
      >
        <Link to="/returns" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> My requests
        </Link>
      </PageHeader>

      <div className="card mb-6 p-5">
        <StatusProgress request={r} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <RequestOverview request={r} />
          <CommentsPanel requestId={r.id} />
        </div>
        <div className="space-y-6">
          <Card title="Timeline">
            {events.loading ? (
              <CardSkeleton className="h-40 border-0 shadow-none" />
            ) : events.error ? (
              <ErrorState message={events.error} onRetry={events.reload} />
            ) : (
              <Timeline events={events.data} />
            )}
          </Card>
          <AttachmentsPanel
            requestId={r.id}
            canUpload={r.allowed_actions.includes("upload")}
            onUploaded={() => events.reload({ quiet: true })}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this request?"
        confirmLabel="Cancel request"
        variant="danger"
        loading={cancelling}
        onConfirm={cancel}
        onClose={() => setConfirmCancel(false)}
      >
        <p>
          {r.reference} will be closed and the item becomes available to return again while it's still inside the return
          window. This can't be undone.
        </p>
      </ConfirmDialog>
    </>
  );
}
