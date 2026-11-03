// Captures the README screenshots from the seeded demo data:
//   npx playwright test --project=screenshots
import { test } from "@playwright/test";
import { signIn, signOut } from "./helpers";

const OUT = "../docs/screenshots";

async function snap(page, name, { full = false } = {}) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200); // let chart animations finish
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
}

test("capture screenshots", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/login");
  await snap(page, "01-login");

  await signIn(page, "customer");
  await snap(page, "02-customer-dashboard");
  await page.goto("/purchases");
  await snap(page, "03-customer-purchases");
  await page.goto("/returns/new");
  await page.getByLabel("Item").selectOption({ index: 1 });
  await page.getByLabel("Reason").selectOption("defective");
  await page.getByLabel("Preferred outcome").selectOption("replacement");
  await page.getByLabel("What happened?").fill("The left earcup crackles at any volume, even after a firmware reset.");
  await snap(page, "04-new-request");
  await page.getByRole("button", { name: "Submit request" }).click();
  await page.waitForURL(/\/returns\/\d+$/);
  await page.getByLabel("Write a message").fill("I still have the original box if that helps.");
  await page.getByRole("button", { name: "Send" }).click();
  await snap(page, "05-customer-request-detail");
  await signOut(page);

  await signIn(page, "employee");
  await snap(page, "06-employee-dashboard", { full: true });
  await page.goto("/staff/queue");
  await snap(page, "07-work-queue");
  await page.locator("tbody tr").first().getByRole("link").click();
  await page.getByRole("button", { name: /Assign to me|Take over/ }).click();
  await page.getByRole("button", { name: "Approve" }).waitFor();
  await snap(page, "08-review-request");
  await page.getByRole("button", { name: "Reject" }).click();
  await snap(page, "09-reject-dialog");
  await page.getByRole("button", { name: "Go back" }).click();
  await signOut(page);

  await signIn(page, "admin");
  await snap(page, "10-admin-analytics", { full: true });
  await page.goto("/admin/products");
  await snap(page, "11-admin-products");
  await page.goto("/admin/users");
  await snap(page, "12-admin-users");
  await page.goto("/admin/settings");
  await snap(page, "13-return-policy");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/analytics");
  await snap(page, "14-mobile-analytics");
});
