import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { errorMessage, fieldErrors } from "../../api/client";
import Button from "../../components/ui/Button";
import { TextInput } from "../../components/ui/Form";
import { InlineError } from "../../components/ui/Feedback";
import AuthShell from "./AuthShell";
import { validateRegistration } from "../../utils/validation";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const next = validateRegistration(form);
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    setServerError("");
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setErrors(fieldErrors(error));
      setServerError(errorMessage(error));
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Customer accounts can submit and track return requests."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <InlineError>{serverError}</InlineError>
        <TextInput
          label="Full name"
          autoComplete="name"
          value={form.name}
          onChange={update("name")}
          error={errors.name}
        />
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
          autoComplete="new-password"
          value={form.password}
          onChange={update("password")}
          error={errors.password}
          hint="At least 8 characters, with a number or symbol."
        />
        <TextInput
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={update("confirm")}
          error={errors.confirm}
        />
        <Button type="submit" className="w-full" size="lg" loading={submitting}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
