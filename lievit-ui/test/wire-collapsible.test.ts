/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Wave 0 gate (ADR-0012): the `registry:wire` two-file copy-in mechanism, proven end-to-end
 * with the first wire component (collapsible). A wire component is a Java class + a JTE template
 * that must resolve from registry.json and copy into TWO different adopter roots (Java source
 * root + JTE templates root). This test pins the mechanism so it cannot silently regress; the
 * Java state-transition + render behaviour is pinned on the JVM side in lievit-kit
 * (CollapsibleComponentIT).
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildRegistry } from "../cli/build-registry.js";
import { resolve } from "../cli/registry.js";
import { run } from "../cli/lievit-add.js";
import type { Registry } from "../cli/registry.js";

const registryRoot = join(import.meta.dirname, "..", "registry");
const registry: Registry = buildRegistry(registryRoot);

let project: string;
let log: string[];
const out = (s: string) => log.push(s);

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), "lievit-wire-"));
  log = [];
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
});

describe("registry:wire item shape", () => {
  test("collapsible is a single registry:wire item (the Lit island is gone)", () => {
    const matches = registry.items.filter((i) => i.name === "collapsible");
    expect(matches, "exactly one collapsible item").toHaveLength(1);
    expect(matches[0].type).toBe("registry:wire");
  });

  test("the wire item carries two files: a .java (java root) and a .jte (jte root)", () => {
    const item = registry.items.find((i) => i.name === "collapsible")!;
    expect(item.files).toHaveLength(2);
    const java = item.files.find((f) => f.target.endsWith(".java"))!;
    const jte = item.files.find((f) => f.target.endsWith(".jte"))!;
    expect(java.root).toBe("java");
    expect(jte.root).toBe("jte");
    // both carry inlined content with the Apache header (the registry-json gate also checks this)
    expect(java.content).toContain("class CollapsibleComponent");
    expect(jte.content).toContain("@param");
  });

  test("the wire template is server-pure: no <slot>, no inline <script>, l:click action", () => {
    const item = registry.items.find((i) => i.name === "collapsible")!;
    const jte = item.files.find((f) => f.target.endsWith(".jte"))!.content ?? "";
    // the whole reason for the pivot: no native <slot> (inert in light DOM), no inline script.
    const markup = jte.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).not.toMatch(/<slot[\s>]/);
    expect(markup).not.toMatch(/<script/i);
    // it fires the server action and renders an OWNED body region (server-rendered), not a <slot>:
    // the wire runtime renders the template with only @Wire fields + _component, so the body is
    // owned markup the adopter edits, never a call-time JTE Content slot.
    expect(jte).toContain('l:click="toggle"');
    expect(jte).toContain("data-collapsible-region");
  });

  test("the wire Java holds the state in @Wire fields + a @LievitAction toggle", () => {
    const item = registry.items.find((i) => i.name === "collapsible")!;
    const java = item.files.find((f) => f.target.endsWith(".java"))!.content ?? "";
    expect(java).toContain("@Wire");
    expect(java).toContain("public boolean open");
    expect(java).toContain("@LievitAction");
    expect(java).toContain("void toggle()");
    // disabled is locked: a client cannot enable a server-disabled trigger.
    expect(java).toMatch(/@LievitProperty\(locked = true\)[\s\S]*?public boolean disabled/);
  });

  test("resolving the wire item pulls its tokens + icon partial dependencies", () => {
    const closure = resolve(registry, ["collapsible"]).map((i) => i.name);
    expect(closure).toContain("collapsible");
    expect(closure).toContain("tokens");
    expect(closure).toContain("icon");
    // dependencies come before the dependent (topological order).
    expect(closure.indexOf("icon")).toBeLessThan(closure.indexOf("collapsible"));
  });
});

describe("lievit add collapsible: two-root copy-in", () => {
  test("copies the Java into the java root and the JTE into the jte root", () => {
    writeFileSync(
      join(project, "lievit.json"),
      JSON.stringify({ root: "src", roots: { java: "src/main/java", jte: "src/main/jte" } })
    );

    const code = run(["collapsible"], registry, project, out);
    expect(code).toBe(0);

    // the wire component's two files land under their respective roots...
    const javaDest = join(project, "src/main/java/io/lievit/wire/CollapsibleComponent.java");
    const jteDest = join(project, "src/main/jte/lievit/collapsible.jte");
    expect(existsSync(javaDest), "Java class under the java root").toBe(true);
    expect(existsSync(jteDest), "JTE template under the jte root").toBe(true);

    // ...the icon partial dependency lands under the jte root too...
    expect(existsSync(join(project, "src/main/jte/lievit/icon.jte")), "icon partial").toBe(true);

    // ...and the tokens (alias root, the legacy single-root behaviour, unchanged).
    expect(existsSync(join(project, "src/styles/lievit-tokens.css")), "tokens").toBe(true);
  });

  test("the copied Java + JTE are byte-identical to the registry source", () => {
    writeFileSync(join(project, "lievit.json"), JSON.stringify({ root: "src" }));
    run(["collapsible"], registry, project, out);

    const copiedJava = readFileSync(
      join(project, "src/main/java/io/lievit/wire/CollapsibleComponent.java"),
      "utf8"
    );
    const sourceJava = readFileSync(
      join(registryRoot, "wire/collapsible/CollapsibleComponent.java"),
      "utf8"
    );
    expect(copiedJava).toBe(sourceJava);

    const copiedJte = readFileSync(join(project, "src/main/jte/lievit/collapsible.jte"), "utf8");
    const sourceJte = readFileSync(join(registryRoot, "wire/collapsible/collapsible.jte"), "utf8");
    expect(copiedJte).toBe(sourceJte);
  });

  test("defaults the java/jte roots when lievit.json omits them (presentation-only config)", () => {
    // a bare { root: "src" } config: the wire roots fall back to src/main/{java,jte}.
    writeFileSync(join(project, "lievit.json"), JSON.stringify({ root: "src" }));
    run(["collapsible"], registry, project, out);
    expect(
      existsSync(join(project, "src/main/java/io/lievit/wire/CollapsibleComponent.java"))
    ).toBe(true);
    expect(existsSync(join(project, "src/main/jte/lievit/collapsible.jte"))).toBe(true);
  });
});

describe("back-compat: registry:ui add is unaffected by the two-root mechanism", () => {
  test("lievit add button still lands under the single alias root", () => {
    run(["button", "--root", "src"], registry, project, out);
    // a presentation item with no file.root keeps the legacy alias-root resolution.
    expect(existsSync(join(project, "src/components/ui/button.ts"))).toBe(true);
    // it must NOT leak into the java/jte roots.
    expect(existsSync(join(project, "src/main/java"))).toBe(false);
  });
});
