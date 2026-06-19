/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Static JTE partial, Wave 4 (ADR-0012 server-first pivot): the badge DISPLAY island
 * converted to a JTE partial. Its Lit island (registry/components/badge) was removed; the
 * partial registry/jte/badge.jte is the to-be form, and the kit's Cell.Badge + the blocks
 * rewrite depend on it.
 *
 * Like the static-partials-w1a suite, this Node harness has no JTE compiler, so it asserts on
 * the partial SOURCE as text: the @param API, the variant-to-token mapping, the label /
 * content slot, token-driven styling (no hardcoded hex), the JTE comment syntax, and that no
 * inline <script> / on* handler ships (the strict CSP refuses them). The real-compiler golden
 * runs out of band via `npm run test:jte-compile` (gg.jte 3.2.4 precompileAll).
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (name: string) => readFileSync(join(jteDir, `${name}.jte`), "utf8");

describe("badge (server-first JTE partial; the <lv-badge> island is gone)", () => {
  const src = read("badge");

  test("ships and carries a usage-doc comment (<%-- --%> syntax) with the @param API + a call snippet", () => {
    expect(src, "missing <%-- --%> jte comment block").toContain("<%--");
    expect(src, "comment block must close").toContain("--%>");
    expect(src, "must NOT use the @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src, "missing Usage section").toMatch(/Usage:/);
    expect(src, "usage snippet must show the @template call").toContain("@@template.badge(");
    expect(src, "missing param declaration").toMatch(/@param /);
  });

  test("declares the documented param API: variant + label + a content slot", () => {
    expect(src).toContain("@param String variant");
    expect(src).toContain("@param String label");
    expect(src).toContain("@param gg.jte.Content content");
  });

  test("variant maps to a status-token fill + foreground pair (success/warning/danger/info), neutral default", () => {
    expect(src).toContain("var(--lv-color-success)");
    expect(src).toContain("var(--lv-color-success-fg)");
    expect(src).toContain("var(--lv-color-warning)");
    expect(src).toContain("var(--lv-color-danger)");
    expect(src).toContain("var(--lv-color-info)");
    // neutral default reads the surface fill + muted foreground tokens
    expect(src).toContain("var(--lv-color-surface)");
    expect(src).toContain("var(--lv-color-muted)");
  });

  test("keeps the lv-badge--<variant> class hook the island used so existing CSS still applies", () => {
    expect(src).toContain("lv-badge lv-badge--${variant}");
    expect(src).toContain('data-variant="${variant}"');
  });

  test("the label renders, with the content slot taking precedence when supplied", () => {
    expect(src).toContain("@if(content != null)${content}@else${label}@endif");
  });

  test("renders a plain <span> pill (a status pill is decorative text, no live-region role)", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<span[\s\n]/);
    expect(markup).not.toMatch(/role=/);
  });

  test("styling is token-driven: no hardcoded hex, no Lit residue, no inline script/handler", () => {
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src.toLowerCase()).not.toMatch(/customelement|litelement|adoptlightstyles|import .*\blit\b/);
    expect(src).not.toMatch(/<script/i);
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup, "inline on* handler (CSP refuses them)").not.toMatch(/\son[a-z]+=/i);
  });

  test("never reaches for Font Awesome / wa-icon", () => {
    expect(src.toLowerCase()).not.toMatch(/font-?awesome|wa-icon|fa-/);
  });
});
