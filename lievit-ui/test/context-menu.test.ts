/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * context-menu (issue #445) is now a server-first WIRE component (ADR-0012, Wave 2): the Lit
 * island is gone. Its open-state, pointer position, items and selection live in typed Java
 * (registry/wire/context-menu/ContextMenuComponent.java) rendered by JTE (context-menu.jte),
 * with a tiny CSP-clean typed-TS enhancer (context-menu.ts) for the contextmenu gesture. This
 * test pins the registry:wire mechanism + the server-purity of the source; the render +
 * state-transition behaviour is render-asserted on the JVM in lievit-kit
 * (io.lievit.kit.wire.ContextMenuComponentIT).
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRegistry } from "../cli/build-registry.js";
import { resolve } from "../cli/registry.js";
import type { Registry } from "../cli/registry.js";

const registryRoot = join(import.meta.dirname, "..", "registry");
const registry: Registry = buildRegistry(registryRoot);
const read = (rel: string) => readFileSync(join(registryRoot, rel), "utf8");

describe("context-menu registry:wire item shape", () => {
  test("context-menu is a single registry:wire item (the Lit island is gone)", () => {
    const matches = registry.items.filter((i) => i.name === "context-menu");
    expect(matches, "exactly one context-menu item").toHaveLength(1);
    expect(matches[0].type).toBe("registry:wire");
  });

  test("it carries three files: a .java (java root), a .jte (jte root), a .ts (alias root)", () => {
    const item = registry.items.find((i) => i.name === "context-menu")!;
    const java = item.files.find((f) => f.target.endsWith(".java"))!;
    const jte = item.files.find((f) => f.target.endsWith(".jte"))!;
    const ts = item.files.find((f) => f.target.endsWith(".ts"))!;
    expect(java.root).toBe("java");
    expect(jte.root).toBe("jte");
    // the enhancer is an alias-root file (no java/jte root): it lands like the old island did.
    expect(ts.root).toBeUndefined();
    expect(ts.target).toBe("components/ui/context-menu.ts");
  });

  test("the wire Java holds the state in @Wire fields + @LievitAction open/close", () => {
    const java = read("wire/context-menu/ContextMenuComponent.java");
    expect(java).toContain("@Wire");
    expect(java).toContain("public boolean open");
    expect(java).toContain("public int x");
    expect(java).toContain("public int y");
    expect(java).toContain("@LievitAction");
    expect(java).toContain("void openAt()");
    expect(java).toContain("void close()");
    // the items list is server-derived, kept out of the snapshot (a record list cannot round-trip).
    expect(java).toMatch(/@LievitProperty\(serialize = false\)[\s\S]*?List<Entry> items/);
  });

  test("the wire template is server-pure: no <slot>, no inline <script>, real menu roles", () => {
    const jte = read("wire/context-menu/context-menu.jte");
    const markup = jte.replace(/<%--[\s\S]*?--%>/g, "");
    // the whole reason for the pivot: no native <slot>, no inline script.
    expect(markup).not.toMatch(/<slot[\s>]/);
    expect(markup).not.toMatch(/<script/i);
    // it renders a real menu of real menu items, and an item arms the selection over the wire.
    expect(jte).toContain('role="menu"');
    expect(jte).toContain('role="${entry.role()}"');
    expect(jte).toContain("$set('selectedKey'");
    // the right-clickable region is OWNED markup, not a slot.
    expect(jte).toContain("data-context-menu-trigger");
  });

  test("the enhancer is CSP-clean: addEventListener only, no inline handler, no Lit/floating-ui", () => {
    const ts = read("wire/context-menu/context-menu.ts");
    // strip comments (the doc-comment names lit/floating-ui in prose to explain their absence).
    const code = ts.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).toContain('addEventListener("contextmenu"');
    expect(code).toContain("preventDefault");
    // it drives the component through the runtime $lievit object, never an eval'd string.
    expect(code).toContain("$call(\"openAt\")");
    expect(code).not.toMatch(/\bnew Function\b|\beval\(/);
    // no Lit, no @floating-ui/dom IMPORT (the server-pure positioning is CSS).
    expect(code).not.toMatch(/^import .*(from "lit"|@floating-ui\/dom)/m);
  });

  test("resolving the wire item pulls its tokens + icon partial dependencies", () => {
    const closure = resolve(registry, ["context-menu"]).map((i) => i.name);
    expect(closure).toContain("context-menu");
    expect(closure).toContain("tokens");
    expect(closure).toContain("icon");
    expect(closure.indexOf("icon")).toBeLessThan(closure.indexOf("context-menu"));
  });
});
