import { useState } from "react";
import { authApi } from "../../api";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Card, PageHeader } from "../../components/ui/Layout";
import Button from "../../components/ui/Button";
import { TextInput } from "../../components/ui/Form";
import { ROLES } from "../../utils/labels";
import { formatDate } from "../../utils/format";

export default function Profile() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState({});
  const [savingPw, setSavingPw] = useState(false);

  const saveName = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setNameError("Enter your full name.");
      return;
    }
    setSavingName(true);
    try {
      const updated = await authApi.updateProfile({ name: name.trim() });
      updateUser(updated);
      setNameError("");
      toast.success("Profile updated.");
    } catch (error) {
      setNameError(errorMessage(error));
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!passwords.current) errors.current = "Enter your current password.";
    if (passwords.next.length < 8) errors.next = "Use at least 8 characters.";
    else if (/^[a-zA-Z]+$/.test(passwords.next) || /^\d+$/.test(passwords.next))
      errors.next = "Mix letters with numbers or symbols.";
    if (passwords.confirm !== passwords.next) errors.confirm = "Passwords don't match.";
    setPwErrors(errors);
    if (Object.keys(errors).length) return;
    setSavingPw(true);
    try {
      await authApi.changePassword({ current_password: passwords.current, new_password: passwords.next });
      setPasswords({ current: "", next: "", confirm: "" });
      toast.success("Password changed. Other devices were signed out.");
    } catch (error) {
      setPwErrors({ current: errorMessage(error) });
    } finally {
      setSavingPw(false);
    }
  };

  const setPw = (field) => (e) => setPasswords((p) => ({ ...p, [field]: e.target.value }));

  return (
    <>
      <PageHeader title="Profile" description="Your account details and password." />
      <div className="max-w-2xl space-y-6">
        <Card title="Account">
          <form onSubmit={saveName} noValidate className="space-y-4">
            <TextInput label="Full name" value={name} onChange={(e) => setName(e.target.value)} error={nameError} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Email" value={user.email} disabled hint="Contact support to change your email." />
              <TextInput
                label="Role"
                value={ROLES[user.role]}
                disabled
                hint={`Member since ${formatDate(user.created_at)}`}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={savingName} disabled={name.trim() === user.name}>
                Save
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Change password">
          <form onSubmit={savePassword} noValidate className="space-y-4">
            <TextInput
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={passwords.current}
              onChange={setPw("current")}
              error={pwErrors.current}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                label="New password"
                type="password"
                autoComplete="new-password"
                value={passwords.next}
                onChange={setPw("next")}
                error={pwErrors.next}
              />
              <TextInput
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                value={passwords.confirm}
                onChange={setPw("confirm")}
                error={pwErrors.confirm}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={savingPw}>
                Update password
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
