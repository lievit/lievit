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

  test("declares a typed list of items (label + optional href) + separator + maxItems + label params", () => {
    expect(src).toContain("@param List<Map<String, String>> items");
    expect(src).toContain("@param String separator");
    expect(src).toContain("@param int maxItems");
    expect(src).toContain("@param String label");
  });

  test("the nav landmark carries the aria-label (default Breadcrumb)", () => {
    expect(src).toMatch(/<nav[\s\S]*?aria-label="\$\{label\}"/);
    expect(src).toContain('@param String label = "Breadcrumb"');
  });

  test("the trail is an ordered <ol> list, one <li> per rendered crumb (driven by a render plan)", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<ol[\s\n]/);
    expect(markup).toMatch(/<li[\s\n]/);
    expect(src).toContain("@for(var pos = 0; pos < plan.size(); pos++)");
  });

  test("non-current items are real <a href> anchors", () => {
    expect(src).toContain("@if(isCurrent)");
    expect(src).toMatch(/<a[\s\S]*?href="\$\{href == null \? "#" : href\}"/);
  });

  test("the current (last) item is aria-current=page and NOT a link", () => {
    expect(src).toContain("!{var isCurrent = idx == n - 1;}");
    // the current branch renders a <span aria-current="page">, not an <a>
    expect(src).toMatch(/<span[^>]*aria-current="page"/);
  });

  test("the separator is rendered between crumbs only (not before the first) and is aria-hidden", () => {
    expect(src).toContain("!{var isFirst = pos == 0;}");
    expect(src).toContain("@if(!isFirst)");
    expect(src).toMatch(/lv-breadcrumb__separator[^"]*"[^>]*aria-hidden="true"/);
    expect(src).toContain("${separator}");
  });

  test("collapse: maxItems>0 + an over-length trail keeps the root + tail and renders one ellipsis", () => {
    // the plan keeps index 0 (root), a -1 sentinel (ellipsis), then the last maxItems-1 crumbs
    expect(src).toContain("var collapse = maxItems > 0 && n > maxItems;");
    expect(src).toContain("!{plan.add(0);}");
    expect(src).toContain("!{plan.add(-1);}");
    expect(src).toContain("var tailStart = n - (maxItems - 1);");
    // the ellipsis item is a decorative BreadcrumbEllipsis with an sr-only "More"
    expect(src).toContain('data-slot="breadcrumb-ellipsis"');
    expect(src).toMatch(/breadcrumb-ellipsis"[\s\S]*?aria-hidden="true"/);
    expect(src).toContain('<span class="sr-only">More</span>');
    expect(src).toContain('@template.lievit.icon(name = "ellipsis"');
  });

  test("no collapse by default (maxItems = 0 renders every crumb)", () => {
    expect(src).toContain("@param int maxItems = 0");
    // when not collapsing the plan is the full 0..n-1 range
    expect(src).toContain("@for(int i = 0; i < n; i++)");
  });

  test("styling is token-driven: no hardcoded hex, no Lit residue, no inline script/handler", () => {
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).toContain("var(--lv-color-primary)");
    expect(src).toContain("var(--lv-color-muted)");
    expect(src.toLowerCase()).not.toMatch(/customelement|litelement|adoptlightstyles|import .*\blit\b/);
    expect(src).not.toMatch(/<script/i);
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup, "inline on* handler (CSP refuses them)").not.toMatch(/\son[a-z]+=/i);
  });
});
