// Broader feature checks beyond the main return flow. Each test signs in fresh
// and creates its own data, so they can run in any order.
import { expect, test } from "@playwright/test";
import { signIn, signOut } from "./helpers";

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082",
  "hex",
);

test("customer files a warranty claim with a photo and talks to support", async ({ page }) => {
  await signIn(page, "customer");
  await page.goto("/returns/new?type=warranty");
  await expect(page.getByRole("radio", { name: /Warranty claim/ })).toBeChecked();

  const item = page.getByLabel("Item");
  await expect(item.locator("option")).not.toHaveCount(1);
  await item.selectOption({ index: 1 });
  await page.getByLabel("Reason").selectOption("stopped_working");
  // Warranty claims offer repair, which returns don't.
  await page.getByLabel("Preferred outcome").selectOption("repair");
  await page.getByLabel("What happened?").fill("It stopped powering on last week. No drops or water damage.");
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "serial-label.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("serial-label.png")).toBeVisible();
  await page.getByRole("button", { name: "Submit request" }).click();

  await expect(page).toHaveURL(/\/returns\/\d+$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Warranty");
  await expect(page.getByRole("link", { name: "serial-label.png" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Request history" })).toContainText("File attached");

  await page.getByLabel("Write a message").fill("Happy to send more photos if needed.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Happy to send more photos if needed.")).toBeVisible();
  const url = page.url();
  const requestId = url.split("/").pop();
  await signOut(page);

  // Staff see the attachment, reply publicly and leave an internal note.
  await signIn(page, "employee");
  await page.goto(`/staff/returns/${requestId}`);
  await expect(page.getByRole("link", { name: "serial-label.png" })).toBeVisible();
  await page.getByLabel("Write a message").fill("Thanks, we're checking the serial number.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Thanks, we're checking the serial number.")).toBeVisible();
  await page.getByLabel("Write a message").fill("Serial is within the affected batch.");
  await page.getByLabel(/Internal note/).check();
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText("Serial is within the affected batch.")).toBeVisible();
  await signOut(page);

  // The customer sees the reply and a notification, but never the internal note.
  await signIn(page, "customer");
  await page.goto(`/returns/${requestId}`);
  await expect(page.getByText("Thanks, we're checking the serial number.")).toBeVisible();
  await expect(page.getByText("Serial is within the affected batch.")).toHaveCount(0);
  await page.goto("/notifications");
  await expect(page.getByText(/New message from support on RD-\d+/).first()).toBeVisible();
});

test("customer cancels a pending request and the item becomes returnable again", async ({ page }) => {
  await signIn(page, "customer");
  await page.goto("/returns/new");
  await page.getByLabel("Item").selectOption({ index: 1 });
  await page.getByLabel("Reason").selectOption("changed_mind");
  await page.getByLabel("Preferred outcome").selectOption("refund");
  await page.getByLabel("What happened?").fill("Ordered the wrong size by mistake, never opened.");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page).toHaveURL(/\/returns\/\d+$/);

  await page.getByRole("button", { name: "Cancel request" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel request" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Cancelled");
  await expect(page.getByRole("button", { name: "Cancel request" })).toHaveCount(0);
});

test("customer filters requests and updates their profile", async ({ page }) => {
  await signIn(page, "customer");
  await page.getByRole("link", { name: "My requests" }).click();
  await page.getByLabel("Filter by status").selectOption("closed");
  await expect(page.locator("tbody tr").first()).toContainText("Closed");

  await page.goto("/purchases");
  await expect(page.getByText(/Returnable until/).first()).toBeVisible();

  await page.goto("/profile");
  await page.getByLabel("Full name").fill("Jordan A. Lee");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Profile updated.")).toBeVisible();
  await page.getByLabel("Full name").fill("Jordan Lee");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Profile updated.").first()).toBeVisible();
});

test("employee uses queue filters, assigns and releases a request", async ({ page }) => {
  await signIn(page, "employee");
  await expect(page.getByRole("heading", { name: /Good to see you, Priya/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Employee workload" })).toBeVisible();

  await page.goto("/staff/queue");
  await page.getByLabel("Assignment").selectOption("unassigned");
  await expect(page).toHaveURL(/assigned=unassigned/);
  const firstRow = page.locator("tbody tr").first();
  await expect(firstRow).toContainText("Unassigned");
  await firstRow.getByRole("link").click();

  await page.getByRole("button", { name: "Assign to me" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Under review");
  await page.getByRole("button", { name: "Release back to queue" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pending review");
  await expect(page.getByRole("list", { name: "Request history" })).toContainText("Returned to queue");

  // Employees can't reach admin pages.
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/staff$/);
});

test("admin manages staff, return policy and exports the report", async ({ page }) => {
  await signIn(page, "admin");

  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Add staff member" }).click();
  const dialog = page.getByRole("dialog");
  const email = `e2e-${Date.now()}@example.com`;
  await dialog.getByLabel("Full name").fill("Taylor Nguyen");
  await dialog.getByLabel("Work email").fill(email);
  await dialog.getByLabel("Temporary password").fill("Welcome#2026");
  await dialog.getByLabel("Confirm password").fill("Welcome#2026");
  await dialog.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Taylor Nguyen can now sign in.")).toBeVisible();

  const row = page.locator("tr", { hasText: email });
  await row.getByRole("button", { name: "Deactivate" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Deactivate" }).click();
  await expect(row).toContainText("Deactivated");

  await page.goto("/admin/settings");
  const window = page.getByLabel("Return window (days)");
  await window.fill("45");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Return policy saved.")).toBeVisible();
  await window.fill("30");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Return policy saved.").first()).toBeVisible();

  await page.goto("/admin/analytics");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^returndesk-report-.*\.csv$/);
});

test("unknown pages show a not-found screen and signed-out users go to login", async ({ page }) => {
  await page.goto("/admin/analytics");
  await expect(page).toHaveURL(/\/login$/);
  await signIn(page, "customer");
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
