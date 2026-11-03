import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../api";
import { setCsrfToken, setUnauthorizedHandler } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((session) => {
    setCsrfToken(session?.csrf_token);
    setUser(session?.user ?? null);
  }, []);

  useEffect(() => {
    // Restore the session from the httpOnly cookie on first load.
    authApi
      .me()
      .then(applySession)
      .catch(() => applySession(null))
      .finally(() => setLoading(false));
    setUnauthorizedHandler(() => applySession(null));
  }, [applySession]);

  const value = useMemo(
    () => ({
      user,
      loading,
      async login(email, password) {
        const session = await authApi.login({ email, password });
        applySession(session);
        return session.user;
      },
      async register(form) {
        const session = await authApi.register(form);
        applySession(session);
        return session.user;
      },
      async logout() {
        try {
          await authApi.logout();
        } finally {
          applySession(null);
        }
      },
      updateUser: (next) => setUser((current) => ({ ...current, ...next })),
    }),
    [user, loading, applySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}

export function homePathFor(user) {
  if (!user) return "/login";
  if (user.role === "admin") return "/admin/analytics";
  if (user.role === "employee") return "/staff";
  return "/dashboard";
}
