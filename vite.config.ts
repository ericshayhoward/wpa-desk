import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  // The build is published as a GitHub Pages project site at ericshayhoward.com/wpa-desk/.
  base: command === "build" ? "/wpa-desk/" : "/",
  plugins: [react()],
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/test-setup.ts"],
    // The multi-year jsdom playthroughs take ~4s each; the 5s default flakes under load.
    testTimeout: 15_000,
  },
}));
