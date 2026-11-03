import axios from "axios";

// Relative URLs by default: Vite (dev) and nginx (prod) proxy /api to FastAPI.
// Set VITE_API_URL only when the API is hosted on a different origin.
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

let csrfToken = "";

export function setCsrfToken(token) {
  csrfToken = token || "";
}

http.interceptors.request.use((config) => {
  const method = (config.method || "get").toUpperCase();
  if (csrfToken && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    config.headers["X-CSRF-Token"] = csrfToken;
  }
  return config;
});

let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";
    if (error.response?.status === 401 && !url.includes("/api/auth/")) {
      onUnauthorized();
    }
    return Promise.reject(error);
  },
);

/** Turn any API error into one readable sentence for the UI. */
export function errorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (!error?.response) {
    return error?.message === "Network Error"
      ? "Can't reach the server. Check your connection and try again."
      : fallback;
  }
  const detail = error.response.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    // FastAPI validation errors: [{loc: [..., "field"], msg: "..."}]
    const first = detail[0];
    const field = first.loc?.[first.loc.length - 1];
    const msg = (first.msg || "").replace(/^Value error, /, "");
    return field && typeof field === "string" ? `${humanize(field)}: ${msg}` : msg;
  }
  return fallback;
}

/** Field-level errors from a 422 response, keyed by field name. */
export function fieldErrors(error) {
  const detail = error?.response?.data?.detail;
  if (!Array.isArray(detail)) return {};
  return Object.fromEntries(
    detail
      .filter((d) => d.loc?.length)
      .map((d) => [d.loc[d.loc.length - 1], (d.msg || "").replace(/^Value error, /, "")]),
  );
}

function humanize(field) {
  const text = field.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
