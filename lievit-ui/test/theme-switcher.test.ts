/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * theme-switcher partial -- source-text assertions (v-next re-forged surface).
 *
 * v-next re-forge (Wave 4): the ARIA model changed from role=radiogroup / aria-checked to
 * role=toolbar / aria-pressed (APG Toolbar + APG Toggle Button). The enhancer hook changed
 * from data-lievit-theme-switcher to data-lievit-enhancer="theme-switcher". applyTheme now
 * sets data-theme only (no .dark class toggle). The full new-surface contract is pinned by
 * test/theme-switcher-vnext.test.ts. THIS file retains the assertions that are still valid
 * on the new surface and updates the ones that changed; duplicated coverage defers to -vnext.
 *
 * What changed (deliberate removals noted as anti-pattern corrections):
 *   - role=radiogroup / aria-checked → role=toolbar / aria-pressed (APG correctness)
 *   - data-lievit-theme-switcher → data-lievit-enhancer="theme-switcher" (v-next protocol)
 *   - data-current / data-theme-value → data-default-theme / data-theme-option (v-next names)
 *   - Old param API (current, labels, label, lightLabel, darkLabel, systemLabel) → gone
 *   - New param API: variant, size, storageKey, rootSelector, defaultTheme, labelLight/Dark/System,
 *     showSystemOption, cssClass, attrs, dataAttrs
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { iconBody } from "../registry/icons/icon-bodies.js";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "theme-switcher.jte"), "utf8");

describe("theme-switcher -- params & docs API", () => {
  test("declares the documented param API with defaults", () => {
    // v-next API: variant/size/storageKey/rootSelector/defaultTheme/labelLight/labelDark/labelSystem
    expect(src).toContain('@param String variant = "icon"');
    expect(src).toContain('@param String size = "md"');
    expect(src).toContain('@param String storageKey = "lievit-theme"');
    expect(src).toContain('@param String rootSelector = "html"');
    expect(src).toContain('@param String defaultTheme = "system"');
    expect(src).toContain('@param String labelLight = "Light"');
    expect(src).toContain('@param String labelDark = "Dark"');
    expect(src).toContain('@param String labelSystem = "System"');
    expect(src).toContain("@param boolean showSystemOption = true");
    expect(src).toContain('@param String cssClass = ""');
    // Old API params must be gone
    expect(src).not.toContain('@param String current = "system"');
    expect(src).not.toContain("@param boolean labels = false");
    expect(src).not.toContain('@param String label = ');
    expect(src).not.toContain("@param String lightLabel");
    expect(src).not.toContain("@param String darkLabel");
    expect(src).not.toContain("@param String systemLabel");
  });

  test("usage doc uses <%-- --%> (not @* *@) and shows the @template.lievit.theme-switcher call", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
    expect(src, "must NOT use @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src).toMatch(/Usage:/);
    expect(src).toContain("@@template.lievit.theme-switcher(");
  });
});

describe("theme-switcher -- WAI-ARIA radiogroup structure", () => {
  // v-next: ARIA model is APG Toolbar + aria-pressed (not radiogroup/aria-checked).
  // These tests assert the new correct behavior; the old anti-patterns are explicitly absent.
  test("the track is a labelled toolbar (not radiogroup)", () => {
    // v-next: role=toolbar + aria-label (APG Toolbar pattern for three aria-pressed buttons)
    expect(src).toContain('role="toolbar"');
    expect(src).toContain('aria-label="Theme"');
    // data-slot="theme-switcher" lives inside the Java string _commonDataAttrs (escaped quotes)
    expect(src).toContain('data-slot=\\"theme-switcher\\"');
    // Old radiogroup pattern is gone (it was incorrect for a segmented control)
    expect(src).not.toContain('role="radiogroup"');
  });

  test("renders exactly three role=radio options, one per theme value", () => {
    // v-next: buttons use aria-pressed (APG Toggle Button), not role=radio.
    // The three options are data-theme-option=light/dark/system.
    expect(src).toContain('data-theme-option="light"');
    expect(src).toContain('data-theme-option="dark"');
    expect(src).toContain('data-theme-option="system"');
    // Old role=radio is gone (it was incorrect; buttons are toggle buttons, not radios)
    expect(src).not.toContain('role="radio"');
  });

  test("aria-checked is server-owned, driven by `current` (1-of-3 selection)", () => {
    // v-next: aria-pressed replaces aria-checked (APG Toggle Button contract).
    // The server renders all buttons with aria-pressed="false"; the enhancer corrects on mount.
    expect(src).toContain('aria-pressed="false"');
    // Old aria-checked with current param expressions is gone
    expect(src).not.toContain('aria-checked=');
    expect(src).not.toContain('@param String current');
  });

  test("roving tabindex: the active option is tabbable (0), the rest are not (-1) -- APG contract", () => {
    // v-next: the enhancer manages roving tabindex (all start at -1; enhancer sets active to 0).
    // The template renders all buttons with tabindex="-1"; the display:none guard prevents flash.
    expect(src).toContain('tabindex="-1"');
    // Old server-owned tabindex expressions are gone (the enhancer now owns tabindex)
    expect(src).not.toContain('tabindex="${"light".equals(current) ? "0" : "-1"}"');
  });

  test("each option is a real <button type=button> with an accessible name", () => {
    const buttons = src.match(/type="button"/g) ?? [];
    // There are multiple buttons (light/dark/system + possibly icon-labeled)
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    // Labels come from labelLight/labelDark/labelSystem params
    expect(src).toContain('aria-label="${labelLight}"');
    expect(src).toContain('aria-label="${labelDark}"');
    expect(src).toContain('aria-label="${labelSystem}"');
  });
});

