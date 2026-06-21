/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * slide-over = the STATIC shadcn Sheet (ADR-0012 overlay family). A modal panel that slides in from a
 * viewport edge (right | left | top | bottom), trigger-driven, built on the native HTML <dialog>
 * element -- the modal partial pinned to an edge. The browser owns modal show/hide, focus-trap,
 * ::backdrop and Escape; close paths are native <form method="dialog"> submits. ZERO JS, no
 * enhancer -> CSP-clean by construction. It is the static presentation shell behind the kit's
 * edge-anchored panels (io.lievit.kit.SlideOver, ModalConfig.asSlideOver()).
 *
 * These tests pin the registry item shape + server-purity + render-asserting source contract: the
 * body CONTENT is present in the DOM (owned ${content}, never a <slot>), the data-slot/data-side
 * contract is shadcn-faithful, the dialog a11y is explicit, the partial is token-driven + CSP-clean
 * + Apache-licensed. The native <dialog> show/hide is the browser's, not unit-testable in happy-dom.
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
const stripComments = (jte: string) => jte.replace(/<%--[\s\S]*?--%>/g, "");

const jte = read("jte/slide-over.jte");
const markup = stripComments(jte);

describe("slide-over registry:jte item shape (the native <dialog> sheet)", () => {
  test("slide-over is a single registry:jte item", () => {
    const matches = registry.items.filter((i) => i.name === "slide-over");
    expect(matches, "exactly one slide-over item").toHaveLength(1);
    expect(matches[0].type).toBe("registry:jte");
  });

  test("it ships one .jte file landing under the adopter's JTE root", () => {
    const item = registry.items.find((i) => i.name === "slide-over")!;
    const file = item.files.find((f) => f.target.endsWith(".jte"))!;
    expect(file.root).toBe("jte");
    expect(file.target).toBe("lievit/slide-over.jte");
  });

  test("resolving it pulls tokens + icon, never Lit/floating-ui", () => {
    const item = registry.items.find((i) => i.name === "slide-over")!;
    expect(item.dependencies ?? []).not.toContain("lit");
    expect(item.dependencies ?? []).not.toContain("@floating-ui/dom");
    const closure = resolve(registry, ["slide-over"]).map((i) => i.name);
    expect(closure).toContain("tokens");
    expect(closure).toContain("icon");
    expect(closure.indexOf("icon")).toBeLessThan(closure.indexOf("slide-over"));
  });
});

describe("slide-over.jte: native <dialog> show/hide, zero JS", () => {
  test("show is the native invoker command API (same seam as modal)", () => {
    expect(markup).toContain('command="show-modal"');
    expect(markup).toContain('commandfor="${id}"');
  });

  test("the panel is a native <dialog> whose id matches the commandfor target", () => {
    expect(markup).toMatch(/<dialog[\s\n]/);
    expect(markup).toContain('id="${id}"');
  });

  test("close paths are native <form method=\"dialog\"> submits (close button + backdrop)", () => {
    expect(markup).toContain('method="dialog"');
    expect(markup).toContain('data-slot="sheet-close"');
    expect(markup).toContain('data-slot="sheet-backdrop"');
  });
});

describe("slide-over.jte: shadcn Sheet data-slot + data-side contract", () => {
  test("it stamps the shadcn sheet data-slot names", () => {
    for (const slot of [
      "sheet",
      "sheet-trigger",
      "sheet-content",
      "sheet-header",
      "sheet-title",
      "sheet-description",
      "sheet-footer",
      "sheet-close",
    ]) {
      expect(markup, `missing data-slot="${slot}"`).toContain(`data-slot="${slot}"`);
    }
  });

  test("the slide-in edge rides data-side and supports all four sides (kit SlideOver right)", () => {
    expect(markup).toContain('data-side="${edge}"');
    expect(jte).toContain('@param String side = "right"');
    // the side switch covers every shadcn Sheet edge.
    for (const edge of ["left", "top", "bottom", "right"]) {
      expect(jte, `side switch missing "${edge}"`).toContain(`"${edge}"`);
    }
  });
});

describe("slide-over.jte: WAI-ARIA APG Dialog a11y", () => {
  test("the panel carries role=dialog + aria-modal + aria-labelledby/aria-describedby", () => {
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain("aria-labelledby=");
    expect(markup).toContain("aria-describedby=");
  });

  test("a heading-less panel falls back to an explicit aria-label (no nameless dialog)", () => {
    expect(markup).toContain('aria-label="${hasHeading ? null : "Sheet"}"');
  });
});

describe("slide-over.jte: server-pure + CSP-clean + token-driven + licensed", () => {
  test("the body is an owned server-rendered slot, never a native <slot>", () => {
    expect(jte).toContain("@param gg.jte.Content content");
    expect(markup).toContain("${content}");
    expect(markup).not.toMatch(/<slot[\s>]/);
  });

  test("it is CSP-clean: no inline <script>, no inline on* handler", () => {
    expect(jte).not.toMatch(/<script/i);
    expect(markup).not.toMatch(/\son[a-z]+=/i);
  });

  test("it is token-driven: --lv-* tokens only, no raw hex colours", () => {
    expect(markup).toContain("var(--lv-color-bg)");
    expect(markup).toContain("var(--lv-z-modal)");
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test("it carries the Apache licence header", () => {
    expect(jte).toContain("Licensed under the Apache License, Version 2.0");
  });
});
