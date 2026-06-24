/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * popover v-next: CONTROLLED / UNCONTROLLED headless overlay seam.
 *
 * The popover is re-forged from a simple PARTIAL with Content slots (trigger/content) into a
 * full CONTROLLED / UNCONTROLLED overlay seam:
 *   - UNCONTROLLED (default, controlled=false): panel always in DOM; browser native popover API
 *     (popovertarget + popovertargetaction="toggle") handles show/hide client-side, zero JS.
 *   - CONTROLLED (controlled=true): caller passes `open` from their own @Wire field; the server
 *     gates panel presence via @if(renderPanel) i.e. (!controlled || open).
 *
 * The Content-slot API (trigger, content) is preserved for backward compat.
 * All twelve placement positions are now supported (twelve position-area CSS values).
 * Three variants: default | muted | destructive.
 * Optional labelled-dialog header (title + description -> role="dialog" + aria-labelledby).
 * Optional decorative arrow/caret (withArrow).
 * The popover-anchor.enhancer.ts wires focus-return on light-dismiss + autofocus delegation.
 *
 * NOTE: the native-popover show/hide is the browser's; it cannot be tested in happy-dom (no
 * Popover API). Source assertions here verify the template surface. Real compile = test:jte-compile.
 * Wire open-state round-trips are asserted on the JVM in lievit-kit (PopoverComponentIT).
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

// ---------------------------------------------------------------------------
// Registry shape
// ---------------------------------------------------------------------------

describe("the popover/dropdown islands are gone (Wave 3)", () => {
  test("no Lit island source survives for popover or dropdown-menu", () => {
    for (const rel of [
      "components/popover/popover.ts",
      "components/dropdown-menu/dropdown-menu.ts",
    ]) {
      expect(() => read(rel), `${rel} must be deleted`).toThrow();
    }
  });
});

describe("popover registry:jte item shape (the overlay seam)", () => {
  test("popover is a single registry:jte item", () => {
    const matches = registry.items.filter((i) => i.name === "popover");
    expect(matches, "exactly one popover item").toHaveLength(1);
    expect(matches[0].type).toBe("registry:jte");
  });

  test("it ships one .jte file landing under the adopter JTE root", () => {
    const item = registry.items.find((i) => i.name === "popover")!;
    const jte = item.files.find((f) => f.target.endsWith(".jte"))!;
    expect(jte.root).toBe("jte");
    expect(jte.target).toBe("lievit/popover.jte");
  });

  test("resolving it pulls only the tokens dependency (no Lit, no floating-ui)", () => {
    const item = registry.items.find((i) => i.name === "popover")!;
    expect(item.dependencies ?? []).not.toContain("lit");
    expect(item.dependencies ?? []).not.toContain("@floating-ui/dom");
    const closure = resolve(registry, ["popover"]).map((i) => i.name);
    expect(closure).toContain("tokens");
  });
});

// ---------------------------------------------------------------------------
// JTE source surface assertions
// ---------------------------------------------------------------------------

describe("popover.jte: Content-slot API preserved (trigger + content)", () => {
  const jte = read("jte/popover.jte");

  test("trigger and content are gg.jte.Content params", () => {
    expect(jte).toContain("@param gg.jte.Content trigger");
    expect(jte).toContain("@param gg.jte.Content content");
  });

  test("the trigger Content is rendered inside the trigger button", () => {
    const markup = stripComments(jte);
    // The trigger button renders ${trigger} directly.
    expect(markup).toContain(">${trigger}</button>");
  });

  test("the panel body renders ${content} inside the popover-body slot (owned markup, never a <slot>)", () => {
    const markup = stripComments(jte);
    expect(markup).toContain('data-slot="popover-body"');
    expect(markup).toContain("${content}");
    expect(markup).not.toMatch(/<slot[\s>]/);
  });
});

