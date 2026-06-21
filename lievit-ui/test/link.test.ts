/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * lievit-ui link partial -- a standalone styled anchor (the Filament LinkComponent / the action
 * LINK variant). Like the other static-partials suites, this Node harness has no JTE compiler, so
 * it asserts on the partial SOURCE as text: it pins the @param API, the server-first <a>/<span>
 * polymorphism (blank href degrades to an inert span), the leading/trailing icon + trailing badge
 * composition, the newTab rel safety, the token-driven styling (every colour/space reads a --lv-*
 * var, never a hex/px), and the a11y/CSP contract (focus ring, no inline script / on* handlers).
 * The real-compiler golden runs out of band via `npm run test:jte-compile`.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "link.jte"), "utf8");

describe("link -- params & docs API", () => {
  test("declares the documented param API with defaults", () => {
    expect(src).toContain("@param String label = null");
    expect(src).toContain("@param gg.jte.Content content = null");
    expect(src).toContain("@param String href = null");
    expect(src).toContain('@param String variant = "default"');
    expect(src).toContain("@param String icon = null");
    expect(src).toContain('@param String iconPosition = "leading"');
    expect(src).toContain("@param String badge = null");
    expect(src).toContain('@param String badgeVariant = "secondary"');
    expect(src).toContain("@param boolean newTab = false");
    expect(src).toContain("@param String cssClass");
  });

  test("usage doc uses <%-- --%> (not @* *@) and shows the @template.lievit.link call", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
    expect(src, "must NOT use @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src).toMatch(/Usage:/);
    expect(src).toContain("@@template.lievit.link(");
  });
});

describe("link -- structure & polymorphism", () => {
  test("a non-blank href renders a real <a>, a blank href degrades to an inert aria-disabled <span>", () => {
    expect(src).toContain("var isLink = href != null && !href.isBlank();");
    expect(src).toMatch(/@if\(isLink\)/);
    expect(src).toMatch(/<a\b/);
    // the @else branch is the inert span
    expect(src).toContain('aria-disabled="true"');
    expect(src).toMatch(/<span[^>]*data-slot="link"/);
  });

  test("carries the data-slot=link + data-variant contract", () => {
    expect(src).toContain('data-slot="link"');
    expect(src).toContain('data-variant="${variant}"');
    expect(src).toContain('data-slot="link-label"');
  });

  test("variant drives the colour pair from the tokens (default=primary, muted=muted-fg)", () => {
    expect(src).toContain('"muted".equals(variant) ? "var(--lv-color-muted-fg)" : "var(--lv-color-primary)"');
  });

  test("default underlines on hover (shadcn link affordance); muted darkens to full fg", () => {
    expect(src).toContain("hover:underline");
    expect(src).toContain("hover:text-[var(--lv-color-fg)]");
  });
});

describe("link -- icon & badge composition", () => {
  test("composes the icon partial, positioned leading or trailing", () => {
    expect(src).toContain("var iconLeading = !\"trailing\".equals(iconPosition);");
    expect(src).toContain("@template.lievit.icon(name = icon, size = \"1rem\")");
    expect(src).toMatch(/@if\(hasIcon && iconLeading\)/);
    expect(src).toMatch(/@if\(hasIcon && !iconLeading\)/);
    expect(src).toContain('data-slot="link-icon"');
  });

  test("composes a trailing badge when badge is non-blank", () => {
    expect(src).toContain("var hasBadge = badge != null && !badge.isBlank();");
    expect(src).toContain("@template.lievit.badge(variant = badgeVariant, label = badge)");
    expect(src).toContain('data-slot="link-badge"');
  });
});

describe("link -- target safety & a11y", () => {
  test("newTab opens target=_blank with rel=noopener noreferrer, else neither attribute", () => {
    expect(src).toContain('target="${newTab ? "_blank" : null}"');
    expect(src).toContain('rel="${newTab ? "noopener noreferrer" : null}"');
  });

  test("the icon is decorative (aria-hidden) -- the label names the destination", () => {
    expect(src).toMatch(/data-slot="link-icon" aria-hidden="true"/);
  });

  test("focus-visible ring is token-driven", () => {
    expect(src).toContain("focus-visible:shadow-[var(--lv-ring)]");
  });
});

describe("link -- hygiene (token-driven, CSP-clean)", () => {
  test("no inline <script> and ZERO inline on* handlers (strict CSP refuses them)", () => {
    expect(src).not.toMatch(/<script/i);
    const inlineHandlers = src.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });

  test("never reaches for Font Awesome / wa-icon / Lit", () => {
    expect(src.toLowerCase()).not.toMatch(/font-?awesome|wa-icon|fa-/);
    expect(src.toLowerCase()).not.toMatch(/customelement|litelement|import .*\blit\b/);
  });

  test("styling is token-driven (no bare hex colours, no raw px spacing)", () => {
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    const stripped = src
      .replace(/\[[^\]]*\]/g, "[]")
      .replace(/var\(--lv-[^)]*\)/g, "");
    const numericUtils = stripped.match(/\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mb|mt|gap|h|w|text|size|space)-[1-9]/g) ?? [];
    expect(numericUtils, `non-token numeric utilities: ${numericUtils.join(", ")}`).toEqual([]);
  });
});
