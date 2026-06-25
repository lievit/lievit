/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * builder (Filament Builder): a list of HETEROGENEOUS typed blocks (add-block menu + per-block
 * content), recursive. The in-place add/remove/re-index behaviour moved from
 * `registry/jte/builder.enhancer.ts` to the `lv-builder` Stimulus controller; this suite proves it
 * through the REAL Stimulus Application + the REAL lievit wire morph (no mock):
 *   (1) structural goldens over builder.jte + builder/block.jte (the per-type add menu, the per-type
 *       templates host, the hidden `__type` field + indexed-array POST contract + remove submit, the
 *       CSP-clean data-controller / data-action wiring, a11y);
 *   (2) the controller DOM behaviour driven on a server-shaped DOM (typed add clones the right
 *       template, remove drops, both re-index the nested names incl `__type` contiguous);
 *   (3) morph-safety: after a real morph one gesture => one effect (the delegated-root-listener
 *       stacking the enhancer was prone to is structurally gone -- Stimulus owns connect/disconnect).
 *
 * The builder is UNCONTROLLED by construction: it edits native form inputs locally and never
 * round-trips the wire (no `data-lv-wire-close`, no `/lievit/<id>/call`), so the suite starts
 * Stimulus with no runtime.
 */
import { describe, test, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  startStimulus,
  stopStimulus,
  flushStimulus,
} from "../runtime/stimulus/application.js";
import { morph } from "../runtime/morph.js";
import { reindexFieldName } from "../runtime/stimulus/controllers/lv-builder-controller.js";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (rel: string) => readFileSync(join(jteDir, rel), "utf8");
const markupOf = (rel: string) => read(rel).replace(/<%--[\s\S]*?--%>/g, "");

/** Start the real `lv-builder` controller over every `data-controller="lv-builder"` root + await it. */
async function connect(): Promise<void> {
  startStimulus();
  await flushStimulus();
}

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
    expect(markup).toMatch(/data-builder-templates[\s\S]*?hidden/);
    expect(markup).toContain("${templates}");
  });

  test("an aria-live region is present for add/remove announcements", () => {
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("data-builder-live");
  });

  test("the template wires the lv-builder controller via data-controller + data-action (CSP-clean)", () => {
    // The add/remove/re-index behaviour moved from builder.enhancer.ts to the lv-builder Stimulus
    // controller. The root carries the controller, the blocks host / templates host / live region are
    // Stimulus targets, and each add button declares its action as a CSP-clean descriptor (not on*=).
    expect(markup).toContain('data-controller="lv-builder"');
    expect(markup).toContain('data-action="click->lv-builder#add"');
    expect(markup).toContain('data-lv-builder-target="blocks"');
    expect(markup).toContain('data-lv-builder-target="templates"');
    expect(markup).toContain('data-lv-builder-target="live"');
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

  test("the remove control declares the controller action (CSP-clean), not an inline handler", () => {
    expect(markup).toContain('data-action="click->lv-builder#remove"');
    expect(markup).not.toMatch(/\son[a-z]+=/);
  });

  test("the block body is a recursive content slot", () => {
    expect(markup).toContain("${content}");
    expect(markup).toContain('data-slot="builder-block-body"');
  });
});

