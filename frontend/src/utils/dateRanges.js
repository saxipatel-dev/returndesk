import { isoDate } from "./format";

export const RANGES = [
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom range" },
];

/** Translate a preset into date_from/date_to (UTC days, inclusive). */
export function rangeToDates(range, custom = {}) {
  if (range === "custom") return { date_from: custom.from || undefined, date_to: custom.to || undefined };
  if (range === "all") return {};
  const to = new Date();
  const from = new Date();
  if (range === "365") {
    // Start at the first of the month 11 months ago so every month bar is complete.
    from.setUTCMonth(from.getUTCMonth() - 11, 1);
  } else {
    from.setUTCDate(from.getUTCDate() - Number(range) + 1);
  }
  return { date_from: isoDate(from), date_to: isoDate(to) };
}
