import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

Object.assign(process.env, loadEnv("test", process.cwd(), ""));

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
