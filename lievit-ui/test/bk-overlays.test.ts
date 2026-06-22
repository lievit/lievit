/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Backlog overlays (bk-overlays): the additive partials that close the gest/kit pains.
 *   1. dropdown-menu/item gains the SAFE wireClick + wireArgs channel (button.jte's pattern) so a
 *      per-row wire menu item no longer forces a hand-rolled <button>.
 *   2. alert-dialog-static: the static <dialog> confirmation prompt (role=alertdialog, no
 *      backdrop-dismiss) -- the static sibling of the wire alert-dialog.
 *   3. command-palette: the static searchable command list -- the static sibling of the wire command.
 * Source-shape assertions on the registry; the render is the jte-compile smoke's job, the enhancer
 * behaviour lives in command-enhancer.test.ts.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRegistry } from "../cli/build-registry.js";
import { resolve, type Registry } from "../cli/registry.js";

const registryRoot = join(import.meta.dirname, "..", "registry");
const registry: Registry = buildRegistry(registryRoot);
const read = (rel: string) => readFileSync(join(registryRoot, rel), "utf8");
const stripDoc = (jte: string) => jte.replace(/<%--[\s\S]*?--%>/g, "");

describe("1. dropdown-menu/item SAFE wire channel", () => {
  const item = read("jte/dropdown-menu/item.jte");
  const markup = stripDoc(item);

  test("declares wireClick + wireArgs params (back-compat: href/formAction stay)", () => {
    expect(item).toContain("@param String wireClick = null");
    expect(item).toContain("@param java.util.Map<String, String> wireArgs");
    // back-compat: the navigation + form-action params are untouched.
    expect(item).toContain("@param String href = \"\"");
    expect(item).toContain("@param String formAction = \"\"");
  });

  test("emits l:click from wireClick on both the <a> and the <button> branch", () => {
    expect((markup.match(/l:click="\$\{wire\}"/g) ?? []).length).toBe(2);
  });

  test("wireArgs are HTML-escaped into data-* via Escape.htmlAttribute (button.jte's pattern)", () => {
    expect(item).toContain("import gg.jte.html.escape.Escape");
    expect(item).toContain("Escape.htmlAttribute(");
    // key allowlist (attribute-NAME position is not escaped, so a non-identifier key is dropped).
    expect(item).toContain("matches(\"[A-Za-z][A-Za-z0-9-]*\")");
    // the escaped fragment is emitted with $unsafe (safe: every value already escaped) on both branches.
    expect((markup.match(/\$unsafe\{wireArgsMarkup\}/g) ?? []).length).toBe(2);
  });

  test("a wireClick-only item is still type=button (must not submit a form)", () => {
    // the button type is driven by formId/formAction only, so wireClick keeps type=button.
    expect(item).toContain('type="${formId.isEmpty() && formAction.isEmpty() ? "button" : "submit"}"');
  });
});

describe("2. alert-dialog-static partial", () => {
  test("registers as a registry:jte item named alert-dialog-static (no collision with the wire alert-dialog)", () => {
    const names = registry.items.map((i) => i.name);
    expect(names).toContain("alert-dialog-static");
    expect(names).toContain("alert-dialog"); // the wire variant is untouched
    const item = registry.items.find((i) => i.name === "alert-dialog-static")!;
    expect(item.type).toBe("registry:jte");
  });

  test("is a native <dialog> alert prompt: role=alertdialog, NO backdrop, Cancel + Action footer", () => {
    const jte = read("jte/alert-dialog.jte");
    const markup = stripDoc(jte);
    expect(markup).toContain("<dialog");
    expect(markup).toContain('role="alertdialog"');
    expect(markup).toContain('aria-modal="true"');
    // declarative open via the invoker command API (like the modal partial), no JS.
    expect(markup).toContain('command="show-modal"');
    // the only exits are explicit Cancel + Action; close paths are native <form method="dialog">.
    expect(markup).toContain('data-slot="alert-dialog-cancel"');
    expect(markup).toContain('data-slot="alert-dialog-action"');
    expect(markup).toContain('method="dialog"');
    // an interruptive prompt: NO backdrop-dismiss button, NO header close (x) -- unlike modal.jte.
    expect(markup).not.toContain('data-slot="dialog-backdrop"');
    expect(markup).not.toContain('data-slot="alert-dialog-close"');
    // CSP-clean: no inline script.
    expect(markup).not.toMatch(/<script/i);
  });

  test("resolving it pulls tokens + the icon partial (triangle-alert for destructive)", () => {
    const closure = resolve(registry, ["alert-dialog-static"]).map((i) => i.name);
    expect(closure).toContain("tokens");
    expect(closure).toContain("icon");
  });
});

describe("3. command-palette static partial", () => {
  test("registers as a registry:jte item named command-palette (no collision with the wire command)", () => {
    const names = registry.items.map((i) => i.name);
    expect(names).toContain("command-palette");
    expect(names).toContain("command"); // the wire variant is untouched
    const item = registry.items.find((i) => i.name === "command-palette")!;
    expect(item.type).toBe("registry:jte");
  });

  test("ships the partial + a CSP-clean enhancer (no inline script), combobox+listbox roles", () => {
    const item = registry.items.find((i) => i.name === "command-palette")!;
    expect(item.files.some((f) => f.path.endsWith("command.jte"))).toBe(true);
    expect(item.files.some((f) => f.path.endsWith("command.enhancer.ts"))).toBe(true);
    const jte = read("jte/command.jte");
    const markup = stripDoc(jte);
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('role="listbox"');
    expect(markup).toContain('role="option"');
    expect(markup).toContain("data-command-label");
    expect(markup).not.toMatch(/<script/i);
    // the enhancer is CSP-clean: addEventListener, no eval/new Function, no Lit/floating-ui import.
    const ts = read("jte/command.enhancer.ts");
    const code = ts.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).toContain("addEventListener");
    expect(code).not.toMatch(/\bnew Function\b|\beval\(/);
    expect(code).not.toMatch(/^import .*(from "lit"|@floating-ui\/dom)/m);
  });

  test("resolving it pulls tokens + the icon partial (search glyph)", () => {
    const closure = resolve(registry, ["command-palette"]).map((i) => i.name);
    expect(closure).toContain("tokens");
    expect(closure).toContain("icon");
  });
});
