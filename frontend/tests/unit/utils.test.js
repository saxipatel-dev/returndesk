import { describe, expect, it } from "vitest";
import {
  checkFile,
  validateProduct,
  validateRegistration,
  validateRequest,
  validateSettings,
} from "../../src/utils/validation";
import { formatDays, formatMonth, formatRate, requestPath } from "../../src/utils/format";
import { errorMessage, fieldErrors } from "../../src/api/client";
import { rangeToDates } from "../../src/utils/dateRanges";

describe("validateRegistration", () => {
  const valid = { name: "Jordan Lee", email: "jordan@example.com", password: "abc12345", confirm: "abc12345" };

  it("accepts a complete form", () => {
    expect(validateRegistration(valid)).toEqual({});
  });

  it("flags short, letters-only and mismatched passwords", () => {
    expect(validateRegistration({ ...valid, password: "a1", confirm: "a1" }).password).toMatch(/8 characters/);
    expect(validateRegistration({ ...valid, password: "abcdefgh", confirm: "abcdefgh" }).password).toMatch(/Mix/);
    expect(validateRegistration({ ...valid, confirm: "different1" }).confirm).toMatch(/don't match/);
  });

  it("requires a name and a plausible email", () => {
    const errors = validateRegistration({ ...valid, name: " ", email: "nope" });
    expect(errors.name).toBeDefined();
    expect(errors.email).toBeDefined();
  });
});

describe("validateRequest", () => {
  const item = { eligibility: { returnable_quantity: 2, warranty_claimable_quantity: 1 } };
  const form = { quantity: "1", reason: "defective", requested_resolution: "refund", description: "Broken screen on arrival." };

  it("passes a valid return", () => {
    expect(validateRequest(form, item, "return")).toEqual({});
  });

  it("blocks quantities above what's still returnable", () => {
    expect(validateRequest({ ...form, quantity: "3" }, item, "return").quantity).toMatch(/at most 2/);
    expect(validateRequest({ ...form, quantity: "2" }, item, "warranty").quantity).toMatch(/at most 1/);
  });

  it("rejects zero, decimals and missing fields", () => {
    expect(validateRequest({ ...form, quantity: "0" }, item, "return").quantity).toBeDefined();
    expect(validateRequest({ ...form, quantity: "1.5" }, item, "return").quantity).toBeDefined();
    const errors = validateRequest({ quantity: "1", reason: "", requested_resolution: "", description: "short" }, null, "return");
    expect(Object.keys(errors).sort()).toEqual(["description", "purchase_item_id", "reason", "requested_resolution"]);
  });
});

describe("other validators", () => {
  it("validates products", () => {
    const product = { sku: "AB-1", name: "Lamp", category: "Home", price: "19.99", warranty_days: "365", description: "" };
    expect(validateProduct(product, true)).toEqual({});
    expect(validateProduct({ ...product, price: "-1" }, true).price).toBeDefined();
    expect(validateProduct({ ...product, price: "1.999" }, true).price).toMatch(/two decimals/);
    expect(validateProduct({ ...product, sku: "has space" }, true).sku).toBeDefined();
    // SKU isn't editable on existing products, so it isn't checked.
    expect(validateProduct({ ...product, sku: "" }, false)).toEqual({});
  });

  it("validates store settings", () => {
    const settings = {
      store_name: "Demo",
      support_email: "help@example.com",
      return_window_days: "30",
      max_attachments_per_request: "5",
    };
    expect(validateSettings(settings)).toEqual({});
    expect(validateSettings({ ...settings, return_window_days: "0" }).return_window_days).toBeDefined();
  });

  it("checks file type and size before upload", () => {
    expect(checkFile({ name: "receipt.PDF", size: 1000 })).toBeNull();
    expect(checkFile({ name: "virus.exe", size: 10 })).toMatch(/Only JPG/);
    expect(checkFile({ name: "huge.png", size: 6 * 1024 * 1024 })).toMatch(/5 MB/);
  });
});

describe("formatting", () => {
  it("shows N/A instead of a misleading zero", () => {
    expect(formatRate(null)).toBe("N/A");
    expect(formatRate(0)).toBe("0%");
    expect(formatDays(undefined)).toBe("N/A");
    expect(formatDays(4.5)).toBe("4.5 days");
  });

  it("formats chart months", () => {
    expect(formatMonth("2026-03")).toBe("Mar 26");
  });

  it("routes requests to the right portal", () => {
    expect(requestPath({ role: "customer" }, 7)).toBe("/returns/7");
    expect(requestPath({ role: "employee" }, 7)).toBe("/staff/returns/7");
  });

  it("builds date ranges", () => {
    expect(rangeToDates("all")).toEqual({});
    expect(rangeToDates("custom", { from: "2026-01-01", to: "" })).toEqual({ date_from: "2026-01-01", date_to: undefined });
    const { date_from, date_to } = rangeToDates("30");
    expect((new Date(date_to) - new Date(date_from)) / 86400000).toBe(29);
  });
});

describe("API error messages", () => {
  it("uses the server's message when there is one", () => {
    expect(errorMessage({ response: { data: { detail: "Request not found." } } })).toBe("Request not found.");
  });

  it("summarises validation errors", () => {
    const error = {
      response: { data: { detail: [{ loc: ["body", "quantity"], msg: "Input should be greater than 0" }] } },
    };
    expect(errorMessage(error)).toBe("Quantity: Input should be greater than 0");
    expect(fieldErrors(error)).toEqual({ quantity: "Input should be greater than 0" });
  });

  it("explains network failures", () => {
    expect(errorMessage({ message: "Network Error" })).toMatch(/Can't reach the server/);
  });
});
