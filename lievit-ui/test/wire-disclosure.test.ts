/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Wave 2 gate (ADR-0012): the three disclosure WIRE components (accordion, tabs, toggle-group),
 * each a `registry:wire` two-file item (Java class + JTE template) that resolves from registry.json
 * and copies into TWO adopter roots (Java source root + JTE templates root). This test pins the
 * registry-side mechanism + server-purity (no <slot>, no inline <script>) so it cannot silently
 * regress; the Java state-transition + render-asserting behaviour is pinned on the JVM side in
 * lievit-kit (AccordionComponentIT / TabsComponentIT / ToggleGroupComponentIT). Mirrors
 * wire-collapsible.test.ts.
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

const WIRE = [
  { name: "accordion", className: "AccordionComponent", template: "accordion.jte" },
  { name: "tabs", className: "TabsComponent", template: "tabs.jte" },
  { name: "toggle-group", className: "ToggleGroupComponent", template: "toggle-group.jte" },
] as const;

let project: string;
let log: string[];
const out = (s: string) => log.push(s);

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), "lievit-wire-disclosure-"));
  log = [];
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
});

describe.each(WIRE)("registry:wire item shape ($name)", ({ name, className }) => {
  test("is exactly one registry:wire item (the Lit island is gone)", () => {
    const matches = registry.items.filter((i) => i.name === name);
    expect(matches, `exactly one ${name} item`).toHaveLength(1);
    expect(matches[0].type).toBe("registry:wire");
  });

  test("carries two files: a .java (java root) and a .jte (jte root)", () => {
    const item = registry.items.find((i) => i.name === name)!;
    expect(item.files).toHaveLength(2);
    const java = item.files.find((f) => f.target.endsWith(".java"))!;
    const jte = item.files.find((f) => f.target.endsWith(".jte"))!;
    expect(java.root).toBe("java");
    expect(jte.root).toBe("jte");
    expect(java.content).toContain(`class ${className}`);
    expect(jte.content).toContain("@param");
  });

  test("the wire template is server-pure: no <slot>, no inline <script>, server $set/l: action", () => {
    const item = registry.items.find((i) => i.name === name)!;
    const jte = item.files.find((f) => f.target.endsWith(".jte"))!.content ?? "";
    const markup = jte.replace(/<%--[\s\S]*?--%>/g, "");
    // the whole reason for the pivot: no native <slot> (inert in light DOM), no inline script.
    expect(markup).not.toMatch(/<slot[\s>]/);
    expect(markup).not.toMatch(/<script/i);
    // it drives the server over the wire (a $set magic arm or an l: action), never a client toggle.
    expect(markup).toMatch(/l:click=/);
  });

  test("the wire Java holds the state in @Wire fields + a @LievitAction", () => {
    const item = registry.items.find((i) => i.name === name)!;
    const java = item.files.find((f) => f.target.endsWith(".java"))!.content ?? "";
    expect(java).toContain("@Wire");
    expect(java).toContain("@LievitAction");
    // the item set is locked server config (a client cannot inject/rename items).
    expect(java).toMatch(/@LievitProperty\(locked = true\)/);
  });

  test("resolving the wire item pulls its token dependency", () => {
    const closure = resolve(registry, [name]).map((i) => i.name);
    expect(closure).toContain(name);
    expect(closure).toContain("tokens");
  });
});

describe.each(WIRE)("lievit add $name: two-root copy-in", ({ name, className, template }) => {
  test("copies the Java into the java root and the JTE into the jte root", () => {
    writeFileSync(
      join(project, "lievit.json"),
      JSON.stringify({ root: "src", roots: { java: "src/main/java", jte: "src/main/jte" } })
    );

    const code = run([name], registry, project, out);
    expect(code).toBe(0);

    const javaDest = join(project, `src/main/java/io/lievit/wire/${className}.java`);
    const jteDest = join(project, `src/main/jte/lievit/${template}`);
    expect(existsSync(javaDest), "Java class under the java root").toBe(true);
    expect(existsSync(jteDest), "JTE template under the jte root").toBe(true);
  });

  test("the copied Java + JTE are byte-identical to the registry source", () => {
    writeFileSync(join(project, "lievit.json"), JSON.stringify({ root: "src" }));
    run([name], registry, project, out);

    const copiedJava = readFileSync(
      join(project, `src/main/java/io/lievit/wire/${className}.java`),
      "utf8"
    );
    const sourceJava = readFileSync(join(registryRoot, `wire/${name}/${className}.java`), "utf8");
    expect(copiedJava).toBe(sourceJava);

    const copiedJte = readFileSync(join(project, `src/main/jte/lievit/${template}`), "utf8");
    const sourceJte = readFileSync(join(registryRoot, `wire/${name}/${template}`), "utf8");
    expect(copiedJte).toBe(sourceJte);
  });
});
