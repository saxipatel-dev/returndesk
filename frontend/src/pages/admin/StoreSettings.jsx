import { useState } from "react";
import { Save } from "lucide-react";
import { staffApi } from "../../api";
import { errorMessage, fieldErrors } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../context/ToastContext";
import { Card, PageHeader } from "../../components/ui/Layout";
import Button from "../../components/ui/Button";
import { TextInput } from "../../components/ui/Form";
import { CardSkeleton, ErrorState } from "../../components/ui/Feedback";
import { formatDateTime } from "../../utils/format";
import { validateSettings } from "../../utils/validation";

function SettingsForm({ initial, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    ...initial,
    return_window_days: String(initial.return_window_days),
    max_attachments_per_request: String(initial.max_attachments_per_request),
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const next = validateSettings(form);
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const saved = await staffApi.updateSettings({
        store_name: form.store_name.trim(),
        support_email: form.support_email.trim(),
        return_window_days: Number(form.return_window_days),
        allow_customer_cancellation: form.allow_customer_cancellation,
        max_attachments_per_request: Number(form.max_attachments_per_request),
      });
      onSaved(saved);
      toast.success("Return policy saved.");
    } catch (error) {
      setErrors(fieldErrors(error));
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="max-w-3xl space-y-6">
      <Card title="Policy" description="Changes apply to new requests only. Existing requests keep their status.">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextInput
            label="Return window (days)"
            type="number"
            min={1}
            max={365}
            required
            value={form.return_window_days}
            onChange={update("return_window_days")}
            error={errors.return_window_days}
            hint="Counted from the purchase date. Warranty periods are set per product."
          />
          <TextInput
            label="Max files per request"
            type="number"
            min={0}
            max={20}
            required
            value={form.max_attachments_per_request}
            onChange={update("max_attachments_per_request")}
            error={errors.max_attachments_per_request}
          />
        </div>
        <label className="mt-5 flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
            checked={form.allow_customer_cancellation}
            onChange={(e) => setForm((f) => ({ ...f, allow_customer_cancellation: e.target.checked }))}
          />
          <span>
            <span className="block text-sm font-medium text-slate-800">Let customers cancel their own requests</span>
            <span className="block text-sm text-slate-500">Only possible before a decision is made.</span>
          </span>
        </label>
      </Card>

      <Card title="Store details">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextInput
            label="Store name"
            required
            value={form.store_name}
            onChange={update("store_name")}
            error={errors.store_name}
          />
          <TextInput
            label="Support email"
            type="email"
            required
            value={form.support_email}
            onChange={update("support_email")}
            error={errors.support_email}
          />
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Last updated {formatDateTime(initial.updated_at)}</p>
        <Button type="submit" icon={Save} loading={saving}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

export default function StoreSettings() {
  const settings = useAsync(() => staffApi.settings(), []);

  return (
    <>
      <PageHeader title="Return policy" description="Rules applied when customers submit new requests." />
      {settings.error ? (
        <Card>
          <ErrorState message={settings.error} onRetry={settings.reload} />
        </Card>
      ) : settings.loading ? (
        <CardSkeleton className="h-96" />
      ) : (
        <SettingsForm key={settings.data.updated_at} initial={settings.data} onSaved={settings.setData} />
      )}
    </>
  );
}
