const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const currencyFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const monthFormat = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });

export const formatDate = (value) => (value ? dateFormat.format(new Date(value)) : "—");
export const formatDateTime = (value) => (value ? dateTimeFormat.format(new Date(value)) : "—");
export const formatCurrency = (value) => currencyFormat.format(Number(value || 0));

/** "2026-03" -> "Mar 26" */
export function formatMonth(month) {
  const [year, m] = month.split("-").map(Number);
  return monthFormat.format(new Date(Date.UTC(year, m - 1, 1)));
}

export function timeAgo(value) {
  if (!value) return "";
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return formatDate(value);
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function daysUntil(value) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

/** YYYY-MM-DD in UTC, which is how the API interprets date filters. */
export function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

/** Percentages and averages can be undefined (nothing to divide by): show N/A, never 0. */
export function formatRate(rate) {
  return rate === null || rate === undefined ? "N/A" : `${rate}%`;
}

export function formatDays(days) {
  return days === null || days === undefined ? "N/A" : `${days} days`;
}

/** Where a user should go to see a request, depending on their portal. */
export function requestPath(user, requestId) {
  return user?.role === "customer" ? `/returns/${requestId}` : `/staff/returns/${requestId}`;
}
