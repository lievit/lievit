/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * toggle.jte -- structural golden for the v-next reforge.
 *
 * toggle.jte was rewritten from the old API (pressedAction, invalid, icon string, value,
 * variant=default/outline, size=default/sm/lg) to the v-next API:
 *   - removed: pressedAction, invalid, icon (string), value, variant "default", size "default"
 *   - added:   wireClick, wireArgs, dataAttrs, leading (Content), trailing (Content),
 *              ariaDescribedBy, iconOnly, variant "ghost"/"primary"/"secondary", size "md"
 *
 * This suite pins:
 *   - param declarations and defaults (including removed params are gone)
 *   - button structure + ARIA contract (aria-pressed, data-slot, data-variant, data-size, data-pressed)
 *   - label-stability rule (APG: content must not change between pressed states)
 *   - size / variant class logic
 *   - iconOnly square sizing
 *   - wireClick → l:click smart attribute
 *   - dataAttrs/wireArgs safe escape channel
 *   - attrs $unsafe pass-through
 *   - leading/trailing content slots
 *   - no removed params, no inline script, CSP-clean
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "toggle.jte"), "utf8");
/** Source with doc comment stripped so assertions never accidentally match doc prose. */
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// §1 API — param declarations (v-next)
// ---------------------------------------------------------------------------
describe("toggle.jte -- v-next params", () => {
  test("declares every documented param with the correct default", () => {
    expect(src).toContain("@param boolean pressed = false");
    expect(src).toContain('@param String variant = "outline"');
    expect(src).toContain('@param String size = "md"');
    expect(src).toContain("@param boolean iconOnly = false");
    expect(src).toContain("@param boolean disabled = false");
    expect(src).toContain("@param String ariaLabel = null");
    expect(src).toContain("@param String ariaDescribedBy = null");
    expect(src).toContain('@param String cssClass = ""');
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain("@param java.util.Map<String, String> dataAttrs = java.util.Map.of()");
    expect(src).toContain("@param String wireClick = null");
    expect(src).toContain("@param java.util.Map<String, String> wireArgs = java.util.Map.of()");
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).toContain("@param gg.jte.Content leading = null");
    expect(src).toContain("@param gg.jte.Content trailing = null");
  });

  test("content has no default (required param)", () => {
    // Required: no "= ..." after @param gg.jte.Content content
    expect(src).toMatch(/@param gg\.jte\.Content content\s*\n/);
  });

  test("leading and trailing default to null", () => {
    expect(src).toContain("@param gg.jte.Content leading = null");
    expect(src).toContain("@param gg.jte.Content trailing = null");
  });

  test("REMOVED: pressedAction is gone from the params", () => {
    expect(src).not.toContain("@param String pressedAction");
  });

  test("REMOVED: invalid is gone from the params", () => {
    expect(src).not.toContain("@param boolean invalid");
  });

  test("REMOVED: icon (string) is gone from the params", () => {
    // The old icon param was `@param String icon = null`
    // (icon as a content slot in leading/trailing is fine, but the String param is removed)
    expect(src).not.toContain("@param String icon");
  });

  test("REMOVED: value is gone from the params", () => {
    expect(src).not.toContain("@param String value");
  });

  test("OLD size default 'default' is gone; new default is 'md'", () => {
    expect(src).not.toContain('@param String size = "default"');
    expect(src).toContain('@param String size = "md"');
  });

  test("OLD variant default 'default' is gone; new default is 'outline'", () => {
    expect(src).not.toContain('@param String variant = "default"');
    expect(src).toContain('@param String variant = "outline"');
  });
});

// ---------------------------------------------------------------------------
// §2 Structure — button element
// ---------------------------------------------------------------------------
describe("toggle.jte -- button element structure", () => {
  test("root is a <button type=button>", () => {
    expect(markup).toContain("<button");
    expect(markup).toContain('type="button"');
  });

  test("data-slot=toggle identifies the button", () => {
    expect(markup).toContain('data-slot="toggle"');
  });

  test("data-variant reflects the variant param", () => {
    expect(markup).toContain('data-variant="${variant}"');
  });

  test("data-size reflects the size param", () => {
    expect(markup).toContain('data-size="${size}"');
  });

  test("data-pressed reflects pressed state as a string attribute", () => {
    expect(markup).toContain('data-pressed="${pressed ? "true" : "false"}"');
  });
});

// ---------------------------------------------------------------------------
// §3 ARIA contract
// ---------------------------------------------------------------------------
describe("toggle.jte -- ARIA contract (WAI-ARIA APG Toggle Button)", () => {
  test("aria-pressed is always emitted as true|false string (never absent)", () => {
    expect(markup).toContain('aria-pressed="${pressed ? "true" : "false"}"');
  });

  test("aria-label is emitted (null becomes absent via JTE smart attr)", () => {
    expect(markup).toContain('aria-label="${ariaLabel}"');
  });

  test("aria-describedby is emitted (null becomes absent via JTE smart attr)", () => {
    expect(markup).toContain('aria-describedby="${ariaDescribedBy}"');
  });

  test("disabled is emitted via native disabled attribute", () => {
    expect(markup).toContain("disabled=\"${disabled}\"");
  });

  test("does NOT carry bogus aria-invalid (removed in v-next)", () => {
    expect(markup).not.toContain("aria-invalid");
  });
});

