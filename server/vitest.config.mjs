import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    hookTimeout: 120000,
    setupFiles: ["./tests/setupEnvironment.js"],
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "coverage",
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80
      },
      include: [
        "app.js",
        "config/**/*.js",
        "middleware/**/*.js",
        "models/**/*.js",
        "routes/**/*.js",
        "utils/**/*.js",
        "validation/**/*.js"
      ],
      exclude: ["server.js", "scripts/**"]
    }
  }
});
