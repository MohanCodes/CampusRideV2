import { defineConfig, devices } from "@playwright/test";

// Two copies of the app run side by side (see scripts/e2e-servers.mjs).
const APP = "http://localhost:3100"; // normal app, no backend: landing page and sign-in
const DEMO = "http://localhost:3101"; // demo mode: sample data and a pinned clock

const looks = [
  { name: "phone-light", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 780 }, colorScheme: "light" as const } },
  { name: "phone-dark", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 780 }, colorScheme: "dark" as const } },
  { name: "desktop-light", use: { viewport: { width: 1280, height: 800 }, colorScheme: "light" as const } },
  { name: "desktop-dark", use: { viewport: { width: 1280, height: 800 }, colorScheme: "dark" as const } },
];

// Phone and desktop widths, each in Light and Dark (BUILD.md Section 14).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  projects: [
    ...looks.map((l) => ({ name: `app-${l.name}`, testMatch: /(landing|auth)\.spec\.ts/, use: { ...l.use, baseURL: APP } })),
    ...looks.map((l) => ({ name: `demo-${l.name}`, testMatch: /(board|trip|post|seats|chat|request|safety)\.spec\.ts/, use: { ...l.use, baseURL: DEMO } })),
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "node scripts/e2e-servers.mjs",
        url: DEMO,
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
      },
});
