/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * modal = the STATIC shadcn Dialog (ADR-0012 overlay family). A centred, trigger-driven modal
 * dialog built on the native HTML <dialog> element: the trigger opens it declaratively
 * (command="show-modal" commandfor, like popovertarget), the browser owns the modal show/hide,
 * focus-trap, ::backdrop and Escape, and every close path is a native <form method="dialog">
 * submit. ZERO JS, no enhancer -> CSP-clean by construction. It is the presentation shell the
 * kit's modal stack renders through (io.lievit.kit.component.ModalView + io.lievit.kit.ModalConfig).
 *
 * These tests pin the registry item shape + the server-purity + the render-asserting source
 * contract: the body CONTENT is present in the rendered DOM (an owned ${content}, never a <slot> --
 * the bug ADR-0012 exists to kill), the data-slot contract is shadcn-faithful, the dialog a11y is
 * explicit, and the partial is token-driven + CSP-clean + Apache-licensed. The native <dialog>
 * show/hide is the browser's, not unit-testable in happy-dom; its real-compile is the JTE smoke.
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

const jte = read("jte/modal.jte");
const markup = stripComments(jte);

describe("modal registry:jte item shape (the native <dialog> seam)", () => {
  test("modal is a single registry:jte item", () => {
    const matches = registry.items.filter((i) => i.name === "modal");
    expect(matches, "exactly one modal item").toHaveLength(1);
    expect(matches[0].type).toBe("registry:jte");
  });

  test("it ships one .jte file landing under the adopter's JTE root", () => {
    const item = registry.items.find((i) => i.name === "modal")!;
    const file = item.files.find((f) => f.target.endsWith(".jte"))!;
    expect(file.root).toBe("jte");
    expect(file.target).toBe("lievit/modal.jte");
  });

  test("resolving it pulls tokens + icon, never Lit/floating-ui", () => {
    const item = registry.items.find((i) => i.name === "modal")!;
    expect(item.dependencies ?? []).not.toContain("lit");
    expect(item.dependencies ?? []).not.toContain("@floating-ui/dom");
    const closure = resolve(registry, ["modal"]).map((i) => i.name);
    expect(closure).toContain("tokens");
    expect(closure).toContain("icon");
    expect(closure.indexOf("icon")).toBeLessThan(closure.indexOf("modal"));
  });
});

describe("modal.jte: native <dialog> show/hide, zero JS", () => {
  test("show is the native invoker command API (no script)", () => {
    // the trigger is a real <button command="show-modal" commandfor> targeting the dialog id.
    expect(markup).toContain('command="show-modal"');
    expect(markup).toContain('commandfor="${id}"');
  });

  test("the panel is a native <dialog> whose id matches the commandfor target", () => {
    expect(markup).toMatch(/<dialog[\s\n]/);
    expect(markup).toContain('id="${id}"');
  });

  test("every close path is a native <form method=\"dialog\"> submit (close button + backdrop)", () => {
    expect(markup).toContain('method="dialog"');
    expect(markup).toContain('data-slot="dialog-close"');
    expect(markup).toContain('data-slot="dialog-backdrop"');
  });
});

describe("modal.jte: shadcn data-slot contract", () => {
  test("it stamps the shadcn dialog data-slot names", () => {
    for (const slot of [
      "dialog-trigger",
      "dialog",
      "dialog-content",
      "dialog-header",
      "dialog-title",
      "dialog-description",
      "dialog-footer",
      "dialog-close",
    ]) {
      expect(markup, `missing data-slot="${slot}"`).toContain(`data-slot="${slot}"`);
    }
  });

  test("the width token rides data-width (kit Width / ModalWidth parity)", () => {
    expect(markup).toContain('data-width="${width}"');
    expect(jte).toContain('@param String width = "md"');
  });
});

describe("modal.jte: WAI-ARIA APG Dialog a11y", () => {
  test("the dialog carries role=dialog + aria-modal + aria-labelledby/aria-describedby", () => {
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain("aria-labelledby=");
    expect(markup).toContain("aria-describedby=");
  });

  test("a heading-less dialog falls back to an explicit aria-label (no nameless dialog)", () => {
    expect(markup).toContain('aria-label="${hasHeading ? null : "Dialog"}"');
  });
});

describe("modal.jte: server-pure + CSP-clean + token-driven + licensed", () => {
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
