import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Paperclip, ShieldCheck, Undo2, X } from "lucide-react";
import { catalogApi, returnsApi, staffApi } from "../../api";
import { errorMessage, fieldErrors } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../context/ToastContext";
import { Card, PageHeader } from "../../components/ui/Layout";
import Button, { LinkButton } from "../../components/ui/Button";
import { Select, TextArea, TextInput } from "../../components/ui/Form";
import { CardSkeleton, EmptyState, ErrorState, InlineError } from "../../components/ui/Feedback";
import { ACCEPTED_FILES, checkFile, validateRequest } from "../../utils/validation";
import { REASONS, RESOLUTIONS, RESOLUTIONS_BY_TYPE, RETURN_REASONS, WARRANTY_REASONS } from "../../utils/labels";
import { formatBytes, formatDate } from "../../utils/format";

const MAX_FILES = 3;

function TypeOption({ value, current, onChange, icon: Icon, title, text }) {
  const active = value === current;
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
        active ? "border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <input
        type="radio"
        name="request_type"
        value={value}
        checked={active}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      <Icon className={`h-5 w-5 shrink-0 ${active ? "text-indigo-600" : "text-slate-400"}`} aria-hidden="true" />
      <span>
        <span className="block text-sm font-medium text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{text}</span>
      </span>
    </label>
  );
}

