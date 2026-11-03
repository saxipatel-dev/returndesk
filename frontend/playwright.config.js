import { defineConfig, devices } from "@playwright/test";

// E2E runs against its own database and ports so it never touches dev data.
// The API command resets and reseeds that database on every run.
const API_PORT = 8001;
const WEB_PORT = 5174;
const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL || "postgresql+psycopg://returndesk:returndesk@localhost:5432/returndesk_e2e";
const PYTHON = process.env.E2E_PYTHON || ".venv/bin/python";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: "e2e", testIgnore: /screenshots/, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "screenshots", testMatch: /screenshots/, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    {
      command: `${PYTHON} -m alembic upgrade head && ${PYTHON} -m app.seed --reset && ${PYTHON} -m uvicorn app.main:app --port ${API_PORT}`,
      cwd: "../backend",
      url: `http://localhost:${API_PORT}/health`,
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        UPLOAD_DIR: "/tmp/returndesk-e2e-uploads",
        CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { VITE_PROXY_TARGET: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
