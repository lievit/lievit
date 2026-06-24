/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * lievit-ui alert.jte -- the action slot + banner + closable additions (v-next reforge).
 *
 * The original callout-footer suite tested a "Filament Callout footer" extension on the OLD
 * alert API (heading/description Content slots, urgent-based role, footer param). The v-next
 * reforge replaced that API entirely:
 *   - `heading` (String) + `description` (Content) → gone; replaced by `title` (String, renders
 *     as <p>) for an optional heading and a single `content` (Content) body slot.
 *   - `footer` param → never landed; the "controls after the body" intent maps to the existing
 *     `action` slot (data-slot="alert-action"), which is the inline-action region after content.
 *   - Role derivation → auto-derived from variant (_autoRole), with explicit `role` override and
 *     role="none" suppression (_emitRole). No more `urgent ? "alert" : "status"` expression.
 *   - New additions: `closable` (dismiss <button>), `banner` (full-bleed left-stripe layout).
 *
 * This suite now pins the v-next action slot, banner mode, and closable contracts.
 * Source-as-text assertions; the real-compiler golden runs out of band.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "alert.jte"), "utf8");
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

describe("alert v-next -- action slot (the 'controls after body' region)", () => {
  test("declares an optional gg.jte.Content action param defaulting to null", () => {
    // The action slot is the inline-action region rendered after the body content.
    expect(src).toContain("@param gg.jte.Content action = null");
  });

  test("renders the action region only when action is set (purely additive)", () => {
    expect(src).toContain("@if(action != null)");
    expect(markup).toContain('data-slot="alert-action"');
    expect(markup).toContain("${action}");
  });

  test("the action slot sits inside the body column (col 2), after the content", () => {
    // alert-content precedes alert-action in the markup order (both are inside alert-body / col 2).
    const contentIdx = markup.lastIndexOf('data-slot="alert-content"');
    const actionIdx = markup.lastIndexOf('data-slot="alert-action"');
    expect(actionIdx).toBeGreaterThan(-1);
    expect(actionIdx, "action must render after the content").toBeGreaterThan(contentIdx);
  });

  test("the action wrapper uses flex layout with token-driven spacing", () => {
    const actionIdx = markup.lastIndexOf('data-slot="alert-action"');
    const actionBlock = markup.slice(actionIdx, actionIdx + 300);
    expect(actionBlock).toContain("display:flex");
    expect(actionBlock).toContain("align-items:center");
    expect(actionBlock).toContain("var(--lv-space-");
  });

  test("the usage doc shows an alert with the action slot wired", () => {
    // The doc comment shows closable usage with attrs wiring the dismiss action.
    expect(src).toContain("closable = true");
    expect(src).toContain("@@template.lievit.alert(");
  });
});

describe("alert v-next -- BACK-COMPAT: new API contract is fully in place", () => {
  test("the v-next param API: title(String), icon(boolean), closable, banner, role, action", () => {
    // These are the params that REPLACED the old heading/description/footer API.
    expect(src).toContain('@param String variant = "info"');
    expect(src).toContain("@param String title = null");
    expect(src).toContain("@param boolean icon = true");
    expect(src).toContain("@param boolean closable = false");
    expect(src).toContain("@param boolean banner = false");
    expect(src).toContain("@param String role = null");
    expect(src).toContain("@param gg.jte.Content action = null");
    expect(src).toContain("@param gg.jte.Content content");
    // Old params gone:
    expect(src).not.toContain("@param String heading");
    expect(src).not.toContain("@param gg.jte.Content description");
    expect(src).not.toContain("@param gg.jte.Content footer");
  });

  test("severity still drives the live role (destructive/warning assertive, info/success polite)", () => {
    // v-next mechanism: _autoRole = (warning|destructive) ? "alert" : "status"; _effectiveRole
    // applies explicit `role` override; _emitRole suppresses role="none".
    expect(src).toContain('("warning".equals(variant) || "destructive".equals(variant)) ? "alert" : "status"');
    expect(src).toMatch(/"destructive"\.equals\(variant\)/);
    expect(src).toMatch(/"warning"\.equals\(variant\)/);
    // The rendered role attribute uses the new conditional emission pattern:
    expect(markup).toContain('role="${_emitRole ? _effectiveRole : null}"');
  });

  test("alert-title still renders before the body content (alert-content), and the action slot exists", () => {
    // v-next slot order: alert-title (optional) → alert-content (body) → alert-action (optional).
    const titleIdx = markup.lastIndexOf('data-slot="alert-title"');
    const contentIdx = markup.lastIndexOf('data-slot="alert-content"');
    expect(titleIdx).toBeGreaterThan(-1);
    expect(contentIdx).toBeGreaterThan(-1);
    expect(titleIdx, "title must render before content").toBeLessThan(contentIdx);
    expect(markup).toContain('data-slot="alert-action"');
  });

  test("the action slot does NOT displace the body content -- alert-content precedes alert-action", () => {
    const contentIdx = markup.lastIndexOf('data-slot="alert-content"');
    const actionIdx = markup.lastIndexOf('data-slot="alert-action"');
    expect(contentIdx).toBeGreaterThan(-1);
    expect(actionIdx).toBeGreaterThan(contentIdx);
  });

  test("still ships no inline <script> / on* handlers (CSP-clean)", () => {
    expect(src).not.toMatch(/<script/i);
    const inlineHandlers = markup.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });
});
