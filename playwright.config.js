const { defineConfig } = require("@playwright/test");

const firebaseTestEnv = {
  FIREBASE_WEB_API_KEY: "tasko-playwright-api-key",
  FIREBASE_WEB_AUTH_DOMAIN: "tasko-playwright.firebaseapp.com",
  FIREBASE_WEB_PROJECT_ID: "tasko-playwright",
  FIREBASE_WEB_STORAGE_BUCKET: "tasko-playwright.appspot.com",
  FIREBASE_WEB_MESSAGING_SENDER_ID: "1234567890",
  FIREBASE_WEB_APP_ID: "1:1234567890:web:taskoplaywright"
};

module.exports = defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  use: {
    headless: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  webServer: [
    {
      command: "npm.cmd --prefix backend run dev",
      url: "http://localhost:5000/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        ...firebaseTestEnv,
        PORT: "5000"
      }
    },
    {
      command: "npm.cmd --prefix user-app run dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    },
    {
      command: "npm.cmd --prefix worker-app run dev",
      url: "http://localhost:3001",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    },
    {
      command: "npm.cmd --prefix admin-panel run dev",
      url: "http://localhost:3002",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
  ]
});
