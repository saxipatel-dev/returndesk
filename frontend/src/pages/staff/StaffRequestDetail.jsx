import { useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, CheckCircle2, Lock, PackageCheck, UserCheck, UserMinus, XCircle } from "lucide-react";
import { returnsApi, staffApi } from "../../api";
import { errorMessage } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Card, PageHeader } from "../../components/ui/Layout";
import Button from "../../components/ui/Button";
import { StatusBadge, TypeBadge } from "../../components/ui/Badge";
import { CardSkeleton, ErrorState } from "../../components/ui/Feedback";
import { ConfirmDialog } from "../../components/ui/Modal";
import { TextArea } from "../../components/ui/Form";
import Timeline from "../../components/requests/Timeline";
import CommentsPanel from "../../components/requests/CommentsPanel";
import AttachmentsPanel from "../../components/requests/AttachmentsPanel";
import RequestOverview from "../../components/requests/RequestOverview";
import { RESOLUTIONS } from "../../utils/labels";
import { formatCurrency, formatDateTime } from "../../utils/format";

const DIALOGS = {
  approve: { title: "Approve this request?", confirm: "Approve", variant: "success" },
  reject: { title: "Reject this request?", confirm: "Reject", variant: "danger" },
  fulfill: { title: "Record fulfillment", confirm: "Mark as fulfilled", variant: "primary" },
  close: { title: "Close this request?", confirm: "Close request", variant: "primary" },
};