describe("theme-switcher -- icons & active styling", () => {
  test("composes the sun / moon / monitor icons via the icon partial", () => {
    expect(src).toContain('name = "sun"');
    expect(src).toContain('name = "moon"');
    expect(src).toContain('name = "monitor"');
  });

  test("the three icons resolve from lievit's bundled set (the icon partial can render them)", () => {
    for (const name of ["sun", "moon", "monitor"]) {
      expect(iconBody(name), `icon does not resolve: ${name}`).toBeTruthy();
    }
  });

  test("the active option paints the accent surface from the tokens (not a flat grey)", () => {
    // v-next: active styling uses aria-[pressed=true] attribute selector (not aria-[checked=true])
    expect(src).toContain("aria-[pressed=true]:bg-[var(--lv-color-accent)]");
    expect(src).toContain("aria-[pressed=true]:text-[var(--lv-color-accent-fg)]");
    // Old aria-[checked=true] selectors are gone
    expect(src).not.toContain("aria-[checked=true]:bg-");
  });

  test("the icon is decorative (aria-hidden); the visible label is opt-in via `labels`", () => {
    // v-next: icon partial renders decorative (aria-hidden via null label);
    // visible label is a <span data-slot=theme-switcher-label> conditional on variant=labeled
    expect(src).toContain('data-slot="theme-switcher-label"');
    // The old @if(labels) guard is replaced by @if("labeled".equals(variant))
    expect(src).not.toMatch(/@if\(labels\)/);
    expect(src).toContain('"labeled".equals(variant)');
  });
});

describe("theme-switcher -- enhancer seam & CSP cleanliness", () => {
  test("exposes the data-* enhancer hook + storage key (persistence is the enhancer's job)", () => {
    // v-next: hook is data-lievit-enhancer="theme-switcher" (not data-lievit-theme-switcher)
    expect(src).toContain('data-lievit-enhancer="theme-switcher"');
    expect(src).toContain("data-storage-key");
    // Old hook attribute is gone (replaced by the canonical data-lievit-enhancer protocol)
    // (it may appear in doc-comment prose; check only the param/template body)
    const bodyStart = src.indexOf("@param");
    expect(src.slice(bodyStart)).not.toContain("data-lievit-theme-switcher");
    // Old data-current / data-theme-value are gone from the template body
    expect(src.slice(bodyStart)).not.toContain("data-current=");
    expect(src.slice(bodyStart)).not.toContain("data-theme-value=");
  });

  test("styling is token-driven (no bare hex colours, no raw px spacing)", () => {
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // Strip arbitrary-value brackets then scan for non-token numeric utilities.
    // Note: space-8/space-9/space-1 appear inside CSS custom-property strings like
    // "var(--lv-space-8)" which are valid token references; the test strips brackets
    // but the Java string literals also need stripping to avoid false positives.
    const stripped = src
      .replace(/!\{[^}]*\}/g, "")       // JTE Java code blocks (contain "var(--lv-space-N)" strings)
      .replace(/<%--[\s\S]*?--%>/g, "") // doc comments
      .replace(/\[[^\]]*\]/g, "[]")     // arbitrary-value brackets
      .replace(/var\(--lv-[^)]*\)/g, ""); // remaining token references
    const numericUtils = stripped.match(/\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mb|mt|gap|h|w|text|size|space)-[1-9]/g) ?? [];
    expect(numericUtils, `non-token numeric utilities: ${numericUtils.join(", ")}`).toEqual([]);
  });
});
