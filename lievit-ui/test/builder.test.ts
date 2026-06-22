/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * builder (Filament Builder): a list of HETEROGENEOUS typed blocks (add-block menu + per-block
 * content), recursive. Three halves: a structural golden over builder.jte (the per-type add menu,
 * the per-type templates host, a11y), over builder/block.jte (the hidden `__type` field + the
 * indexed-array POST contract + remove submit), and the enhancer DOM behaviour (typed add clones the
 * right template, remove drops, both re-index the nested names incl __type contiguous).
 */
import { describe, test, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  enhanceBuilder,
  enhanceAllBuilders,
  reindexFieldName,
} from "../registry/jte/builder.enhancer.js";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (rel: string) => readFileSync(join(jteDir, rel), "utf8");
const markupOf = (rel: string) => read(rel).replace(/<%--[\s\S]*?--%>/g, "");

describe("builder.jte -- heterogeneous typed-block list", () => {
  const src = read("builder.jte");
  const markup = markupOf("builder.jte");

  test("the existing blocks are a RECURSIVE content slot, not hardcoded", () => {
    expect(src).toMatch(/@param gg\.jte\.Content blocksContent/);
    expect(markup).toContain("${blocksContent}");
    expect(markup).toContain("data-builder-blocks");
  });

  test("the add-block menu is a labelled group of per-type submit buttons", () => {
    expect(src).toMatch(/@param java\.util\.Map<String, String> blockTypes/);
    expect(markup).toContain("data-builder-add-menu");
    expect(markup).toContain('data-builder-add="${type.getKey()}"');
    expect(markup).toContain('name="${name}__addblock"');
    expect(markup).toContain('value="${type.getKey()}"');
  });

  test("ships a hidden per-type templates host for the JS-on clone", () => {
    expect(markup).toMatch(/data-builder-templates\s+hidden/);
    expect(markup).toContain("${templates}");
  });

  test("an aria-live region is present for add/remove announcements", () => {
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("data-builder-live");
  });

  test("no inline script or on* handler in the rendered markup (CSP-clean)", () => {
    expect(markup).not.toMatch(/<script/);
    expect(markup).not.toMatch(/\son[a-z]+=/);
  });
});

describe("builder/block.jte -- one typed block card", () => {
  const markup = markupOf("builder/block.jte");

  test("carries a hidden `<name>[<index>][__type]` so the server knows the record shape", () => {
    expect(markup).toContain('name="${name}[${index}][__type]"');
    expect(markup).toContain('value="${type}"');
    expect(markup).toContain("data-builder-block-type");
  });

  test("is a labelled region with a per-block remove submit carrying the index", () => {
    expect(markup).toContain('role="group"');
    expect(markup).toContain('aria-label="${heading} ${index + 1}"');
    expect(markup).toContain('name="${name}__remove"');
    expect(markup).toContain('value="${index}"');
  });

  test("the block body is a recursive content slot", () => {
    expect(markup).toContain("${content}");
    expect(markup).toContain('data-slot="builder-block-body"');
  });
});

describe("reindexFieldName -- the array-name rewrite (inlined, self-contained)", () => {
  test("rewrites the first index segment incl the __type field", () => {
    expect(reindexFieldName("blocchi[3][testo]", "blocchi", 1)).toBe("blocchi[1][testo]");
    expect(reindexFieldName("blocchi[__i__][__type]", "blocchi", 0)).toBe("blocchi[0][__type]");
  });
  test("leaves a non-matching name unchanged", () => {
    expect(reindexFieldName("altro[0][x]", "blocchi", 2)).toBe("altro[0][x]");
  });
});

