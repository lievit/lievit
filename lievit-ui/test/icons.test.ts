/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * The Lucide icon system (issue #428). Delivery is inline-per-name (NOT a sprite): the
 * generated body map holds the FULL Lucide set (built from the lucide-static npm package at
 * build time), and the JTE partial renders the uniform <svg> wrapper styled by --lv-* tokens.
 *
 * The set is bundled WHOLE in the jar: a consumer (gest) references any Lucide glyph by name
 * and it resolves from lievit's default resolver -- ZERO vendored SVGs, ZERO custom resolver.
 *
 * This suite pins: the map is generated from lucide-static and is the full set (not a tree-shaken
 * subset); previously-missing gest names now resolve from BOTH the Java (jar) map and the TS map;
 * it is deterministic (re-running the generator yields byte-identical output -- the drift guard);
 * the partial wrapper is token-driven, currentColor, and accessible; and the starter set is present.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { iconBodies, iconBody } from "../registry/icons/icon-bodies.js";

const iconsDir = join(import.meta.dirname, "..", "registry", "icons");
const jteDir = join(import.meta.dirname, "..", "registry", "jte");

const require = createRequire(import.meta.url);
const lucideIconsDir = join(dirname(require.resolve("lucide-static/package.json")), "icons");

const iconJte = readFileSync(join(jteDir, "icon.jte"), "utf8");
const javaResolver = readFileSync(join(iconsDir, "LucideIconResolver.java"), "utf8");

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

/*
 * Names gest had to VENDOR before this change because lievit only bundled a 56-icon subset.
 * They must now resolve straight from the jar map (the de-vendoring acceptance criterion). The
 * first four are the task's explicit examples; the rest are real gest glyph names that the old
 * 56-icon subset did not carry.
 */
const PREVIOUSLY_MISSING_GEST_NAMES = [
  "file-signature",
  "ellipsis",
  "chart-column",
  "triangle-alert",
  "navigation",
  "bug",
  "images",
  "folder-open",
  "handshake",
];

describe("icon body map (full Lucide set, bundled in the jar)", () => {
  test("bundles the WHOLE Lucide set, not a tree-shaken subset", () => {
    // lucide-static ships ~2000 icons; assert we carry a generously-complete set, not the old ~56.
    expect(Object.keys(iconBodies).length).toBeGreaterThanOrEqual(1500);
  });

  test("the TS map matches the lucide-static source exactly (built from it, name-for-name)", () => {
    const sourceNames = require("node:fs")
      .readdirSync(lucideIconsDir)
      .filter((f: string) => f.endsWith(".svg"))
      .map((f: string) => f.slice(0, -4))
      .sort();
    expect(Object.keys(iconBodies).sort()).toEqual(sourceNames);
  });

  test("previously-missing gest names now resolve from the JAR map (Java) AND the TS map", () => {
    for (const name of PREVIOUSLY_MISSING_GEST_NAMES) {
      // TS map (Lit islands)
      expect(iconBody(name), `empty TS body for ${name}`).toBeTruthy();
      // Java map (the jar / server-rendered icon.jte path) -- source-level proof the put exists
      expect(javaResolver, `Java jar map missing m.put for ${name}`).toContain(
        `m.put(${JSON.stringify(name)},`
      );
    }
  });

  test("ships every documented starter icon", () => {
    for (const name of STARTER) {
      expect(iconBody(name), `empty body for ${name}`).toBeTruthy();
    }
  });

  test("each body is the inner SVG markup of its Lucide icon (no <svg> wrapper)", () => {
    for (const name of Object.keys(iconBodies)) {
      const body = iconBody(name);
      expect(body, `${name} body empty`).toBeTruthy();
      // inner content only -- the wrapper lives in icon.jte
      expect(body, `${name} body leaked the <svg> wrapper`).not.toMatch(/<svg/);
      // Lucide bodies are drawing primitives
      expect(body, `${name} has no drawing element`).toMatch(
        /<(path|circle|rect|line|polyline|polygon|ellipse)/
      );
    }
  });

  test("an unknown icon name resolves to empty string, never throws", () => {
    expect(iconBody("definitely-not-an-icon")).toBe("");
  });

  test("carries the Lucide check-check (double-check) glyph for mark-all-read", () => {
    // the notification mark-all-read affordance wanted the double-check; it is two <path> marks.
    const body = iconBody("check-check");
    expect(body, "check-check body empty").toBeTruthy();
    expect(body).toContain('<path d="M18 6 7 17l-5-5" />');
    expect(body).toContain('<path d="m22 10-7.5 7.5L13 16" />');
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
    expect(after.ts, "icon-bodies.ts drifted from the lucide-static source").toBe(before.ts);
    expect(after.java, "LucideIconResolver.java drifted from the lucide-static source").toBe(
      before.java
    );
  });
});

/*
 * The de-gest-ification gate: lievit is a standalone library, so the icon component MUST resolve
 * its glyphs from a LIEVIT-OWNED default (the bundled full Lucide set behind an IconResolver SPI),
 * never from an adopter's class. icon.jte must render with ZERO adopter classpath. This suite pins
 * that no `it.housetreespa` (or any adopter package) leaks into the icon system, and that the SPI +
 * default resolver lievit owns are in the lievit-owned dev.lievit.ui package.
 */
describe("icon system is lievit-owned (no adopter classpath, standalone)", () => {
  const spiInterface = readFileSync(join(iconsDir, "IconResolver.java"), "utf8");
  const facade = readFileSync(join(iconsDir, "LievitIcons.java"), "utf8");
  const defaultResolver = javaResolver;
  const generator = readFileSync(join(iconsDir, "generate-icon-map.mjs"), "utf8");

  test("icon.jte imports the lievit-owned facade, NOT an adopter class", () => {
    expect(iconJte).toContain("@import static dev.lievit.ui.LievitIcons.body");
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

  test("the SPI + default resolver live in the lievit-owned dev.lievit.ui package", () => {
    expect(spiInterface).toContain("package dev.lievit.ui;");
    expect(spiInterface).toMatch(/interface\s+IconResolver/);
    expect(spiInterface).toMatch(/String\s+body\(String\s+name\)/);
    expect(facade).toContain("package dev.lievit.ui;");
    expect(facade).toMatch(/class\s+LievitIcons/);
    expect(facade).toMatch(/setResolver\s*\(/); // adopter override hook
    expect(defaultResolver).toContain("package dev.lievit.ui;");
    expect(defaultResolver).toMatch(/class\s+LucideIconResolver\s+implements\s+IconResolver/);
  });

  test("the facade defaults to lievit's bundled full Lucide set (renders out of the box)", () => {
    expect(facade).toMatch(/new\s+LucideIconResolver\(\)/);
    // common icons are reachable through the default resolver's map (jar path)
    expect(defaultResolver).toContain(`m.put("check"`);
    expect(defaultResolver).toContain(`m.put("search"`);
  });
});

describe("icon.jte partial", () => {
  test("imports the static body lookup and emits it unescaped (trusted vendored svg)", () => {
    expect(iconJte).toContain("@import static dev.lievit.ui.LievitIcons.body");
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
    // decorative branch: NO role (lucide uses aria-hidden alone); labelled branch: role=img.
    expect(iconJte).toMatch(/role="\$\{label == null \? null : "img"\}"/);
    expect(iconJte).toMatch(/aria-hidden="\$\{label == null \? "true" : null\}"/);
    expect(iconJte).toContain('focusable="false"');
  });

  test("forwards a cssClass param so adopters tint via Tailwind / token utilities", () => {
    expect(iconJte).toContain("@param String cssClass");
    expect(iconJte).toContain('class="lv-icon ${cssClass}"');
  });
});
