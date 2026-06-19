/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * The CLI single-root copy-in contract (`lievit add` for a legacy `registry:ui` item). After the
 * server-first pivot (ADR-0012) the library ships no `registry:ui` Lit island, so this contract
 * runs against a SYNTHETIC fixture (test/fixtures/synthetic-ui-registry.ts) rather than a shipped
 * component: the CLI mechanism is what is under test, not any one island.
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run, parseArgs } from "../cli/lievit-add.js";
import {
  syntheticUiRegistry,
  WIDGET_GOLDEN_FILES,
  WIDGET_CONTENT,
  TOKENS_CONTENT,
} from "./fixtures/synthetic-ui-registry.js";

const registry = syntheticUiRegistry();

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

describe("golden add: lievit add widget (a registry:ui item)", () => {
  test("produces exactly the expected files under the alias root", () => {
    const code = run(["widget", "--root", "src"], registry, project, out);
    expect(code).toBe(0);

    // the golden file set for `add widget`: its closure is tokens + light-dom + widget
    for (const rel of WIDGET_GOLDEN_FILES) {
      expect(existsSync(join(project, "src", rel)), `expected src/${rel}`).toBe(true);
    }
  });

  test("the copied widget is byte-identical to the registry source", () => {
    run(["widget", "--root", "src"], registry, project, out);
    const copied = readFileSync(join(project, "src/components/ui/widget.ts"), "utf8");
    expect(copied).toBe(WIDGET_CONTENT);
  });

  test("the copied tokens are byte-identical to the registry tokens", () => {
    run(["widget", "--root", "src"], registry, project, out);
    const copied = readFileSync(join(project, "src/styles/lievit-tokens.css"), "utf8");
    expect(copied).toBe(TOKENS_CONTENT);
  });

  test("reports the resolved closure and the npm dependency", () => {
    run(["widget", "--root", "src"], registry, project, out);
    const printed = log.join("");
    expect(printed).toContain("widget.ts");
    expect(printed).toContain("npm  -> lit");
    expect(printed).toContain("done.");
  });
});

describe("dry run writes nothing", () => {
  test("--dry-run plans but does not touch disk", () => {
    run(["widget", "--root", "src", "--dry-run"], registry, project, out);
    expect(existsSync(join(project, "src/components/ui/widget.ts"))).toBe(false);
    expect(log.join("")).toContain("dry run: no files written.");
  });
});

describe("owned-edit safety", () => {
  test("an existing file is skipped, the adopter's edits survive", () => {
    const dest = join(project, "src/components/ui/widget.ts");
    mkdirSync(join(project, "src/components/ui"), { recursive: true });
    writeFileSync(dest, "// my own edited widget\n");

    run(["widget", "--root", "src"], registry, project, out);
    expect(readFileSync(dest, "utf8")).toBe("// my own edited widget\n");
    expect(log.join("")).toContain("skip ");
  });

  test("--overwrite replaces an existing file", () => {
    const dest = join(project, "src/components/ui/widget.ts");
    mkdirSync(join(project, "src/components/ui"), { recursive: true });
    writeFileSync(dest, "// stale\n");

    run(["widget", "--root", "src", "--overwrite"], registry, project, out);
    expect(readFileSync(dest, "utf8")).toContain("LvWidget");
  });
});

describe("config + usage", () => {
  test("reads the alias root from lievit.json when --root is absent", () => {
    writeFileSync(join(project, "lievit.json"), JSON.stringify({ root: "web" }));
    run(["widget"], registry, project, out);
    expect(existsSync(join(project, "web/components/ui/widget.ts"))).toBe(true);
  });

  test("prints usage and returns non-zero with no component named", () => {
    const code = run([], registry, project, out);
    expect(code).toBe(1);
    expect(log.join("")).toContain("usage: lievit add");
  });
});
