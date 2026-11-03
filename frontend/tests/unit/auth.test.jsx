import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

vi.mock("../../src/api", () => ({
  authApi: { me: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn() },
  notificationsApi: { list: vi.fn().mockResolvedValue({ items: [], unread_count: 0 }) },
  returnsApi: { list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 }) },
  catalogApi: { purchases: vi.fn().mockResolvedValue([]) },
}));

import { authApi } from "../../src/api";
import { AuthProvider } from "../../src/context/AuthContext";
import { ToastProvider } from "../../src/context/ToastContext";
import App from "../../src/App";

function renderApp(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

const unauthorized = Object.assign(new Error("401"), { response: { status: 401, data: { detail: "Please sign in" } } });

describe("authentication flow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends signed-out visitors to the login page", async () => {
    authApi.me.mockRejectedValue(unauthorized);
    renderApp("/returns");
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("validates the login form before calling the API", async () => {
    authApi.me.mockRejectedValue(unauthorized);
    renderApp("/login");
    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it("shows the server's error when sign-in fails", async () => {
    authApi.me.mockRejectedValue(unauthorized);
    authApi.login.mockRejectedValue({ response: { status: 401, data: { detail: "Email or password is incorrect." } } });
    renderApp("/login");
    await userEvent.type(await screen.findByLabelText("Email"), "someone@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-pass1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
  });

  it("signs a customer in and lands on their dashboard", async () => {
    authApi.me.mockRejectedValue(unauthorized);
    authApi.login.mockResolvedValue({
      csrf_token: "token",
      user: { id: 1, name: "Jordan Lee", email: "customer@example.com", role: "customer", created_at: "2026-01-01" },
    });
    renderApp("/login");
    await userEvent.type(await screen.findByLabelText("Email"), "customer@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "Demo#2026");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: "Hi, Jordan" })).toBeInTheDocument();
  });

  it("keeps customers out of staff pages", async () => {
    authApi.me.mockResolvedValue({
      csrf_token: "token",
      user: { id: 1, name: "Jordan Lee", email: "customer@example.com", role: "customer", created_at: "2026-01-01" },
    });
    renderApp("/admin/analytics");
    expect(await screen.findByRole("heading", { name: "Hi, Jordan" })).toBeInTheDocument();
    expect(screen.queryByText("Analytics")).not.toBeInTheDocument();
  });

  it("checks registration fields on the client", async () => {
    authApi.me.mockRejectedValue(unauthorized);
    renderApp("/register");
    await userEvent.type(await screen.findByLabelText("Full name"), "Sam");
    await userEvent.type(screen.getByLabelText("Email"), "sam@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.type(screen.getByLabelText("Confirm password"), "password");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByText("Mix letters with numbers or symbols.")).toBeInTheDocument();
    expect(authApi.register).not.toHaveBeenCalled();
  });
});
