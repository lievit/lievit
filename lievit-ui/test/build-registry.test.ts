/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildRegistry, serializeRegistry } from "../cli/build-registry.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lievit-reg-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeItem(dir: string, meta: object, files: Record<string, string>) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "meta.json"), JSON.stringify(meta));
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, content);
  }
}

describe("buildRegistry", () => {
  test("inlines file content and sorts items by name", () => {
    writeItem(
      join(root, "components", "zeta"),
      {
        name: "zeta",
        type: "registry:ui",
        description: "z",
        dependencies: [],
        registryDependencies: [],
        files: [{ path: "components/zeta/zeta.ts", type: "registry:ui", target: "ui/zeta.ts" }],
        tokens: [],
        docs: "",
      },
      { "components/zeta/zeta.ts": "// zeta source" }
    );
    writeItem(
      join(root, "tokens"),
      {
        name: "tokens",
        type: "registry:tokens",
        description: "t",
        dependencies: [],
        registryDependencies: [],
        files: [{ path: "tokens/lievit-tokens.css", type: "registry:tokens", target: "styles/x.css" }],
        tokens: [],
        docs: "",
      },
      { "tokens/lievit-tokens.css": ":root{}" }
    );

    const reg = buildRegistry(root);
    expect(reg.items.map((i) => i.name)).toEqual(["tokens", "zeta"]);
    expect(reg.items[1].files[0].content).toBe("// zeta source");
  });

  test("tolerates a missing components/ tree (returns only what exists)", () => {
    writeItem(
      join(root, "tokens"),
      {
        name: "tokens",
        type: "registry:tokens",
        description: "t",
        dependencies: [],
        registryDependencies: [],
        files: [{ path: "tokens/x.css", type: "registry:tokens", target: "styles/x.css" }],
        tokens: [],
        docs: "",
      },
      { "tokens/x.css": ":root{}" }
    );
    const reg = buildRegistry(root);
    expect(reg.items.map((i) => i.name)).toEqual(["tokens"]);
  });

  test("ignores a component directory with no meta.json", () => {
    mkdirSync(join(root, "components", "stray"), { recursive: true });
    writeFileSync(join(root, "components", "stray", "stray.ts"), "// orphan");
    const reg = buildRegistry(root);
    expect(reg.items).toHaveLength(0);
  });

  test("serializeRegistry is deterministic and newline-terminated", () => {
    const reg = buildRegistry(root);
    const a = serializeRegistry(reg);
    const b = serializeRegistry(reg);
    expect(a).toBe(b);
    expect(a.endsWith("\n")).toBe(true);
  });
});
