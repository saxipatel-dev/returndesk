import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { homePathFor, useAuth } from "../../context/AuthContext";
import { errorMessage } from "../../api/client";
import Button from "../../components/ui/Button";
import { TextInput } from "../../components/ui/Form";
import { InlineError } from "../../components/ui/Feedback";
import AuthShell from "./AuthShell";

// Seeded demo accounts (see backend/app/seed.py). Only meaningful on a demo database.
const DEMO_ACCOUNTS = [
  { label: "Customer", email: "customer@example.com" },
  { label: "Employee", email: "priya@example.com" },
  { label: "Admin", email: "admin@example.com" },
];
const DEMO_PASSWORD = "Demo#2026";
const SHOW_DEMO = import.meta.env.VITE_SHOW_DEMO_ACCOUNTS !== "false";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.email.trim()) next.email = "Enter your email address.";
    if (!form.password) next.password = "Enter your password.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    setServerError("");
    try {
      const user = await login(form.email.trim(), form.password);
      const from = location.state?.from;
      navigate(from && from !== "/" ? from : homePathFor(user), { replace: true });
    } catch (error) {
      setServerError(errorMessage(error));
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back. Sign in to manage your requests."
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
            Create a customer account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <InlineError>{serverError}</InlineError>
        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={update("email")}
          error={errors.email}
        />
        <TextInput
          label="Password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={update("password")}
          error={errors.password}
        />
        <Button type="submit" className="w-full" size="lg" loading={submitting}>
          Sign in
        </Button>
      </form>

      {SHOW_DEMO && (
        <div className="mt-8 rounded-lg border border-dashed border-slate-300 p-4">
          <p className="text-xs font-medium text-slate-600">Demo accounts</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Fill in a seeded account (password <code className="font-mono">{DEMO_PASSWORD}</code>).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => setForm({ email: account.email, password: DEMO_PASSWORD })}
                className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                {account.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthShell>
  );
}