function AssignmentCard({ request, onChange }) {
  const { user } = useAuth();
  const toast = useToast();
  const staff = useAsync(() => (user.role === "admin" ? staffApi.staff() : Promise.resolve([])), [user.role]);
  const [saving, setSaving] = useState(false);
  const canAssign = request.allowed_actions.includes("assign");
  const assignee = request.assigned_employee;

  const assign = async (employeeId) => {
    setSaving(true);
    try {
      const updated = await returnsApi.assign(request.id, employeeId);
      onChange(updated);
      toast.success(employeeId ? `Assigned to ${updated.assigned_employee.name}.` : "Returned to the queue.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Assignment">
      <p className="text-sm text-slate-600">
        {assignee ? (
          <>
            Assigned to{" "}
            <span className="font-medium text-slate-900">{assignee.id === user.id ? "you" : assignee.name}</span>
          </>
        ) : (
          "Nobody is working on this yet."
        )}
      </p>
      {canAssign && (
        <div className="mt-4 space-y-3">
          {user.role === "admin" ? (
            <div>
              <label htmlFor="assignee" className="label">
                Assign to
              </label>
              <select
                id="assignee"
                className="input"
                value={assignee?.id ?? ""}
                disabled={saving || staff.loading}
                onChange={(e) => assign(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Unassigned</option>
                {(staff.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.open_requests} open
                  </option>
                ))}
              </select>
            </div>
          ) : assignee?.id === user.id ? (
            <Button
              variant="secondary"
              icon={UserMinus}
              loading={saving}
              onClick={() => assign(null)}
              className="w-full"
            >
              Release back to queue
            </Button>
          ) : (
            <Button icon={UserCheck} loading={saving} onClick={() => assign(user.id)} className="w-full">
              {assignee ? "Take over this request" : "Assign to me"}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

export default function StaffRequestDetail() {
  const { id } = useParams();
  const toast = useToast();
  const request = useAsync(() => returnsApi.get(id), [id]);
  const events = useAsync(() => returnsApi.events(id), [id]);
  const [dialog, setDialog] = useState(null);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [working, setWorking] = useState(false);

  const refresh = (updated) => {
    request.setData(updated);
    events.reload({ quiet: true });
  };

  const openDialog = (kind) => {
    setNote("");
    setNoteError("");
    setDialog(kind);
  };

  const confirm = async () => {
    if (dialog === "reject" && !note.trim()) {
      setNoteError("Explain why, so the customer understands the decision.");
      return;
    }
    setWorking(true);
    try {
      let updated;
      if (dialog === "approve")
        updated = await returnsApi.decide(id, { decision: "approved", reason: note.trim() || null });
      if (dialog === "reject") updated = await returnsApi.decide(id, { decision: "rejected", reason: note.trim() });
      if (dialog === "fulfill") updated = await returnsApi.fulfill(id, note.trim() || null);
      if (dialog === "close") updated = await returnsApi.close(id, note.trim() || null);
      refresh(updated);
      toast.success(`${updated.reference} updated.`);
      setDialog(null);
    } catch (error) {
      toast.error(errorMessage(error));
      // Someone else may have acted first; show the current state.
      request.reload({ quiet: true });
      events.reload({ quiet: true });
    } finally {
      setWorking(false);
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
  const can = (action) => r.allowed_actions.includes(action);
  const total = formatCurrency(Number(r.unit_price) * r.quantity);
  const dialogMeta = dialog ? DIALOGS[dialog] : null;

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
        description={`Submitted by ${r.customer.name} on ${formatDateTime(r.created_at)}`}
      >
        <Link
          to="/staff/queue"
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to queue
        </Link>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {(can("decide") || can("fulfill") || can("close")) && (
            <Card title="Next step" className="border-indigo-200 ring-1 ring-indigo-100">
              {can("decide") && (
                <>
                  <p className="text-sm text-slate-600">
                    Review the evidence and conversation, then record a decision. The customer is notified right away.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="success" icon={CheckCircle2} onClick={() => openDialog("approve")}>
                      Approve
                    </Button>
                    <Button variant="danger" icon={XCircle} onClick={() => openDialog("reject")}>
                      Reject
                    </Button>
                  </div>
                </>
              )}
              {can("fulfill") && (
                <>
                  <p className="text-sm text-slate-600">
                    Approved. Record the {RESOLUTIONS[r.requested_resolution].toLowerCase()} once it's been sent.
                  </p>
                  <Button className="mt-4" icon={PackageCheck} onClick={() => openDialog("fulfill")}>
                    Record fulfillment
                  </Button>
                </>
              )}
              {can("close") && (
                <>
                  <p className="text-sm text-slate-600">Nothing left to do. Close the request to finish it.</p>
                  <Button className="mt-4" icon={Lock} onClick={() => openDialog("close")}>
                    Close request
                  </Button>
                </>
              )}
            </Card>
          )}
          {r.status === "under_review" && !can("decide") && (
            <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              Only the assigned employee (or an admin) can decide on this request.
            </p>
          )}
          <RequestOverview request={r} showCustomer />
          <CommentsPanel requestId={r.id} />
        </div>

        <div className="space-y-6">
          <AssignmentCard request={r} onChange={refresh} />
          <Card title="Activity history">
            {events.loading ? (
              <CardSkeleton className="h-40 border-0 shadow-none" />
            ) : events.error ? (
              <ErrorState message={events.error} onRetry={events.reload} />
            ) : (
              <Timeline events={events.data} showActorRole />
            )}
          </Card>
          <AttachmentsPanel
            requestId={r.id}
            canUpload={can("upload")}
            onUploaded={() => events.reload({ quiet: true })}
          />
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(dialog)}
        title={dialogMeta?.title}
        confirmLabel={dialogMeta?.confirm}
        variant={dialogMeta?.variant}
        loading={working}
        onConfirm={confirm}
        onClose={() => setDialog(null)}
      >
        {dialog === "approve" && (
          <p>
            {r.customer.name} asked for a <strong>{RESOLUTIONS[r.requested_resolution].toLowerCase()}</strong> of{" "}
            {r.quantity} × {r.product.name} ({total}).
          </p>
        )}
        {dialog === "reject" && <p>The customer will see your explanation. Decisions can't be changed afterwards.</p>}
        {dialog === "fulfill" && (
          <p>
            This records a simulated {RESOLUTIONS[r.requested_resolution].toLowerCase()} ({total}). No real payment is
            made.
          </p>
        )}
        {dialog === "close" && <p>The request will be marked as closed and counted in resolution time.</p>}
        <TextArea
          label={dialog === "reject" ? "Reason for rejection" : "Note (optional)"}
          required={dialog === "reject"}
          rows={3}
          maxLength={2000}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setNoteError("");
          }}
          error={noteError}
          placeholder={
            dialog === "reject"
              ? "e.g. The photos show water damage, which the warranty doesn't cover."
              : dialog === "fulfill"
                ? "e.g. Replacement shipped with tracking number 1Z…"
                : ""
          }
        />
      </ConfirmDialog>
    </>
  );
}