describe("popover.jte: native-popover + CSS Anchor Positioning seam", () => {
  const jte = read("jte/popover.jte");
  const markup = stripComments(jte);

  test("show/hide is the native HTML popover attribute + popovertarget wiring", () => {
    // panel has the popover attribute (type is a param, but the attribute is always emitted)
    expect(markup).toContain('popover="${type}"');
    // trigger is a real <button popovertarget> targeting the panel id.
    expect(markup).toContain('popovertarget="${panelId}"');
    expect(markup).toContain('popovertargetaction="toggle"');
  });

  test("positioning is CSS Anchor Positioning, never @floating-ui/dom", () => {
    expect(markup).toContain("anchor-name:");
    expect(markup).toContain("position-anchor:");
    expect(markup).toContain("position-area:");
    expect(markup).toContain("position-try-fallbacks:flip-block");
    expect(markup).not.toMatch(/floating-ui/);
  });

  test("CSP-clean: no inline <script>, no inline on* handler", () => {
    expect(jte).not.toMatch(/<script/i);
    expect(markup).not.toMatch(/\son[a-z]+=/i);
  });
});

describe("popover.jte: a11y contract (APG Disclosure + native popover)", () => {
  const jte = read("jte/popover.jte");
  const markup = stripComments(jte);

  test("trigger button emits aria-expanded server-side from the open param", () => {
    // aria-expanded is emitted from the ariaExpanded computed string (open ? "true" : "false").
    expect(markup).toContain("aria-expanded=");
    // The value must not be a literal; it must be an expression.
    expect(markup).toMatch(/aria-expanded="\$\{/);
  });

  test("trigger button emits aria-controls pointing to the panel id", () => {
    expect(markup).toContain('aria-controls="${panelId}"');
  });

  test("panel carries data-slot=popover-panel (the v-next slot name)", () => {
    expect(markup).toContain('data-slot="popover-panel"');
  });

  test("panel carries data-lv-opener for the enhancer's focus-return bookkeeping", () => {
    expect(markup).toContain('data-lv-opener="${triggerId}"');
  });

  test("panel has no hardcoded role (composing component adds the semantic role)", () => {
    // The seam itself has no fixed role when title is null; role="dialog" appears only when
    // labelled=true. We check that the template does not hardcode a non-null role always.
    // The role attribute is emitted only conditionally (labelled ? "dialog" : null).
    expect(markup).toContain('"dialog"');     // the labelled-dialog path exists
    expect(markup).toContain(': null}');       // the no-role path via smart-attribute null-drop
    // Must NOT have role="menu" or role="listbox" -- those are composing-component concerns.
    expect(markup).not.toContain('role="menu"');
    expect(markup).not.toContain('role="listbox"');
  });

  test("no aria-modal (non-modal overlay -- Tab does not trap)", () => {
    expect(markup).not.toContain("aria-modal");
  });
});

describe("popover.jte: CONTROLLED / UNCONTROLLED params", () => {
  const jte = read("jte/popover.jte");
  const markup = stripComments(jte);

  test("open and controlled are declared as boolean params with safe defaults", () => {
    expect(jte).toContain("@param boolean open = false");
    expect(jte).toContain("@param boolean controlled = false");
  });

  test("panel is gated by renderPanel = !controlled || open (uncontrolled: always rendered)", () => {
    // The panel presence gate must allow rendering when controlled=false (uncontrolled mode).
    // We verify both variables appear in the template logic.
    expect(markup).toContain("!controlled");
    expect(markup).toContain("renderPanel");
    // The @if gate references renderPanel.
    expect(markup).toContain("@if(renderPanel)");
  });

  test("no @param for _component / _instance / _componentSnapshot (this is a PARTIAL, not WIRE)", () => {
    // Check the @param declarations only (not the comment prose that explains their absence).
    const params = jte.match(/@param\s+\S+\s+(\w+)/g) ?? [];
    const paramNames = params.map((p) => p.replace(/@param\s+\S+\s+/, "").trim());
    expect(paramNames).not.toContain("_component");
    expect(paramNames).not.toContain("_instance");
    expect(paramNames).not.toContain("_componentSnapshot");
    expect(paramNames).not.toContain("_componentFqn");
    expect(paramNames).not.toContain("_componentId");
  });

  test("no l:click hardcoded in the trigger (controlled callers add it in their own copy)", () => {
    // The seam does not hardcode a wire action name; the caller's owned copy adds l:click.
    expect(markup).not.toContain("l:click");
  });
});

describe("popover.jte: twelve placement values -> correct position-area", () => {
  const jte = read("jte/popover.jte");
  const markup = stripComments(jte);

  test("all twelve placement cases are mapped in the switch", () => {
    const placements = [
      "bottom", "bottom-start", "bottom-end",
      "top",    "top-start",    "top-end",
      "left",   "left-start",   "left-end",
      "right",  "right-start",  "right-end",
    ];
    for (const p of placements) {
      expect(markup, `placement "${p}" missing from positionArea switch`).toContain(`case "${p}"`);
    }
  });

  test("bottom-start maps to bottom span-right (panel left edge aligns with trigger left)", () => {
    // The default placement; assert the position-area value is present in the switch body.
    expect(markup).toContain('"bottom span-right"');
  });

  test("top-end maps to top span-left (panel right edge aligns with trigger right)", () => {
    expect(markup).toContain('"top span-left"');
  });

  test("right maps to right center (panel centred vertically on the trigger right edge)", () => {
    expect(markup).toContain('"right center"');
  });

  test("left-start maps to left span-bottom", () => {
    expect(markup).toContain('"left span-bottom"');
  });
});

describe("popover.jte: variant surfaces", () => {
  const jte = read("jte/popover.jte");
  const markup = stripComments(jte);

  test("variant param declared with default=default", () => {
    expect(jte).toContain('@param String variant = "default"');
  });

  test("all three variants appear in the panelBg switch", () => {
    expect(markup).toContain('"muted"');
    expect(markup).toContain('"destructive"');
    expect(markup).toContain('"default"');
  });

  test("muted variant uses --lv-color-muted-bg (fill token, not the text-weight --lv-color-muted)", () => {
    expect(markup).toContain("var(--lv-color-muted-bg)");
    // --lv-color-muted (text-weight) must NOT appear as a background value.
    // It appears only as var(--lv-color-muted-fg) in the fg switch, which is correct.
    expect(markup).not.toMatch(/background.*var\(--lv-color-muted\)/);
  });

  test("data-variant attribute on the panel for styling/test hooks", () => {
    expect(markup).toContain('data-variant="${variant}"');
  });
});

describe("popover.jte: arrow / caret (withArrow)", () => {
  const jte = read("jte/popover.jte");
  const markup = stripComments(jte);

  test("withArrow param declared with default false", () => {
    expect(jte).toContain("@param boolean withArrow = false");
  });

  test("data-with-arrow on the panel for styling/test hooks", () => {
    expect(markup).toContain('data-with-arrow=');
  });

  test("arrow span carries data-slot=popover-arrow and data-placement", () => {
    expect(markup).toContain('data-slot="popover-arrow"');
    expect(markup).toContain('data-placement="${placement}"');
  });

  test("arrow is wrapped in @if(withArrow) so it is absent when false", () => {
    expect(markup).toContain("@if(withArrow)");
  });

  test("arrow span carries aria-hidden=true (decorative, not a content signal)", () => {
    expect(markup).toContain('aria-hidden="true"');
  });

  test("arrow position is computed from arrowSide derived from placement", () => {
    // arrowSide switch covers all four cases.
    expect(markup).toContain('"bottom"');  // top placements -> arrowSide=bottom
    expect(markup).toContain('"right"');   // left placements -> arrowSide=right
    expect(markup).toContain('"left"');    // right placements -> arrowSide=left
    expect(markup).toContain('"top"');     // default (bottom) placements -> arrowSide=top
  });
});

describe("popover.jte: labelled-dialog header (title + description)", () => {
  const jte = read("jte/popover.jte");
  const markup = stripComments(jte);

  test("title and description are gg.jte.Content params with null defaults", () => {
    expect(jte).toContain("@param gg.jte.Content title = null");
    expect(jte).toContain("@param gg.jte.Content description = null");
  });

  test("a non-null title adds role=dialog + aria-labelledby via smart-attribute null-drop", () => {
    // role is emitted only when labelled=true (role="${labelled ? "dialog" : null}").
    expect(markup).toContain('"dialog"');
    // aria-labelledby is emitted only when labelled=true.
    expect(markup).toContain('aria-labelledby=');
    // aria-describedby is emitted only when description is also non-null.
    expect(markup).toContain('aria-describedby=');
  });

  test("popover-header, popover-title, popover-description slots are present", () => {
    expect(markup).toContain('data-slot="popover-header"');
    expect(markup).toContain('data-slot="popover-title"');
    expect(markup).toContain('data-slot="popover-description"');
  });

  test("header section is wrapped in @if(labelled) so it is absent when title is null", () => {
    expect(markup).toContain("@if(labelled)");
  });
});

describe("popover.jte: motion tokens (correct names from lievit-tokens.css)", () => {
  const jte = read("jte/popover.jte");
  const markup = stripComments(jte);

  test("uses --lv-duration-fast (not the spec-draft --lv-motion-duration-fast)", () => {
    expect(markup).toContain("var(--lv-duration-fast)");
    expect(markup).not.toContain("--lv-motion-duration-fast");
  });

  test("uses --lv-ease-out (not the spec-draft --lv-motion-easing-out)", () => {
    expect(markup).toContain("var(--lv-ease-out)");
    expect(markup).not.toContain("--lv-motion-easing-out");
  });
});

describe("popover.jte: disabled trigger", () => {
  const jte = read("jte/popover.jte");
  const markup = stripComments(jte);

  test("disabled param declared with default false", () => {
    expect(jte).toContain("@param boolean disabled = false");
  });

  test("disabled is set as a JTE boolean attribute on the trigger button", () => {
    // JTE boolean attribute: pass the boolean directly; JTE drops it when false.
    expect(markup).toContain('disabled="${disabled}"');
  });
});

describe("popover.jte: no literal colours (tokens only)", () => {
  const markup = stripComments(read("jte/popover.jte"));

  test("no hex colour literals in the markup", () => {
    // Hex literals would be hardcoded colours; all colours must come from --lv-* tokens.
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test("no rgb() or hsl() colour literals", () => {
    expect(markup).not.toMatch(/\brgb\(|\bhsl\(/i);
  });
});

// ---------------------------------------------------------------------------
// dropdown-menu tests (unchanged -- these reference a different component file)
// ---------------------------------------------------------------------------

describe("dropdown-menu registry:jte item shape", () => {
  test("dropdown-menu is a single registry:jte item with the item + separator family", () => {
    const matches = registry.items.filter((i) => i.name === "dropdown-menu");
    expect(matches, "exactly one dropdown-menu item").toHaveLength(1);
    expect(matches[0].type).toBe("registry:jte");
    const targets = matches[0].files.map((f) => f.target);
    expect(targets).toContain("lievit/dropdown-menu.jte");
    expect(targets).toContain("lievit/dropdown-menu/item.jte");
    expect(targets).toContain("lievit/dropdown-menu/separator.jte");
  });

  test("resolving it pulls tokens + icon, not Lit/floating-ui", () => {
    const item = registry.items.find((i) => i.name === "dropdown-menu")!;
    expect(item.dependencies ?? []).not.toContain("lit");
    expect(item.dependencies ?? []).not.toContain("@floating-ui/dom");
    const closure = resolve(registry, ["dropdown-menu"]).map((i) => i.name);
    expect(closure).toContain("tokens");
    expect(closure).toContain("icon");
    expect(closure.indexOf("icon")).toBeLessThan(closure.indexOf("dropdown-menu"));
  });
});

describe("dropdown-menu.jte: native popover menu of real items", () => {
  const jte = read("jte/dropdown-menu.jte");
  const markup = stripComments(jte);

  test("show/hide is the native popover attribute + popovertarget (same seam as popover)", () => {
    // The dropdown-menu trigger wires popovertarget to the panel id (may be conditional in v-next).
    expect(markup).toContain("popovertarget=");
    expect(markup).toContain('popover="auto"');
  });

  test("the trigger is a menu-button and the panel is role=menu (WAI-ARIA APG)", () => {
    expect(markup).toContain('aria-haspopup="menu"');
    expect(markup).toContain('role="menu"');
  });

  test("positioned with CSS Anchor Positioning, never floating-ui", () => {
    expect(markup).toContain("position-anchor:");
    expect(markup).toContain("position-try-fallbacks:flip-block");
    expect(markup).not.toMatch(/floating-ui/);
  });

  test("the items are an owned server-rendered slot, never a native <slot>", () => {
    expect(jte).toContain("@param gg.jte.Content content");
    expect(markup).toContain("${content}");
    expect(markup).not.toMatch(/<slot[\s>]/);
  });

  test("it is CSP-clean: no inline <script>, no inline on* handler", () => {
    expect(jte).not.toMatch(/<script/i);
    expect(markup).not.toMatch(/\son[a-z]+=/i);
  });

  test("the optional triggerClass appends utilities to the trigger <button> itself", () => {
    expect(jte, "triggerClass param missing").toContain('@param String triggerClass = ""');
    const triggerButton = markup.slice(
      markup.indexOf('data-slot="dropdown-menu-trigger"'),
      markup.indexOf("</button>"),
    );
    expect(triggerButton, "triggerClass not applied to the trigger button").toContain(
      "${triggerClass}",
    );
    const wrapper = markup.slice(0, markup.indexOf('data-slot="dropdown-menu-trigger"'));
    expect(wrapper, "triggerClass leaked onto the wrapper").not.toContain("${triggerClass}");
  });
});

describe("dropdown-menu/item.jte: real <a href> / <button>, role=menuitem", () => {
  const jte = read("jte/dropdown-menu/item.jte");
  const markup = stripComments(jte);

  test("renders a real <a href> for a navigation item (navigates JS-off)", () => {
    expect(markup).toMatch(/<a[\s\n]/);
    expect(markup).toContain('href="${href}"');
  });

  test("renders a real <button> for an action item (form submit / l:click)", () => {
    expect(markup).toMatch(/<button[\s\n]/);
    expect(markup).toContain("formaction=");
  });

  test("each item carries the menuitem role (or checkbox/radio variant)", () => {
    expect(markup).toContain('role="${role}"');
    expect(jte).toContain("menuitemcheckbox");
    expect(jte).toContain("menuitemradio");
  });

  test("a disabled item renders as a JTE boolean attribute (not the smart-attr null-drop)", () => {
    expect(markup).toContain(' disabled="${disabled}"');
    expect(markup).not.toMatch(/(?<!aria-)disabled="\$\{disabled \? "true" : null\}"/);
  });

  test("the optional icon comes from the Lucide icon partial, not Font Awesome", () => {
    expect(jte).toContain("@template.lievit.icon(name = icon");
    expect(jte).not.toMatch(/\bfa-|font-awesome/i);
  });
});

describe("dropdown-menu/separator.jte: a role=separator divider", () => {
  const markup = stripComments(read("jte/dropdown-menu/separator.jte"));
  test("renders a token-styled hairline with role=separator", () => {
    expect(markup).toContain('role="separator"');
    expect(markup).toContain("var(--lv-color-border)");
  });
});

describe("popover-wire registry:wire item shape (server-data-driven variant)", () => {
  test("popover-wire is a single registry:wire item: a .java + a .jte", () => {
    const matches = registry.items.filter((i) => i.name === "popover-wire");
    expect(matches, "exactly one popover-wire item").toHaveLength(1);
    expect(matches[0].type).toBe("registry:wire");
    const java = matches[0].files.find((f) => f.target.endsWith(".java"))!;
    const jte = matches[0].files.find((f) => f.target.endsWith(".jte"))!;
    expect(java.root).toBe("java");
    expect(jte.root).toBe("jte");
  });

  test("the wire Java holds open in a @Wire field + @LievitAction toggle/show/close", () => {
    const java = read("wire/popover/PopoverComponent.java");
    expect(java).toContain("@Wire");
    expect(java).toContain("public boolean open");
    expect(java).toContain("@LievitAction");
    expect(java).toContain("void toggle()");
    expect(java).toContain("void show()");
    expect(java).toContain("void close()");
    expect(java).toMatch(/@LievitProperty\(locked = true\)[\s\S]*?boolean disabled/);
  });

  test("the wire template conditionally renders the panel (@if open), no <slot>", () => {
    const jte = read("wire/popover/popover-wire.jte");
    const markup = stripComments(jte);
    expect(markup).toContain("@if(open)");
    expect(markup).toContain("data-popover-panel");
    expect(markup).not.toMatch(/<slot[\s>]/);
    expect(markup).toContain("data-popover-body");
    expect(markup).toContain("position-anchor:");
    expect(markup).toContain("position-try-fallbacks: flip-block");
  });
});
