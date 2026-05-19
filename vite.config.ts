/// <reference types="vitest" />
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  base: "./",
  plugins: [solid()],
  // Dedicated port: /workspace/ludus-ignis owns :5173, the old ignis line used
  // :5174. Bind the host so it's reachable from outside the container.
  server: { host: true, port: 5175, strictPort: true },
  test: {
    environment: "node",
    globals: true,
    // Logic suites only (*.test.ts); Solid .tsx components aren't unit-tested.
    include: ["src/**/*.test.ts"],
  },
});