// ---------------------------------------------------------------------------
// §4 Label stability (APG: content must not change between pressed/unpressed)
// ---------------------------------------------------------------------------
describe("toggle.jte -- label stability (APG rule)", () => {
  test("content is rendered unconditionally (not gated on pressed state)", () => {
    // content is required and always emitted; no @if(pressed) wrapping it
    expect(markup).toContain("${content}");
    // Guard: content is NOT inside an @if(pressed) block
    expect(markup).not.toMatch(/@if\s*\(\s*pressed\s*\)\s*[\s\S]*?\$\{content\}/);
  });

  test("the pressed-state expression only appears in aria-pressed and data-pressed, not around content", () => {
    // The only occurrences of `pressed ? "true"` should be in the attribute lines, not gating content
    const pressedLines = markup.split("\n").filter((l) => l.includes('pressed ? "true"'));
    for (const line of pressedLines) {
      expect(line).toMatch(/aria-pressed|data-pressed/);
    }
  });
});

// ---------------------------------------------------------------------------
// §5 Variant classes
// ---------------------------------------------------------------------------
describe("toggle.jte -- variant class logic", () => {
  test("outline variant (default) uses bg/border/fg tokens at rest", () => {
    expect(src).toContain("var(--lv-color-bg)");
    expect(src).toContain("var(--lv-color-border)");
    expect(src).toContain("var(--lv-color-fg)");
  });

  test("pressed state on outline/ghost uses accent tokens via aria-[pressed=true] selector", () => {
    expect(src).toContain("aria-[pressed=true]:bg-[var(--lv-color-accent)]");
    expect(src).toContain("aria-[pressed=true]:text-[var(--lv-color-accent-fg)]");
  });

  test("ghost variant starts transparent, gains accent on press", () => {
    expect(src).toContain("ghost");
    expect(src).toContain("bg-transparent");
    expect(src).toContain("border-transparent");
  });

  test("primary variant uses primary tokens at rest", () => {
    expect(src).toContain("var(--lv-color-primary)");
    expect(src).toContain("var(--lv-color-primary-fg)");
  });

  test("secondary variant uses secondary tokens at rest", () => {
    expect(src).toContain("var(--lv-color-secondary)");
    expect(src).toContain("var(--lv-color-secondary-fg)");
  });

  test("switch expression covers outline (default), ghost, primary, secondary", () => {
    expect(src).toContain('"ghost"');
    expect(src).toContain('"primary"');
    expect(src).toContain('"secondary"');
    // default covers outline
    expect(src).toContain("default");
  });
});

