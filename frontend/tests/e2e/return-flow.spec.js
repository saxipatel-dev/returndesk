import { expect, test } from "@playwright/test";
import { signIn, signOut } from "./helpers";

test("customer submits a return, employee approves it, customer sees the result", async ({ page }) => {
  // 1. Customer submits a return for an eligible item.
  await signIn(page, "customer");
  await expect(page.getByRole("heading", { name: "Hi, Jordan" })).toBeVisible();
  await page.getByRole("link", { name: "New request" }).first().click();

  const item = page.getByLabel("Item");
  await expect(item.locator("option")).not.toHaveCount(1);
  await item.selectOption({ index: 1 });
  await page.getByLabel("Quantity").fill("1");
  await page.getByLabel("Reason").selectOption("damaged_in_transit");
  await page.getByLabel("Preferred outcome").selectOption("refund");
  await page.getByLabel("What happened?").fill("The box was crushed and the case is cracked on one side.");
  await page.getByRole("button", { name: "Submit request" }).click();

  await expect(page).toHaveURL(/\/returns\/\d+$/);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toContainText("Pending review");
  const reference = (await heading.textContent()).match(/RD-\d+/)[0];
  await expect(page.getByRole("list", { name: "Request history" })).toContainText("Request submitted");
  await signOut(page);

  // 2. Employee finds it in the queue, takes it and approves it.
  await signIn(page, "employee");
  await page.getByRole("link", { name: "Work queue" }).click();
  await page.getByLabel("Search requests").fill(reference);
  await page.getByRole("link", { name: reference }).click();
  await page.getByRole("button", { name: "Assign to me" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Under review");

  await page.getByRole("button", { name: "Approve" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Approve this request?");
  await dialog.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Approved");

  await page.getByRole("button", { name: "Record fulfillment" }).click();
  await page.getByRole("dialog").getByLabel("Note (optional)").fill("Refund recorded for the cracked speaker.");
  await page.getByRole("dialog").getByRole("button", { name: "Mark as fulfilled" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Fulfilled");
  await signOut(page);

  // 3. Customer sees the new status, the history and a notification.
  await signIn(page, "customer");
  await page.getByRole("link", { name: "My requests" }).click();
  await page.getByRole("link", { name: reference }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Fulfilled");
  const history = page.getByRole("list", { name: "Request history" });
  await expect(history).toContainText("Request approved");
  await expect(history).toContainText("Refund recorded for the cracked speaker.");

  await page.getByRole("button", { name: /Notifications, \d+ unread/ }).click();
  await expect(page.getByText(`Your request ${reference} is now fulfilled.`)).toBeVisible();
});

test("rejecting requires an explanation", async ({ page }) => {
  await signIn(page, "admin");
  await page.goto("/staff/queue?status=pending_review");
  await page.locator("tbody tr").first().getByRole("link").click();
  const assignee = page.getByLabel("Assign to");
  const priya = await assignee.locator("option", { hasText: "Priya Raman" }).getAttribute("value");
  await assignee.selectOption(priya);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Under review");

  await page.getByRole("button", { name: "Reject" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Reject" }).click();
  await expect(dialog.getByText("Explain why, so the customer understands the decision.")).toBeVisible();
  await dialog.getByLabel(/Reason for rejection/).fill("The photos show water damage, which isn't covered.");
  await dialog.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Rejected");
});

test("customers can't open staff or admin pages", async ({ page }) => {
  await signIn(page, "customer");
  await page.goto("/staff/queue");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/admin/products");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("admin dashboard shows KPIs and all seven charts", async ({ page }) => {
  await signIn(page, "admin");
  await expect(page).toHaveURL(/\/admin\/analytics$/);
  for (const label of ["Total requests", "Pending review", "Approval rate", "Avg. resolution time"]) {
    await expect(page.locator("p", { hasText: new RegExp(`^${label.replace(".", "\\.")}$`) })).toBeVisible();
  }
  for (const title of [
    "Monthly return requests",
    "Returns by product category",
    "Request status distribution",
    "Most common return reasons",
    "Average resolution time",
    "Employee workload",
    "Approval vs. rejection trends",
  ]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
  await expect(page.locator(".recharts-surface").first()).toBeVisible();

  // A status filter with no matches shows empty states rather than broken charts.
  await page.getByLabel("Date range").selectOption("30");
  await page.getByLabel("Status").selectOption("cancelled");
  await page.getByLabel("Type").selectOption("warranty");
  await expect(page.getByText("No data for the selected filters.").first()).toBeVisible();
});

test("admin can add and archive a product", async ({ page }) => {
  await signIn(page, "admin");
  await page.getByRole("link", { name: "Products" }).click();
  await page.getByRole("button", { name: "Add product" }).click();
  const dialog = page.getByRole("dialog");
  const sku = `E2E-${Date.now().toString().slice(-6)}`;
  await dialog.getByLabel("SKU").fill(sku);
  await dialog.getByLabel("Category").fill("Office");
  await dialog.getByLabel("Name").fill("Cable Management Tray");
  await dialog.getByLabel("Price (USD)").fill("18.50");
  await dialog.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByText("Cable Management Tray added.")).toBeVisible();

  await page.getByRole("button", { name: "Archive Cable Management Tray" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Archive" }).click();
  await expect(page.getByText("Cable Management Tray archived.")).toBeVisible();
});
