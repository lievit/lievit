/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * @floating-ui/dom was a DEAD dependency: declared in package.json with ZERO import sites.
 * Positioning is done with the native CSS Anchor Positioning spec (anchor-name / position-anchor /
 * position-area / position-try-fallbacks) + the native popover API, never floating-ui. This test
 * is the build-time backstop that the dep stays removed AND that the native positioning it would
 * have provided still resolves in the shipped templates.
 */
import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const pkgRoot = join(import.meta.dirname, "..");
const readJson = (rel: string) =>
  JSON.parse(readFileSync(join(pkgRoot, rel), "utf8")) as Record<string, unknown>;

// Recursively collect every TS source file under the runnable code roots (skip node_modules/tests).
function tsSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(pkgRoot, dir), { withFileTypes: true })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      out.push(...tsSources(rel));
    } else if (entry.name.endsWith(".ts")) {
      out.push(rel);
    }
  }
  return out;
}

describe("@floating-ui/dom is removed (it was a dead dependency)", () => {
  test("package.json declares @floating-ui/dom in no dependency group", () => {
    const pkg = readJson("package.json");
    for (const group of ["dependencies", "optionalDependencies", "devDependencies"]) {
      const deps = (pkg[group] ?? {}) as Record<string, string>;
      expect(Object.keys(deps), `${group} must not declare @floating-ui/dom`).not.toContain(
        "@floating-ui/dom",
      );
    }
  });

  test("the lockfile no longer resolves any @floating-ui package", () => {
    const lock = readFileSync(join(pkgRoot, "package-lock.json"), "utf8");
    expect(lock).not.toMatch(/@floating-ui/);
  });

  test("no source file imports @floating-ui/dom (it never had an import site)", () => {
    const offenders = ["cli", "runtime", "registry"]
      .flatMap((root) => tsSources(root))
      .filter((rel) => /(?:from|import|require)\s*\(?\s*['"]@floating-ui/.test(
        readFileSync(join(pkgRoot, rel), "utf8"),
      ));
    expect(offenders, "no TS source may import @floating-ui").toEqual([]);
  });
});

describe("positioning still resolves: native CSS Anchor Positioning, not floating-ui", () => {
  test("the popover template anchors with the native spec", () => {
    const jte = readFileSync(join(pkgRoot, "registry/jte/popover.jte"), "utf8");
    // strip JTE comments: they document "NO @floating-ui/dom" on purpose; assert on real markup.
    const markup = jte.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toContain("anchor-name:");
    expect(markup).toContain("position-anchor:");
    expect(markup).toContain("position-area:");
    expect(markup).toContain("position-try-fallbacks:flip-block");
    expect(markup).not.toMatch(/floating-ui/);
  });
});