// ---------------------------------------------------------------------------
// §6 Size classes
// ---------------------------------------------------------------------------
describe("toggle.jte -- size class logic", () => {
  test("sm size uses space-8 height", () => {
    expect(src).toContain('case "sm"');
    expect(src).toContain("var(--lv-space-8)");
  });

  test("lg size uses space-10 height", () => {
    expect(src).toContain('case "lg"');
    expect(src).toContain("var(--lv-space-10)");
  });

  test("md size (default) uses space-9 height", () => {
    expect(src).toContain("var(--lv-space-9)");
    // 'default' arm covers md
    expect(src).toContain("default ->");
  });

  test("iconOnly square: sm gets w-[space-8] p-0, md gets w-[space-9] p-0, lg gets w-[space-10] p-0", () => {
    expect(src).toContain("w-[var(--lv-space-8)] p-0");
    expect(src).toContain("w-[var(--lv-space-9)] p-0");
    expect(src).toContain("w-[var(--lv-space-10)] p-0");
  });

  test("iconOnly path removes horizontal padding (p-0 replaces px-*)", () => {
    // iconOnly branches use p-0 not px-*
    const iconOnlyBranches = src.match(/iconOnly\s*\?\s*"[^"]*"/g) ?? [];
    expect(iconOnlyBranches.length).toBeGreaterThan(0);
    for (const branch of iconOnlyBranches) {
      // The iconOnly=true string should contain p-0
      if (branch.startsWith("iconOnly ? \"h-")) {
        expect(branch).toContain("p-0");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// §7 Base classes
// ---------------------------------------------------------------------------
describe("toggle.jte -- base classes", () => {
  test("button carries inline-flex items-center justify-center base layout", () => {
    expect(src).toContain("inline-flex items-center justify-center");
  });

  test("button carries rounded-[var(--lv-radius-md)] border", () => {
    expect(src).toContain("rounded-[var(--lv-radius-md)]");
    expect(src).toContain("border");
  });

  test("button carries focus-visible ring via --lv-ring token", () => {
    expect(src).toContain("focus-visible:shadow-[var(--lv-ring)]");
  });

  test("button carries disabled:pointer-events-none disabled:opacity-50", () => {
    expect(src).toContain("disabled:pointer-events-none");
    expect(src).toContain("disabled:opacity-50");
  });

  test("button carries outline-none (no default browser outline)", () => {
    expect(src).toContain("outline-none");
  });

  test("font-family is set via style attribute (not a Tailwind class)", () => {
    expect(src).toContain("style=\"font-family:var(--lv-font-sans);\"");
  });
});

// ---------------------------------------------------------------------------
// §8 wireClick → l:click smart attribute
// ---------------------------------------------------------------------------
describe("toggle.jte -- wireClick wiring", () => {
  test("l:click emits wireClick when non-blank via smart attribute", () => {
    expect(markup).toContain("l:click=");
    expect(src).toContain("wireClick != null && !wireClick.isBlank()");
  });

  test("l:click resolves to null (omitted) when wireClick is blank/null", () => {
    // The ternary must resolve to null when wireClick is absent so JTE omits the attribute
    expect(src).toContain("? wireClick : null");
  });

  test("OLD pressedAction wiring is gone from markup", () => {
    expect(markup).not.toContain("pressedAction");
  });
});

// ---------------------------------------------------------------------------
// §9 dataAttrs + wireArgs safe escape channel
// ---------------------------------------------------------------------------
describe("toggle.jte -- dataAttrs/wireArgs safe escaping", () => {
  test("imports StringOutput and Escape for safe attribute escaping", () => {
    expect(src).toContain("@import gg.jte.output.StringOutput");
    expect(src).toContain("@import gg.jte.html.escape.Escape");
  });

  test("dataAttrsMerged starts from dataAttrs then wireArgs win on collision", () => {
    expect(src).toContain("dataAttrsMerged.putAll(dataAttrs)");
    expect(src).toContain("dataAttrsMerged.putAll(wireArgs)");
  });

  test("key allowlist: only [A-Za-z][A-Za-z0-9-]* keys are emitted", () => {
    expect(src).toContain('[A-Za-z][A-Za-z0-9-]*');
  });

  test("values are escaped via Escape.htmlAttribute", () => {
    expect(src).toContain("Escape.htmlAttribute");
  });

  test("dataAttrsMarkup is emitted via $unsafe to avoid double-escaping", () => {
    expect(markup).toContain("$unsafe{dataAttrsMarkup}");
  });
});

// ---------------------------------------------------------------------------
// §10 attrs $unsafe pass-through
// ---------------------------------------------------------------------------
describe("toggle.jte -- attrs $unsafe pass-through", () => {
  test("attrs is emitted via $unsafe{attrs} on the button", () => {
    expect(markup).toContain("$unsafe{attrs}");
  });
});

// ---------------------------------------------------------------------------
// §11 leading/trailing content slots
// ---------------------------------------------------------------------------
describe("toggle.jte -- leading/trailing content slots", () => {
  test("leading slot is conditionally rendered before content", () => {
    expect(src).toContain("@if(leading != null)${leading}@endif");
  });

  test("trailing slot is conditionally rendered after content", () => {
    expect(src).toContain("@if(trailing != null)${trailing}@endif");
  });

  test("content is always rendered (not gated on null)", () => {
    // content is required so rendered unconditionally as ${content}
    expect(markup).toContain("${content}");
    expect(markup).not.toMatch(/@if\s*\(\s*content\s*!=\s*null\s*\)\s*\$\{content\}/);
  });
});

// ---------------------------------------------------------------------------
// §12 CSP safety
// ---------------------------------------------------------------------------
describe("toggle.jte -- CSP safety", () => {
  test("no inline <script> tags", () => {
    expect(markup).not.toMatch(/<script/);
  });

  test("no on* inline event handlers", () => {
    expect(markup).not.toMatch(/\son[a-z]+=/);
  });
});

// ---------------------------------------------------------------------------
// §12b Stimulus lv-toggle wiring (the conversion, CSP-clean)
// ---------------------------------------------------------------------------
describe("toggle.jte -- Stimulus lv-toggle wiring (CSP-clean)", () => {
  test("button mounts data-controller=lv-toggle", () => {
    expect(markup).toContain('data-controller="lv-toggle"');
  });

  test("click is wired via data-action (no inline handler)", () => {
    expect(markup).toContain('data-action="click->lv-toggle#toggle"');
  });

  test("the lv-toggle hooks are declarative Stimulus strings, not an on*= handler", () => {
    // §12 already forbids on*=; this pins that the click behaviour is the Stimulus data-action
    // kind (re-bound across the morph) rather than an inline handler the CSP would refuse.
    expect(markup).not.toMatch(/\son[a-z]+=/);
    expect(markup).toMatch(/data-action="click->lv-toggle#toggle"/);
  });
});

// ---------------------------------------------------------------------------
// §13 Documentation
// ---------------------------------------------------------------------------
describe("toggle.jte -- documentation", () => {
  test("has a <%-- --%> doc comment", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
  });

  test("Usage section shows @@template.lievit.toggle call", () => {
    expect(src).toContain("@@template.lievit.toggle");
  });
});
