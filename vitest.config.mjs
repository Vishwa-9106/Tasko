import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "admin-panel/src/**/*.test.{js,jsx}",
      "backend/src/**/*.test.{ts,tsx}",
      "user-app/src/**/*.test.{js,jsx}"
    ],
    environmentMatchGlobs: [
      ["admin-panel/src/**/*.{test,spec}.{js,jsx}", "jsdom"],
      ["user-app/src/**/*.{test,spec}.{js,jsx}", "jsdom"]
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "admin-panel/src/**/*.js",
        "backend/src/**/*.ts",
        "user-app/src/**/*.js"
      ],
      exclude: [
        "**/*.test.*",
        "**/main.*",
        "**/firebase.*",
        "**/index.*"
      ]
    }
  }
});