describe("reindexFieldName -- the array-name rewrite (pure, exported from the controller)", () => {
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
  root.setAttribute("data-controller", "lv-builder");
  root.setAttribute("data-name", "blocchi");

  const blocksHost = document.createElement("div");
  blocksHost.setAttribute("data-builder-blocks", "");
  blocksHost.setAttribute("data-lv-builder-target", "blocks");
  blocks.forEach((b, i) => blocksHost.appendChild(buildCard(b.type, b.value, i)));
  root.appendChild(blocksHost);

  const templatesHost = document.createElement("div");
  templatesHost.setAttribute("data-builder-templates", "");
  templatesHost.setAttribute("data-lv-builder-target", "templates");
  templatesHost.hidden = true;
  for (const type of ["heading", "paragraph"]) {
    const tpl = document.createElement("template");
    tpl.setAttribute("data-builder-template", type);
    tpl.innerHTML = cardHtml("__i__", "__label__", type, "");
    templatesHost.appendChild(tpl);
  }
  root.appendChild(templatesHost);

  const menu = document.createElement("div");
  menu.setAttribute("data-builder-add-menu", "");
  for (const type of ["heading", "paragraph"]) {
    const btn = document.createElement("button");
    btn.type = "submit";
    btn.setAttribute("data-builder-add", type);
    btn.setAttribute("data-action", "click->lv-builder#add");
    menu.appendChild(btn);
  }
  root.appendChild(menu);

  const live = document.createElement("span");
  live.setAttribute("data-builder-live", "");
  live.setAttribute("data-lv-builder-target", "live");
  root.appendChild(live);

  document.body.appendChild(root);
  return root;
}

function cardHtml(index: string, label: string, type: string, value: string): string {
  return (
    `<div data-builder-block data-index="${index}" data-type="${type}" role="group" aria-label="${type} ${label}">` +
    `<input type="hidden" data-builder-block-type name="blocchi[${index}][__type]" value="${type}">` +
    `<button data-builder-remove data-action="click->lv-builder#remove" aria-label="Remove ${type} ${label}"></button>` +
    `<input name="blocchi[${index}][testo]" value="${value}" aria-label="Testo">` +
    `</div>`
  );
}

function buildCard(type: string, value: string, i: number): HTMLElement {
  const wrap = document.createElement("div");
  wrap.innerHTML = cardHtml(String(i), String(i + 1), type, value);
  return wrap.firstElementChild as HTMLElement;
}

const cards = (root: ParentNode) =>
  Array.from(root.querySelectorAll<HTMLElement>("[data-builder-block]"));
const typeNames = (root: ParentNode) =>
  Array.from(root.querySelectorAll<HTMLInputElement>("[data-builder-block-type]")).map((i) => i.name);
const typeValues = (root: ParentNode) =>
  Array.from(root.querySelectorAll<HTMLInputElement>("[data-builder-block-type]")).map((i) => i.value);

/** Dispatch a cancelable bubbling click and return whether the handler called preventDefault(). */
function click(el: Element): boolean {
  const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
  el.dispatchEvent(ev);
  return ev.defaultPrevented;
}

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
});

describe("builder controller -- DOM behaviour (real Stimulus + real DOM)", () => {
  test("clicking a type button clones THAT type's template with the next contiguous index", async () => {
    const root = render([{ type: "heading", value: "Ciao" }]);
    await connect();
    const para = root.querySelector<HTMLButtonElement>('[data-builder-add="paragraph"]')!;
    const prevented = click(para);
    expect(cards(root)).toHaveLength(2);
    // the new block is a paragraph, indexed 1
    expect(typeValues(root)).toEqual(["heading", "paragraph"]);
    expect(typeNames(root)).toEqual(["blocchi[0][__type]", "blocchi[1][__type]"]);
    expect(prevented).toBe(true);
  });

  test("removing a middle block re-indexes survivors (incl __type) contiguous, order kept", async () => {
    const root = render([
      { type: "heading", value: "a" },
      { type: "paragraph", value: "b" },
      { type: "heading", value: "c" },
    ]);
    await connect();
    const mid = cards(root)[1].querySelector<HTMLButtonElement>("[data-builder-remove]")!;
    click(mid);
    expect(cards(root)).toHaveLength(2);
    expect(typeNames(root)).toEqual(["blocchi[0][__type]", "blocchi[1][__type]"]);
    expect(typeValues(root)).toEqual(["heading", "heading"]);
    const bodyNames = Array.from(
      root.querySelectorAll<HTMLInputElement>("[data-builder-blocks] input:not([type=hidden])"),
    ).map((i) => i.name);
    expect(bodyNames).toEqual(["blocchi[0][testo]", "blocchi[1][testo]"]);
  });

  test("the add-menu click is suppressed so the form does not submit (preventDefault)", async () => {
    const root = render();
    await connect();
    const add = root.querySelector<HTMLButtonElement>('[data-builder-add="heading"]')!;
    expect(click(add)).toBe(true);
  });

  test("the live region announces add then remove", async () => {
    const root = render([{ type: "heading", value: "x" }]);
    await connect();
    const live = root.querySelector<HTMLElement>("[data-builder-live]")!;
    click(root.querySelector<HTMLButtonElement>('[data-builder-add="paragraph"]')!);
    expect(live.textContent).toBe("Block added");
    click(cards(root)[0].querySelector<HTMLButtonElement>("[data-builder-remove]")!);
    expect(live.textContent).toBe("Block removed");
  });

  test("an unknown type button adds nothing (no template for it)", async () => {
    const root = render();
    await connect();
    const ghost = document.createElement("button");
    ghost.setAttribute("data-builder-add", "video");
    ghost.setAttribute("data-action", "click->lv-builder#add");
    root.querySelector("[data-builder-add-menu]")!.appendChild(ghost);
    await flushStimulus(); // let Stimulus bind the action on the freshly added button
    click(ghost);
    expect(cards(root)).toHaveLength(0);
  });

  test("connect() wires every root on the page", async () => {
    const a = render([{ type: "heading", value: "a" }]);
    const b = render([{ type: "paragraph", value: "b" }]);
    await connect();
    click(b.querySelector<HTMLButtonElement>('[data-builder-add="heading"]')!);
    expect(cards(a)).toHaveLength(1);
    expect(cards(b)).toHaveLength(2);
  });
});

