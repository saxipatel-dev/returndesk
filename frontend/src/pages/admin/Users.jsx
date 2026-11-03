import { useState } from "react";
import { Search, UserPlus, Users as UsersIcon } from "lucide-react";
import { staffApi } from "../../api";
import { errorMessage, fieldErrors } from "../../api/client";
import { useAsync, useDebouncedValue } from "../../hooks/useAsync";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Card, PageHeader, Pagination } from "../../components/ui/Layout";
import Button from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Select, TextInput } from "../../components/ui/Form";
import { ConfirmDialog, Modal } from "../../components/ui/Modal";
import { EmptyState, ErrorState, InlineError, TableSkeleton } from "../../components/ui/Feedback";
import { validateRegistration } from "../../utils/validation";
import { ROLES } from "../../utils/labels";
import { formatDate, initials } from "../../utils/format";

const PAGE_SIZE = 20;

function StaffForm({ onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", role: "employee" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const next = validateRegistration(form);
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const user = await staffApi.createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      });
      toast.success(`${user.name} can now sign in.`);
      onCreated(user);
    } catch (error) {
      setErrors(fieldErrors(error));
      setServerError(errorMessage(error));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title="Add staff member"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="staff-form" loading={saving}>
            Create account
          </Button>
        </>
      }
    >
      <form id="staff-form" onSubmit={submit} noValidate className="space-y-4">
        <InlineError>{serverError}</InlineError>
        <TextInput label="Full name" required value={form.name} onChange={update("name")} error={errors.name} />
        <TextInput
          label="Work email"
          type="email"
          required
          value={form.email}
          onChange={update("email")}
          error={errors.email}
        />
        <Select label="Role" value={form.role} onChange={update("role")}>
          <option value="employee">Employee: reviews requests</option>
          <option value="admin">Administrator: full access</option>
        </Select>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label="Temporary password"
            type="password"
            autoComplete="new-password"
            required
            value={form.password}
            onChange={update("password")}
            error={errors.password}
          />
          <TextInput
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            required
            value={form.confirm}
            onChange={update("confirm")}
            error={errors.confirm}
          />
        </div>
        <p className="text-xs text-slate-500">
          Share the temporary password privately. They can change it from their profile.
        </p>
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [role, setRole] = useState("staff");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [busy, setBusy] = useState(false);
  const q = useDebouncedValue(query);

  // "Staff" is a UI grouping: employees and admins fetched together.
  const users = useAsync(
    () =>
      role === "staff"
        ? Promise.all([
            staffApi.users({ role: "employee", q, page_size: 100 }),
            staffApi.users({ role: "admin", q, page_size: 100 }),
          ]).then(([e, a]) => ({ items: [...a.items, ...e.items], total: a.total + e.total, page: 1 }))
        : staffApi.users({ role, q, page, page_size: PAGE_SIZE }),
    [role, q, page],
  );
  const workload = useAsync(() => staffApi.staff(), []);
  const openCount = Object.fromEntries((workload.data ?? []).map((s) => [s.id, s.open_requests]));

  const toggleActive = async () => {
    setBusy(true);
    try {
      const updated = await staffApi.updateUser(toggling.id, { active: !toggling.active });
      toast.success(`${updated.name} is now ${updated.active ? "active" : "deactivated"}.`);
      setToggling(null);
      users.reload({ quiet: true });
      workload.reload({ quiet: true });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Users"
        description="Create staff accounts and turn access on or off."
        actions={
          <Button icon={UserPlus} onClick={() => setAdding(true)}>
            Add staff member
          </Button>
        }
      />

      <Card bodyClassName="">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <div className="inline-flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="User type">
            {[
              ["staff", "Staff"],
              ["customer", "Customers"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={role === value}
                onClick={() => {
                  setRole(value);
                  setPage(1);
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  role === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              className="input pl-9"
              placeholder="Search by name or email"
              aria-label="Search users"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {users.loading && !users.data ? (
          <TableSkeleton />
        ) : users.error ? (
          <ErrorState message={users.error} onRetry={users.reload} />
        ) : users.data.items.length === 0 ? (
          <EmptyState icon={UsersIcon} title="No users found" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Name</th>
                    <th className="th">Role</th>
                    {role === "staff" && <th className="th">Open requests</th>}
                    <th className="th">Status</th>
                    <th className="th">Joined</th>
                    <th className="th">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {users.data.items.map((u) => (
                    <tr key={u.id}>
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                            {initials(u.name)}
                          </span>
                          <div>
                            <p className="font-medium text-slate-900">
                              {u.name}{" "}
                              {u.id === me.id && <span className="text-xs font-normal text-slate-500">(you)</span>}
                            </p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="td">{ROLES[u.role]}</td>
                      {role === "staff" && (
                        <td className="td tabular-nums">{u.active ? (openCount[u.id] ?? 0) : "—"}</td>
                      )}
                      <td className="td">
                        {u.active ? (
                          <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/20">Active</Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-500 ring-slate-300">Deactivated</Badge>
                        )}
                      </td>
                      <td className="td text-slate-500">{formatDate(u.created_at)}</td>
                      <td className="td text-right">
                        {u.id !== me.id && (
                          <Button variant="ghost" size="sm" onClick={() => setToggling(u)}>
                            {u.active ? "Deactivate" : "Reactivate"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {role !== "staff" && (
              <Pagination page={page} pageSize={PAGE_SIZE} total={users.data.total} onChange={setPage} />
            )}
          </>
        )}
      </Card>

      {adding && (
        <StaffForm
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            setRole("staff");
            users.reload({ quiet: true });
            workload.reload({ quiet: true });
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(toggling)}
        title={toggling?.active ? `Deactivate ${toggling?.name}?` : `Reactivate ${toggling?.name}?`}
        confirmLabel={toggling?.active ? "Deactivate" : "Reactivate"}
        variant={toggling?.active ? "danger" : "primary"}
        loading={busy}
        onConfirm={toggleActive}
        onClose={() => setToggling(null)}
      >
        <p>
          {toggling?.active
            ? "They'll be signed out right away and won't be able to sign in. Requests assigned to them stay assigned until you reassign them."
            : "They'll be able to sign in again with their existing password."}
        </p>
        {toggling?.active && openCount[toggling.id] > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
            {toggling.name} has {openCount[toggling.id]} open request(s). Reassign them from the request monitor.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
