/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildRegistry } from "../cli/build-registry.js";
import { run, parseArgs } from "../cli/lievit-add.js";
import type { Registry } from "../cli/registry.js";

const registryRoot = join(import.meta.dirname, "..", "registry");
const registry: Registry = buildRegistry(registryRoot);

let project: string;
let log: string[];
const out = (s: string) => log.push(s);

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), "lievit-add-"));
  log = [];
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
});

describe("parseArgs", () => {
  test("splits names from flags", () => {
    const cli = parseArgs(["button", "input", "--dry-run", "--root", "web"]);
    expect(cli.names).toEqual(["button", "input"]);
    expect(cli.dryRun).toBe(true);
    expect(cli.root).toBe("web");
  });

  test("treats --diff as a dry run alias", () => {
    expect(parseArgs(["button", "--diff"]).dryRun).toBe(true);
  });
});

describe("golden add: lievit add button", () => {
  test("produces exactly the expected files under the alias root", () => {
    const code = run(["button", "--root", "src"], registry, project, out);
    expect(code).toBe(0);

    // the golden file set for `add button`: its closure is tokens + light-dom + button
    const expected = [
      "src/styles/lievit-tokens.css",
      "src/components/ui/light-dom.ts",
      "src/components/ui/button.ts",
    ];
    for (const rel of expected) {
      expect(existsSync(join(project, rel)), `expected ${rel}`).toBe(true);
    }
  });

  test("the copied button is byte-identical to the registry source", () => {
    run(["button", "--root", "src"], registry, project, out);
    const copied = readFileSync(join(project, "src/components/ui/button.ts"), "utf8");
    const source = readFileSync(join(registryRoot, "components/button/button.ts"), "utf8");
    expect(copied).toBe(source);
  });

  test("the copied tokens are byte-identical to the registry tokens", () => {
    run(["button", "--root", "src"], registry, project, out);
    const copied = readFileSync(join(project, "src/styles/lievit-tokens.css"), "utf8");
    const source = readFileSync(join(registryRoot, "tokens/lievit-tokens.css"), "utf8");
    expect(copied).toBe(source);
  });

  test("reports the resolved closure and the npm dependency", () => {
    run(["button", "--root", "src"], registry, project, out);
    const printed = log.join("");
    expect(printed).toContain("button.ts");
    expect(printed).toContain("npm  -> lit");
    expect(printed).toContain("done.");
  });
});

describe("dry run writes nothing", () => {
  test("--dry-run plans but does not touch disk", () => {
    run(["button", "--root", "src", "--dry-run"], registry, project, out);
    expect(existsSync(join(project, "src/components/ui/button.ts"))).toBe(false);
    expect(log.join("")).toContain("dry run: no files written.");
  });
});

describe("owned-edit safety", () => {
  test("an existing file is skipped, the adopter's edits survive", () => {
    const dest = join(project, "src/components/ui/button.ts");
    mkdirSync(join(project, "src/components/ui"), { recursive: true });
    writeFileSync(dest, "// my own edited button\n");

    run(["button", "--root", "src"], registry, project, out);
    expect(readFileSync(dest, "utf8")).toBe("// my own edited button\n");
    expect(log.join("")).toContain("skip ");
  });

  test("--overwrite replaces an existing file", () => {
    const dest = join(project, "src/components/ui/button.ts");
    mkdirSync(join(project, "src/components/ui"), { recursive: true });
    writeFileSync(dest, "// stale\n");

    run(["button", "--root", "src", "--overwrite"], registry, project, out);
    expect(readFileSync(dest, "utf8")).toContain("LvButton");
  });
});

describe("config + usage", () => {
  test("reads the alias root from lievit.json when --root is absent", () => {
    writeFileSync(join(project, "lievit.json"), JSON.stringify({ root: "web" }));
    run(["badge"], registry, project, out);
    expect(existsSync(join(project, "web/components/ui/badge.ts"))).toBe(true);
  });

  test("prints usage and returns non-zero with no component named", () => {
    const code = run([], registry, project, out);
    expect(code).toBe(1);
    expect(log.join("")).toContain("usage: lievit add");
  });
});
