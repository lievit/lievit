/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * SAFE per-row wire-action channel on button.jte (the reactive-list fix).
 *
 * A button in a reactive list (admin/users, profile-security: a row per device/session/user)
 * must fire a wire action carrying a per-row, DB-derived argument (a row id, a legacy username).
 * The trusted `attrs` channel is $unsafe, so routing ${row.id()} through it would XSS -- which is
 * why gest hand-rolled <button> in every reactive list. This pins the SAFE channel that removes
 * that debt: wireClick (the action NAME, emitted as l:click="${wireClick}", JTE-escaped in
 * attribute-value position) + wireArgs (a Map<String,String> of per-row args merged into the SAME
 * Escape.htmlAttribute-escaped data-* fragment as dataAttrs). As with the other static-partials
 * suites, this asserts on the partial SOURCE as text; the render/escaping smoke lives in
 * test/jte-compile (XssEscapingTest).
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "button.jte"), "utf8");

describe("button -- SAFE per-row wire-action channel", () => {
  test("declares wireClick (action name) + wireArgs (per-row args) with the documented defaults", () => {
    expect(src, "wireClick param missing").toContain("@param String wireClick = null");
    expect(src, "wireArgs param missing").toContain(
      "@param java.util.Map<String, String> wireArgs = java.util.Map.of()",
    );
  });

  test("wireClick is emitted as l:click=\"${wireClick}\" (JTE escapes the ${} in attribute-value position)", () => {
    // The action NAME rides a ${} in attribute-value position, which JTE HTML-escapes with the
    // SAME htmlAttribute routine -- escaped by construction, NOT via the trusted $unsafe channel.
    expect(src).toMatch(/l:click="\$\{wireClick[^}]*\}"/);
    // It must NEVER be routed through $unsafe (that would be the trusted-only attrs channel).
    expect(src, "wireClick must not reach $unsafe").not.toMatch(/\$unsafe\{[^}]*wireClick/);
  });

  test("l:click renders only when wireClick is set (blank/null collapses to null, attr dropped)", () => {
    // null/blank guard so a plain button (no wire action) does not emit an empty l:click="".
    expect(src).toMatch(/wireClick != null && !wireClick\.isBlank\(\)/);
  });

  test("both branches (<a> and <button>) carry the wireClick l:click directive", () => {
    // count only the rendered markup, not the doc prose that also names l:click="${wireClick}".
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    const sinks = markup.match(/l:click="\$\{wireClick/g) ?? [];
    expect(sinks.length, "l:click=\"${wireClick}\" must be in both <a> and <button> branches").toBe(2);
  });

  test("wireArgs merge into the SAME escaped data-* fragment as dataAttrs (Escape.htmlAttribute)", () => {
    // wireArgs are per-row, DB-derived: they MUST share dataAttrs' escaped fragment, never $unsafe.
    expect(src).toMatch(/putAll\(dataAttrs\)/);
    expect(src).toMatch(/putAll\(wireArgs\)/);
    // the merged map is what the escaping loop iterates (one allowlist + one escaper for both).
    expect(src).toMatch(/for \(var e : dataAttrsMerged\.entrySet\(\)\)/);
    // wireArgs win on a key collision (they are the action's own argument): merged last.
    const dataIdx = src.indexOf("putAll(dataAttrs)");
    const wireIdx = src.indexOf("putAll(wireArgs)");
    expect(dataIdx, "dataAttrs must be merged before wireArgs (wireArgs win on collision)").toBeLessThan(wireIdx);
  });

  test("wireArgs value is escaped via Escape.htmlAttribute, never emitted raw", () => {
    // shares the existing escaped loop -- the value goes through Escape.htmlAttribute, not $unsafe.
    expect(src).toMatch(/Escape\.htmlAttribute\(\s*e\.getValue\(\)/);
    expect(src, "no wireArgs value may reach $unsafe").not.toMatch(/\$unsafe\{[^}]*getValue/);
  });

  test("the escaped data-* fragment is still the only safe dynamic sink (key allowlist preserved)", () => {
    // the key sits in attribute-NAME position (unescaped), so it stays allowlisted to an identifier.
    expect(src).toMatch(/getKey\(\)\.matches\("\[A-Za-z\]\[A-Za-z0-9-\]\*"\)/);
  });

  test("usage doc shows a per-row wire-action call (wireClick + wireArgs with a row arg)", () => {
    expect(src).toContain('wireClick = "revokeDevice"');
    expect(src).toMatch(/wireArgs = java\.util\.Map\.of\("id", row\.id\(\)\)/);
  });

  test("CSP hygiene preserved: no inline <script>, no on* handlers introduced", () => {
    expect(src).not.toMatch(/<script/i);
    const inlineHandlers = src.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });

  test("back-compat: the pre-existing trusted attrs + safe dataAttrs channels are untouched", () => {
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain("@param java.util.Map<String, String> dataAttrs = java.util.Map.of()");
    // the two trusted+escaped sinks per branch still exist (dataAttrs fragment + attrs).
    expect(src).toContain("$unsafe{dataAttrsMarkup}");
    expect(src).toContain("$unsafe{attrs}");
    // pre-existing API params still declared.
    expect(src).toContain('@param String variant = "primary"');
    expect(src).toContain("@param gg.jte.Content content");
  });
});
