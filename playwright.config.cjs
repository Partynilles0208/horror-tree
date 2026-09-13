const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "game.spec.cjs",
  timeout: 60000,
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL:
      process.env.TEST_BASE_URL ||
      (process.env.TEST_BUILT
        ? "http://127.0.0.1:5178/horror-tree/"
        : "http://127.0.0.1:5177"),
    headless: true,
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      ...(process.env.CHROMIUM_PATH
        ? { executablePath: process.env.CHROMIUM_PATH }
        : {}),
      args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
    },
  },
  webServer: process.env.TEST_BUILT
    ? {
        command: "node scripts/serve-built.cjs",
        url: "http://127.0.0.1:5178/horror-tree/",
        reuseExistingServer: !process.env.CI,
      }
    : process.env.TEST_BASE_URL
      ? undefined
      : {
          command: "node server.js --no-open",
          url: "http://127.0.0.1:5177",
          reuseExistingServer: !process.env.CI,
        },
  reporter: "list",
});