/** Build a DOM matching the server-rendered builder partial with two block types. */
function render(blocks: { type: string; value: string }[] = []): HTMLElement {
  const root = document.createElement("fieldset");
  root.setAttribute("data-lievit-builder", "");
  root.setAttribute("data-name", "blocchi");

  const blocksHost = document.createElement("div");
  blocksHost.setAttribute("data-builder-blocks", "");
  blocks.forEach((b, i) => blocksHost.appendChild(buildCard(b.type, b.value, i)));
  root.appendChild(blocksHost);

  const templatesHost = document.createElement("div");
  templatesHost.setAttribute("data-builder-templates", "");
  templatesHost.hidden = true;
  for (const type of ["heading", "paragraph"]) {
    const tpl = document.createElement("template");
    tpl.setAttribute("data-builder-template", type);
    tpl.innerHTML = cardHtml("__i__", "__label__", type, "");
    templatesHost.appendChild(tpl);
  }
  root.appendChild(templatesHost);

  const menu = document.createElement("div");
  for (const type of ["heading", "paragraph"]) {
    const btn = document.createElement("button");
    btn.type = "submit";
    btn.setAttribute("data-builder-add", type);
    menu.appendChild(btn);
  }
  root.appendChild(menu);

  const live = document.createElement("span");
  live.setAttribute("data-builder-live", "");
  root.appendChild(live);

  document.body.appendChild(root);
  return root;
}

function cardHtml(index: string, label: string, type: string, value: string): string {
  return (
    `<div data-builder-block data-index="${index}" data-type="${type}" role="group" aria-label="${type} ${label}">` +
    `<input type="hidden" data-builder-block-type name="blocchi[${index}][__type]" value="${type}">` +
    `<button data-builder-remove aria-label="Remove ${type} ${label}"></button>` +
    `<input name="blocchi[${index}][testo]" value="${value}" aria-label="Testo">` +
    `</div>`
  );
}

function buildCard(type: string, value: string, i: number): HTMLElement {
  const wrap = document.createElement("div");
  wrap.innerHTML = cardHtml(String(i), String(i + 1), type, value);
  return wrap.firstElementChild as HTMLElement;
}

const cards = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>("[data-builder-block]"));
const typeNames = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLInputElement>("[data-builder-block-type]")).map((i) => i.name);
const typeValues = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLInputElement>("[data-builder-block-type]")).map((i) => i.value);

afterEach(() => {
  document.body.innerHTML = "";
});

describe("builder enhancer -- DOM behaviour", () => {
  test("clicking a type button clones THAT type's template with the next contiguous index", () => {
    const root = render([{ type: "heading", value: "Ciao" }]);
    enhanceBuilder(root);
    const para = root.querySelector<HTMLButtonElement>('[data-builder-add="paragraph"]')!;
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    para.dispatchEvent(ev);
    expect(cards(root)).toHaveLength(2);
    // the new block is a paragraph, indexed 1
    expect(typeValues(root)).toEqual(["heading", "paragraph"]);
    expect(typeNames(root)).toEqual(["blocchi[0][__type]", "blocchi[1][__type]"]);
    expect(ev.defaultPrevented).toBe(true);
  });

  test("removing a middle block re-indexes survivors (incl __type) contiguous, order kept", () => {
    const root = render([
      { type: "heading", value: "a" },
      { type: "paragraph", value: "b" },
      { type: "heading", value: "c" },
    ]);
    enhanceBuilder(root);
    const mid = cards(root)[1].querySelector<HTMLButtonElement>("[data-builder-remove]")!;
    mid.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(cards(root)).toHaveLength(2);
    expect(typeNames(root)).toEqual(["blocchi[0][__type]", "blocchi[1][__type]"]);
    expect(typeValues(root)).toEqual(["heading", "heading"]);
    const bodyNames = Array.from(
      root.querySelectorAll<HTMLInputElement>("[data-builder-blocks] input:not([type=hidden])"),
    ).map((i) => i.name);
    expect(bodyNames).toEqual(["blocchi[0][testo]", "blocchi[1][testo]"]);
  });

  test("an unknown type button adds nothing (no template for it)", () => {
    const root = render();
    enhanceBuilder(root);
    const ghost = document.createElement("button");
    ghost.setAttribute("data-builder-add", "video");
    root.appendChild(ghost);
    ghost.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(cards(root)).toHaveLength(0);
  });

  test("is idempotent + enhanceAll wires every root", () => {
    const root = render([{ type: "heading", value: "x" }]);
    enhanceBuilder(root);
    enhanceBuilder(root);
    expect(root.hasAttribute("data-builder-enhanced")).toBe(true);
    const second = render();
    enhanceAllBuilders();
    expect(second.hasAttribute("data-builder-enhanced")).toBe(true);
  });
});
