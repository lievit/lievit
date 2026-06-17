/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["cli/**/*.ts", "registry/**/*.ts", "runtime/**/*.ts"],
      // the CLI disk-effect entrypoints are integration-tested via the golden add test,
      // not unit covered line-by-line; the planner and resolver they delegate to are.
      exclude: ["**/*.d.ts"],
    },
  },
});
