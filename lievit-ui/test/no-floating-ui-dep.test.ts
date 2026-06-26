/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * lievit's positioning engine is the native CSS Anchor Positioning spec (anchor-name /
 * position-anchor / position-area / position-try-fallbacks) + the native popover API, never
 * @floating-ui. The Firefox/Safari fallback is the @oddbird/css-anchor-positioning POLYFILL, which
 * transitively pulls @floating-ui/dom as ITS OWN engine. That transitive presence is fine — it is
 * the polyfill's internal detail, not lievit's positioning choice. What this build-time backstop
 * forbids is a DIRECT @floating-ui dependency (lievit choosing floating-ui as its engine) and any
 * @floating-ui import site in lievit's own source. It also pins that the ONLY package allowed to
 * pull floating-ui into the tree is the oddbird polyfill, so a stray new direct path is caught.
 * (Option B — a newer oddbird that dropped floating-ui — was checked 2026-06-26 and does not exist:
 * even 0.10.0-alpha.1 still depends on @floating-ui/dom. When it ships, bump oddbird and the
 * transitive path simply disappears; this test stays green either way.)
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

describe("@floating-ui is not a DIRECT lievit dependency (only transitive via the oddbird polyfill)", () => {
  test("package.json declares no @floating-ui package in any dependency group", () => {
    const pkg = readJson("package.json");
    for (const group of ["dependencies", "optionalDependencies", "devDependencies"]) {
      const deps = (pkg[group] ?? {}) as Record<string, string>;
      const direct = Object.keys(deps).filter((d) => d.startsWith("@floating-ui/"));
      expect(direct, `${group} must not declare any @floating-ui package directly`).toEqual([]);
    }
  });

  test("@floating-ui appears only TRANSITIVELY, pulled solely by @oddbird/css-anchor-positioning", () => {
    // Intent: lievit does not pick floating-ui as its positioning engine. floating-ui is allowed to
    // exist in the tree, but ONLY because the @oddbird anchor-positioning polyfill depends on it. We
    // forbid any OTHER package (above all the lievit-ui root, key "") from declaring @floating-ui.
    const lock = readJson("package-lock.json");
    const packages = (lock.packages ?? {}) as Record<string, { dependencies?: Record<string, string> }>;
    const ODDBIRD = "node_modules/@oddbird/css-anchor-positioning";

    const declarers: string[] = [];
    for (const [pkgPath, meta] of Object.entries(packages)) {
      // @floating-ui's own sub-packages declare @floating-ui/{core,utils}: internal, not a new pull.
      if (pkgPath.includes("node_modules/@floating-ui/")) continue;
      const deps = meta.dependencies ?? {};
      if (Object.keys(deps).some((d) => d.startsWith("@floating-ui/"))) {
        declarers.push(pkgPath);
      }
    }

    // The lievit-ui root project (key "") must NOT be a declarer: no DIRECT floating-ui dependency.
    expect(declarers, "lievit-ui itself must not declare @floating-ui directly").not.toContain("");
    // The only package allowed to pull floating-ui is the oddbird anchor-positioning polyfill.
    expect(declarers).toEqual([ODDBIRD]);
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
