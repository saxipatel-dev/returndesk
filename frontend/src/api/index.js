import { http } from "./client";

const data = (promise) => promise.then((res) => res.data);

// Drop empty filter values so they don't end up as "?status=" in the URL.
const clean = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v !== null && v !== undefined));

export const authApi = {
  me: () => data(http.get("/api/auth/me")),
  login: (body) => data(http.post("/api/auth/login", body)),
  register: (body) => data(http.post("/api/auth/register", body)),
  logout: () => http.post("/api/auth/logout"),
  updateProfile: (body) => data(http.patch("/api/auth/me", body)),
  changePassword: (body) => http.post("/api/auth/password", body),
};

export const catalogApi = {
  products: (params) => data(http.get("/api/products", { params: clean(params) })),
  categories: () => data(http.get("/api/products/categories")),
  createProduct: (body) => data(http.post("/api/products", body)),
  updateProduct: (id, body) => data(http.patch(`/api/products/${id}`, body)),
  purchases: (params) => data(http.get("/api/purchases", { params: clean(params) })),
  purchase: (id) => data(http.get(`/api/purchases/${id}`)),
};

export const returnsApi = {
  list: (params) => data(http.get("/api/returns", { params: clean(params) })),
  get: (id) => data(http.get(`/api/returns/${id}`)),
  create: (body) => data(http.post("/api/returns", body)),
  assign: (id, employeeId) => data(http.post(`/api/returns/${id}/assign`, { employee_id: employeeId })),
  decide: (id, body) => data(http.post(`/api/returns/${id}/decision`, body)),
  fulfill: (id, note) => data(http.post(`/api/returns/${id}/fulfill`, { note })),
  close: (id, note) => data(http.post(`/api/returns/${id}/close`, { note })),
  cancel: (id, note) => data(http.post(`/api/returns/${id}/cancel`, { note })),
  events: (id) => data(http.get(`/api/returns/${id}/events`)),
  comments: (id) => data(http.get(`/api/returns/${id}/comments`)),
  addComment: (id, body) => data(http.post(`/api/returns/${id}/comments`, body)),
  attachments: (id) => data(http.get(`/api/returns/${id}/attachments`)),
  upload: (id, file) => {
    const form = new FormData();
    form.append("file", file);
    return data(
      http.post(`/api/returns/${id}/attachments`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    );
  },
  attachmentUrl: (attachmentId) => `${import.meta.env.VITE_API_URL || ""}/api/attachments/${attachmentId}`,
};

export const staffApi = {
  staff: () => data(http.get("/api/staff")),
  users: (params) => data(http.get("/api/users", { params: clean(params) })),
  createUser: (body) => data(http.post("/api/users", body)),
  updateUser: (id, body) => data(http.patch(`/api/users/${id}`, body)),
  settings: () => data(http.get("/api/settings")),
  updateSettings: (body) => data(http.patch("/api/settings", body)),
};

export const analyticsApi = {
  summary: (params) => data(http.get("/api/analytics/summary", { params: clean(params) })),
  trends: (params) => data(http.get("/api/analytics/trends", { params: clean(params) })),
  exportCsv: (params) => http.get("/api/analytics/export.csv", { params: clean(params), responseType: "blob" }),
};

export const notificationsApi = {
  list: (params) => data(http.get("/api/notifications", { params: clean(params) })),
  markRead: (id, read = true) => data(http.patch(`/api/notifications/${id}`, { read })),
  markAllRead: () => http.post("/api/notifications/read-all"),
};
