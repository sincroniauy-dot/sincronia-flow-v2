// vitest.config.ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig({
  plugins: [
    // Lee baseUrl y paths de tsconfig.json (alias @/*)
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      // Respaldo por si algún entorno no toma el plugin:
      "@": path.resolve(__dirname, ".")
    }
  },
  test: {
    environment: "node",
    globals: true,
    testTimeout: 30000,
    setupFiles: ["./tests/setup.ts"],
    reporters: ["default"],
    coverage: {
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
    },
  },
});
