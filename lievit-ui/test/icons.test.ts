/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * The Lucide icon system (issue #428). Delivery is inline-per-name (NOT a sprite): the
 * generated body map holds only the icons vendored into registry/icons/ (tree-shaken), and
 * the JTE partial renders the uniform <svg> wrapper styled by --lv-* tokens.
 *
 * This suite pins: the map is generated from the vendored SVGs and matches them; it is
 * deterministic (re-running the generator yields byte-identical output -- the drift guard);
 * the partial wrapper is token-driven, currentColor, and accessible (decorative by default,
 * labelled when a label is passed); and the starter set is present.
 */
import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { iconBodies, iconBody } from "../registry/icons/icon-bodies.js";

const iconsDir = join(import.meta.dirname, "..", "registry", "icons");
const jteDir = join(import.meta.dirname, "..", "registry", "jte");

const svgNames = readdirSync(iconsDir)
  .filter((f) => f.endsWith(".svg"))
  .map((f) => f.slice(0, -4))
  .sort();

const iconJte = readFileSync(join(jteDir, "icon.jte"), "utf8");

/** A representative slice of the documented starter set the partial promises. */
const STARTER = [
  "chevron-down",
  "chevron-up",
  "chevron-left",
  "chevron-right",
  "check",
  "x",
  "search",
  "menu",
  "plus",
  "minus",
  "arrow-up",
  "arrow-down",
  "arrow-left",
  "arrow-right",
  "circle-check",
  "circle-alert",
  "triangle-alert",
  "info",
  "eye",
  "calendar",
  "user",
  "settings",
  "trash",
];

describe("icon body map", () => {
  test("vendors a sensible starter set (40-60 icons)", () => {
    expect(svgNames.length).toBeGreaterThanOrEqual(40);
    expect(svgNames.length).toBeLessThanOrEqual(60);
  });

  test("ships every documented starter icon", () => {
    for (const name of STARTER) {
      expect(svgNames, `missing vendored svg: ${name}`).toContain(name);
      expect(iconBody(name), `empty body for ${name}`).toBeTruthy();
    }
  });

  test("the generated map has exactly the vendored icons (tree-shaken, no extras)", () => {
    expect(Object.keys(iconBodies).sort()).toEqual(svgNames);
  });

  test("each body is the inner SVG markup of its vendored file (no <svg> wrapper)", () => {
    for (const name of svgNames) {
      const body = iconBody(name);
      expect(body, `${name} body empty`).toBeTruthy();
      // inner content only -- the wrapper lives in icon.jte
      expect(body, `${name} body leaked the <svg> wrapper`).not.toMatch(/<svg/);
      // Lucide bodies are drawing primitives
      expect(body, `${name} has no drawing element`).toMatch(/<(path|circle|rect|line|polyline|polygon|ellipse)/);
    }
  });

  test("an unknown icon name resolves to empty string, never throws", () => {
    expect(iconBody("definitely-not-an-icon")).toBe("");
  });

  test("the generator is deterministic: re-running yields byte-identical maps (drift guard)", () => {
    const before = {
      ts: readFileSync(join(iconsDir, "icon-bodies.ts"), "utf8"),
      java: readFileSync(join(iconsDir, "LucideIconResolver.java"), "utf8"),
    };
    execFileSync("node", [join(iconsDir, "generate-icon-map.mjs")], { stdio: "pipe" });
    const after = {
      ts: readFileSync(join(iconsDir, "icon-bodies.ts"), "utf8"),
      java: readFileSync(join(iconsDir, "LucideIconResolver.java"), "utf8"),
    };
    expect(after.ts, "icon-bodies.ts drifted from the vendored svgs").toBe(before.ts);
    expect(after.java, "LucideIconResolver.java drifted from the vendored svgs").toBe(before.java);
  });
});

/*
 * The de-gest-ification gate: lievit is a standalone library, so the icon component MUST resolve
 * its glyphs from a LIEVIT-OWNED default (the bundled Lucide set behind an IconResolver SPI), never
 * from an adopter's class. icon.jte must render with ZERO adopter classpath. This suite pins that
 * no `it.housetreespa` (or any adopter package) leaks into the icon system, and that the SPI +
 * default resolver lievit owns are in the lievit-owned io.lievit.ui package.
 */
describe("icon system is lievit-owned (no adopter classpath, standalone)", () => {
  const spiInterface = readFileSync(join(iconsDir, "IconResolver.java"), "utf8");
  const facade = readFileSync(join(iconsDir, "LievitIcons.java"), "utf8");
  const defaultResolver = readFileSync(join(iconsDir, "LucideIconResolver.java"), "utf8");
  const generator = readFileSync(join(iconsDir, "generate-icon-map.mjs"), "utf8");

  test("icon.jte imports the lievit-owned facade, NOT an adopter class", () => {
    expect(iconJte).toContain("@import static io.lievit.ui.LievitIcons.body");
    expect(iconJte).toContain("$unsafe{body(name)}");
    // hard de-gest-ify assertion: no adopter package anywhere in the partial
    expect(iconJte).not.toContain("it.housetreespa");
  });

  test("no icon-system source references an adopter package (it.housetreespa)", () => {
    for (const [label, src] of [
      ["IconResolver.java", spiInterface],
      ["LievitIcons.java", facade],
      ["LucideIconResolver.java", defaultResolver],
      ["generate-icon-map.mjs", generator],
      ["icon.jte", iconJte],
    ] as const) {
      expect(src, `${label} leaks an adopter package`).not.toContain("it.housetreespa");
    }
  });

  test("the SPI + default resolver live in the lievit-owned io.lievit.ui package", () => {
    expect(spiInterface).toContain("package io.lievit.ui;");
    expect(spiInterface).toMatch(/interface\s+IconResolver/);
    expect(spiInterface).toMatch(/String\s+body\(String\s+name\)/);
    expect(facade).toContain("package io.lievit.ui;");
    expect(facade).toMatch(/class\s+LievitIcons/);
    expect(facade).toMatch(/setResolver\s*\(/); // adopter override hook
    expect(defaultResolver).toContain("package io.lievit.ui;");
    expect(defaultResolver).toMatch(/class\s+LucideIconResolver\s+implements\s+IconResolver/);
  });

  test("the facade defaults to lievit's bundled Lucide set (renders out of the box)", () => {
    expect(facade).toMatch(/new\s+LucideIconResolver\(\)/);
    // every vendored icon is reachable through the default resolver's map
    expect(defaultResolver).toContain(`Map.entry("check"`);
    expect(defaultResolver).toContain(`Map.entry("search"`);
  });
});

describe("icon.jte partial", () => {
  test("imports the static body lookup and emits it unescaped (trusted vendored svg)", () => {
    expect(iconJte).toContain("@import static io.lievit.ui.LievitIcons.body");
    expect(iconJte).toContain("$unsafe{body(name)}");
  });

  test("renders the wrapper with currentColor + token-driven size and stroke", () => {
    expect(iconJte).toContain('stroke="currentColor"');
    expect(iconJte).toContain('stroke-width="var(--lv-icon-stroke)"');
    expect(iconJte).toMatch(/width="\$\{size\}"/);
    expect(iconJte).toContain('var(--lv-icon-size)'); // default size token
    expect(iconJte).toContain('viewBox="0 0 24 24"');
  });

  test("is decorative by default but labellable (a11y: aria-hidden vs role=img)", () => {
    expect(iconJte).toContain('@param String label = null');
    expect(iconJte).toMatch(/role="\$\{label == null \? "presentation" : "img"\}"/);
    expect(iconJte).toMatch(/aria-hidden="\$\{label == null \? "true" : null\}"/);
    expect(iconJte).toContain('focusable="false"');
  });

  test("forwards a cssClass param so adopters tint via Tailwind / token utilities", () => {
    expect(iconJte).toContain("@param String cssClass");
    expect(iconJte).toContain('class="lv-icon ${cssClass}"');
  });
});