export default function NewRequest() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const purchases = useAsync(() => catalogApi.purchases(), []);
  const settings = useAsync(() => staffApi.settings(), []);

  const [type, setType] = useState(params.get("type") === "warranty" ? "warranty" : "return");
  const [form, setForm] = useState({
    purchase_item_id: params.get("item") ?? "",
    quantity: "1",
    reason: "",
    requested_resolution: "",
    description: "",
  });
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const eligibleItems = useMemo(() => {
    const key = type === "return" ? "can_return" : "can_claim_warranty";
    return (purchases.data ?? []).flatMap((p) =>
      p.items.filter((i) => i.eligibility[key]).map((i) => ({ ...i, order: p })),
    );
  }, [purchases.data, type]);

  const item = eligibleItems.find((i) => String(i.id) === String(form.purchase_item_id));
  const maxQty = item
    ? type === "return"
      ? item.eligibility.returnable_quantity
      : item.eligibility.warranty_claimable_quantity
    : 1;

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const changeType = (next) => {
    setType(next);
    setForm((f) => ({ ...f, reason: "", requested_resolution: "", quantity: "1" }));
    setErrors({});
  };

  const addFiles = (e) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const file of picked) {
      const problem = checkFile(file);
      if (problem) {
        toast.error(`${file.name}: ${problem}`);
        return;
      }
    }
    setFiles((current) => [...current, ...picked].slice(0, MAX_FILES));
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = validateRequest(form, item, type);
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    setServerError("");
    try {
      const created = await returnsApi.create({
        purchase_item_id: Number(form.purchase_item_id),
        request_type: type,
        quantity: Number(form.quantity),
        reason: form.reason,
        requested_resolution: form.requested_resolution,
        description: form.description.trim(),
      });
      // The request exists now; upload evidence one file at a time.
      const failed = [];
      for (const file of files) {
        await returnsApi.upload(created.id, file).catch(() => failed.push(file.name));
      }
      if (failed.length) toast.error(`Request created, but these files didn't upload: ${failed.join(", ")}`);
      else toast.success(`Request ${created.reference} submitted.`);
      navigate(`/returns/${created.id}`);
    } catch (error) {
      setErrors(fieldErrors(error));
      setServerError(errorMessage(error));
      setSubmitting(false);
    }
  };

  const reasons = type === "return" ? RETURN_REASONS : WARRANTY_REASONS;
  const windowDays = settings.data?.return_window_days;

  return (
    <>
      <PageHeader title="New request" description="Tell us what went wrong and how you'd like us to fix it.">
        <Link to="/returns" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Back to my requests
        </Link>
      </PageHeader>

      {purchases.loading ? (
        <CardSkeleton className="h-96" />
      ) : purchases.error ? (
        <Card>
          <ErrorState message={purchases.error} onRetry={purchases.reload} />
        </Card>
      ) : (
        <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card title="What kind of request is this?">
              <fieldset>
                <legend className="sr-only">Request type</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TypeOption
                    value="return"
                    current={type}
                    onChange={changeType}
                    icon={Undo2}
                    title="Return"
                    text={windowDays ? `Within ${windowDays} days of purchase` : "Within the return window"}
                  />
                  <TypeOption
                    value="warranty"
                    current={type}
                    onChange={changeType}
                    icon={ShieldCheck}
                    title="Warranty claim"
                    text="Product failed during its warranty period"
                  />
                </div>
              </fieldset>
            </Card>

            <Card title="Item and details">
              {eligibleItems.length === 0 ? (
                <EmptyState
                  title={type === "return" ? "No items are eligible for return" : "No items are under warranty"}
                  action={
                    <LinkButton to="/purchases" variant="secondary" size="sm">
                      View purchases
                    </LinkButton>
                  }
                >
                  {type === "return"
                    ? "Items can be returned within the return window, as long as they don't already have a return."
                    : "Warranty claims are possible while a product's warranty is active."}
                </EmptyState>
              ) : (
                <div className="space-y-5">
                  <InlineError>{serverError}</InlineError>
                  <Select
                    label="Item"
                    required
                    value={form.purchase_item_id}
                    onChange={(e) => {
                      update("purchase_item_id")(e);
                      setForm((f) => ({ ...f, quantity: "1" }));
                    }}
                    error={errors.purchase_item_id}
                  >
                    <option value="">Choose an item…</option>
                    {eligibleItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.product.name} — {i.order.order_number} ({formatDate(i.order.purchased_at)})
                      </option>
                    ))}
                  </Select>

                  <div className="grid gap-5 sm:grid-cols-3">
                    <TextInput
                      label="Quantity"
                      type="number"
                      min={1}
                      max={maxQty}
                      required
                      value={form.quantity}
                      onChange={update("quantity")}
                      error={errors.quantity}
                      hint={item ? `Up to ${maxQty}` : undefined}
                    />
                    <Select
                      label="Reason"
                      required
                      value={form.reason}
                      onChange={update("reason")}
                      error={errors.reason}
                    >
                      <option value="">Choose…</option>
                      {reasons.map((r) => (
                        <option key={r} value={r}>
                          {REASONS[r]}
                        </option>
                      ))}
                    </Select>
                    <Select
                      label="Preferred outcome"
                      required
                      value={form.requested_resolution}
                      onChange={update("requested_resolution")}
                      error={errors.requested_resolution}
                    >
                      <option value="">Choose…</option>
                      {RESOLUTIONS_BY_TYPE[type].map((r) => (
                        <option key={r} value={r}>
                          {RESOLUTIONS[r]}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <TextArea
                    label="What happened?"
                    required
                    rows={5}
                    maxLength={2000}
                    placeholder="Describe the problem. For example: when it started, what you've tried, and the condition of the item."
                    value={form.description}
                    onChange={update("description")}
                    error={errors.description}
                    hint={`${form.description.trim().length}/2000`}
                  />
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Photos or receipt" description="Optional, but it helps us decide faster.">
              <label className="flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-center hover:border-indigo-400">
                <Paperclip className="h-6 w-6 text-slate-400" aria-hidden="true" />
                <span className="mt-2 text-sm font-medium text-indigo-600">Choose files</span>
                <span className="text-xs text-slate-500">JPG, PNG, WEBP or PDF · up to 5 MB · max {MAX_FILES}</span>
                <input
                  type="file"
                  multiple
                  accept={ACCEPTED_FILES}
                  className="sr-only"
                  onChange={addFiles}
                  disabled={files.length >= MAX_FILES}
                />
              </label>
              {files.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {files.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      <span className="text-xs text-slate-500">{formatBytes(file.size)}</span>
                      <button
                        type="button"
                        onClick={() => setFiles((list) => list.filter((_, i) => i !== index))}
                        className="text-slate-400 hover:text-slate-600"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <p className="text-sm text-slate-600">
                We'll review your request and keep you posted here. Approved refunds and replacements are recorded as
                simulated fulfillments in this demo; no real money moves.
              </p>
              <Button
                type="submit"
                className="mt-4 w-full"
                size="lg"
                loading={submitting}
                disabled={!eligibleItems.length}
              >
                Submit request
              </Button>
            </Card>
          </div>
        </form>
      )}
    </>
  );
}
