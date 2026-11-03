import { expect } from "@playwright/test";

export const PASSWORD = "Demo#2026"; // seeded demo password (backend/app/seed.py)

export const ACCOUNTS = {
  customer: "customer@example.com",
  employee: "priya@example.com",
  admin: "admin@example.com",
};

export async function signIn(page, who) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ACCOUNTS[who]);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function signOut(page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
}
