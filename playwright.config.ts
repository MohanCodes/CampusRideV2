import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL },
  // Phone and desktop widths, each in Light and Dark (BUILD.md Section 14).
  projects: [
    { name: "phone-light", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 780 }, colorScheme: "light" } },
    { name: "phone-dark", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 780 }, colorScheme: "dark" } },
    { name: "desktop-light", use: { viewport: { width: 1280, height: 800 }, colorScheme: "light" } },
    { name: "desktop-dark", use: { viewport: { width: 1280, height: 800 }, colorScheme: "dark" } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npx next start -p ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