describe("builder controller -- morph-safety (the listener-stacking bug class)", () => {
  // The old enhancer delegated a single click listener on the root and guarded re-runs with a
  // data-builder-enhanced marker; a morph re-scan could stack a second listener (one click => two
  // adds). With Stimulus the marker is gone: a wire morph that re-renders the SAME root keeps the
  // SAME controller (idiomorph preserves identity), so connect() never re-fires and the declared
  // data-actions re-bind exactly once. One gesture => one effect, proven through the REAL morph.

  test("one add click adds exactly one block after a real morph re-renders the root", async () => {
    const root = render([{ type: "heading", value: "Ciao" }]);
    await connect();

    morph(root, root.outerHTML);
    await flushStimulus();

    const live = document.querySelector<HTMLElement>("[data-lievit-builder]")!;
    click(live.querySelector<HTMLButtonElement>('[data-builder-add="paragraph"]')!);
    // a stacked second listener would clone twice (=> 3 cards).
    expect(cards(live), "one click => one add, not a double-fire").toHaveLength(2);
    expect(typeValues(live)).toEqual(["heading", "paragraph"]);
  });

  test("one remove click drops exactly one block after a morph", async () => {
    const root = render([
      { type: "heading", value: "a" },
      { type: "paragraph", value: "b" },
    ]);
    await connect();

    morph(root, root.outerHTML);
    await flushStimulus();

    const live = document.querySelector<HTMLElement>("[data-lievit-builder]")!;
    click(cards(live)[0].querySelector<HTMLButtonElement>("[data-builder-remove]")!);
    expect(cards(live)).toHaveLength(1);
    expect(typeValues(live)).toEqual(["paragraph"]);
  });

  test("a root removed by a morph stops adding (disconnect tore the controller down)", async () => {
    const wrapper = document.createElement("div");
    document.body.appendChild(wrapper);
    const root = render();
    wrapper.appendChild(root); // move the controller root under the wrapper
    await connect();

    const add = root.querySelector<HTMLButtonElement>('[data-builder-add="heading"]')!;
    const blocksHost = root.querySelector<HTMLElement>("[data-builder-blocks]")!;

    // Morph the wrapper to drop the builder entirely -> Stimulus disconnects the controller.
    morph(wrapper, "<div><span>gone</span></div>");
    await flushStimulus();

    // The detached add button no longer reaches a live controller: no clone happens.
    click(add);
    expect(cards(blocksHost)).toHaveLength(0);
  });
});

describe("builder: the converted controller carries the add/remove/re-index logic", () => {
  const controller = readFileSync(
    join(jteDir, "..", "..", "runtime", "stimulus", "controllers", "lv-builder-controller.ts"),
    "utf8",
  );

  test("the behaviour moved from builder.enhancer.ts to the lv-builder controller", () => {
    expect(controller).toContain("export default class LvBuilderController");
    expect(controller).toMatch(/add\(event: Event\)/);
    expect(controller).toMatch(/remove\(event: Event\)/);
    expect(controller).toContain("reindexFieldName");
    // UNCONTROLLED by construction: it must NOT reach for the wire-close doctrine / a runtime call.
    expect(controller).not.toContain("dismissViaWire");
    expect(controller).not.toContain("callWire");
  });
});
