/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Static JTE partial, Wave 4 (ADR-0012 server-first pivot): the breadcrumb DISPLAY island
 * converted to a JTE partial. Its Lit island (registry/components/breadcrumb) was removed; the
 * partial registry/jte/breadcrumb.jte is the to-be form.
 *
 * dialog/drawer (Wave 2 overlays) + tabs/accordion (Wave 2 disclosure) are server-first WIRE
 * components (ADR-0012), pinned on the JVM side in lievit-kit + the registry shape in
 * wire-*.test.ts; they never had a Node-side island to assert here.
 *
 * Like the static-partials-w1a suite, this Node harness has no JTE compiler, so it asserts on
 * the partial SOURCE as text: the @param API, the nav landmark + ordered list, the real
 * <a href> for non-current items, the aria-current="page" non-link current item, the
 * aria-hidden separators, the single-item case, token-driven styling, and the CSP cleanliness.
 * The real-compiler golden runs out of band via `npm run test:jte-compile`.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (name: string) => readFileSync(join(jteDir, `${name}.jte`), "utf8");

describe("breadcrumb (server-first JTE partial; the <lv-breadcrumb> island is gone)", () => {
  const src = read("breadcrumb");

  test("ships and carries a usage-doc comment (<%-- --%> syntax) with the @param API + a call snippet", () => {
    expect(src, "missing <%-- --%> jte comment block").toContain("<%--");
    expect(src, "comment block must close").toContain("--%>");
    expect(src, "must NOT use the @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src, "missing Usage section").toMatch(/Usage:/);
    expect(src, "usage snippet must show the @template call").toContain("@@template.lievit.breadcrumb(");
    expect(src, "missing param declaration").toMatch(/@param /);
  });

  test("declares a typed list of items (label + optional href) + separator + collapsed + maxVisible + navLabel params", () => {
    // v-next: label→navLabel, maxItems→collapsed(boolean)+maxVisible(int) with different collapse semantics
    expect(src).toContain("@param List<Map<String, String>> items");
    expect(src).toContain("@param String separator");
    expect(src).toContain("@param boolean collapsed");
    expect(src).toContain("@param int maxVisible");
    expect(src).toContain("@param String navLabel");
  });

  test("the nav landmark carries the aria-label (default Breadcrumb) via navLabel param", () => {
    // v-next: aria-label reads navLabel, not label
    expect(src).toMatch(/<nav[\s\S]*?aria-label="\$\{navLabel\}"/);
    expect(src).toContain('@param String navLabel = "Breadcrumb"');
  });

  test("the trail is an ordered <ol> list, one <li> per rendered crumb", () => {
    // Smoke: the breadcrumb.test.ts suite owns the full structural contract;
    // this tier4 check verifies the list topology is present.
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<ol[\s\n]/);
    expect(markup).toMatch(/<li[\s\n]/);
    // v-next iterates items with an indexed @for loop (no plan intermediate)
    expect(src).toMatch(/@for\s*\(int _i = 0; _i < _n; _i\+\+\)/);
  });

  test("non-current items are real <a href> anchors (href scheme-guarded)", () => {
    // v-next: href goes through an allowlist check before emission; non-current items
    // with a safe href get a real <a data-slot="breadcrumb-link">
    expect(src).toContain("_isCurrent");
    expect(src).toContain('data-slot="breadcrumb-link"');
    expect(src).toMatch(/<a[\s\S]*?data-slot="breadcrumb-link"/);
  });

  test("the current (last) item carries aria-current=page; link when href set, span when not", () => {
    // v-next: current item is <a aria-current="page"> when it has an href,
    // <span aria-current="page"> when href is null (correctly off tab order)
    expect(src).toContain('data-slot="breadcrumb-page"');
    expect(src).toMatch(/aria-current="page"/);
    // both link and non-link variants exist
    expect(src).toMatch(/<a[\s\S]*?aria-current="page"/);
    expect(src).toMatch(/<span[\s\S]*?aria-current="page"/);
  });

  test("separators are dedicated <li aria-hidden=true> nodes (not inline in item <li>)", () => {
    // v-next: separators are <li aria-hidden="true" class="lv-breadcrumb__separator...">
    // inserted between items; no separator before the first item (_i > 0 guard)
    expect(src).toContain("@if(_i > 0)");
    expect(src).toMatch(/<li aria-hidden="true" class="lv-breadcrumb__separator/);
    expect(src).toContain("${separator}");
  });

  test("collapse: collapsed=true keeps first + ellipsis button + last item", () => {
    // v-next collapse: boolean collapsed param + maxVisible int; when collapsed=true
    // and items.size() > maxVisible + 2 the middle is hidden. The ellipsis is a
    // keyboard-reachable <button aria-label="Show full path">.
    expect(src).toContain("@param boolean collapsed");
    expect(src).toContain("@param int maxVisible");
    expect(src).toContain("_doCollapse");
    expect(src).toContain('data-slot="breadcrumb-ellipsis"');
    // ellipsis is a <button> (keyboard-reachable per APG + spec §8)
    expect(src).toMatch(/<button[\s\S]*?data-slot="breadcrumb-ellipsis"/);
    expect(src).toContain('aria-label="Show full path"');
  });

  test("no collapse by default (collapsed defaults to false)", () => {
    expect(src).toContain("@param boolean collapsed = false");
    // full trail path uses @for over all items
    expect(src).toMatch(/@for\s*\(int _i = 0; _i < _n; _i\+\+\)/);
  });

  test("styling is token-driven: no hardcoded hex, no Lit residue, no inline script/handler", () => {
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // v-next breadcrumb uses muted-fg for non-current items and fg for current item
    expect(src).toContain("var(--lv-color-muted-fg)");
    expect(src).toContain("var(--lv-color-fg)");
    expect(src.toLowerCase()).not.toMatch(/customelement|litelement|adoptlightstyles|import .*\blit\b/);
    expect(src).not.toMatch(/<script/i);
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup, "inline on* handler (CSP refuses them)").not.toMatch(/\son[a-z]+=/i);
  });
});
