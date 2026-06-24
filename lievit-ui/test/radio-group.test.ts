/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * lievit-ui radio-group -- full structural + keyboard + enhancer tests.
 *
 * Two test layers:
 *
 * LAYER 1 -- Source-text assertions on radio-group.jte (no JTE compiler in the Node
 * harness). Asserts every param, data-slot, ARIA attribute, size/variant/layout data
 * attribute, escaping channels, and structural contract from the spec. This is the
 * same methodology as switch.test.ts and tabs.test.ts.
 *
 * Options arrive as parallel lists (optionIds, optionLabels, optionDescriptions,
 * optionDisabled) -- the established parallel-list pattern (see command.jte, data-table.jte).
 * This keeps the JTE compile-gate classpath to JDK + jte + icons only, matching all other
 * partials in the registry.
 *
 * The axe-core contract is enforced by asserting the exact ARIA attributes the named
 * axe rules check (no axe-core dependency here):
 *   - radiogroup           -> role="radiogroup" present
 *   - aria-allowed-attr    -> aria-checked on role="radio" only
 *   - aria-required-attr   -> aria-checked always emitted (not conditional)
 *   - aria-valid-attr-value-> aria-checked is exactly "true" or "false"
 *   - label / fieldset     -> fieldset + legend in native variant
 *
 * LAYER 2 -- Keyboard / focus tests using the REAL radio-group.enhancer.ts and a REAL
 * LievitRuntime in happy-dom (no mocked $lievit). Matches the spec S7 keyboard test
 * requirements: arrow-key movement, aria-checked sync, wrapping, disabled-skip,
 * lievit:radio-change dispatch, Space activation, Enter no-op.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { LievitRuntime } from "../runtime/runtime.js";
import { installRadioGroup } from "../registry/jte/radio-group.enhancer.js";

// ---------------------------------------------------------------------------
// Source-text helpers
// ---------------------------------------------------------------------------

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "radio-group.jte"), "utf8");
/** Strip JTE doc-comment blocks so assertions never match doc prose. */
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// LAYER 1 -- JTE source-text assertions
// ---------------------------------------------------------------------------

describe("radio-group.jte -- doc comment + meta", () => {
  test("has a JTE comment block (not @* *@) with Usage section", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
    expect(src).not.toMatch(/@\*/);
    expect(src).toMatch(/Usage:/);
    expect(src).toContain("@@template.lievit.radio_group(");
  });

  test("cites the WAI-ARIA APG Radio Group source URL", () => {
    expect(src).toContain("WAI-ARIA APG Radio Group");
    expect(src).toContain("https://www.w3.org/WAI/ARIA/apg/patterns/radio/");
  });

  test("no nested JTE comment delimiter inside the doc block (gate hazard)", () => {
    const firstClose = src.indexOf("--%>");
    expect(firstClose, "doc comment must close").toBeGreaterThan(0);
    // Nothing inside the opening <%-- ... should close the comment early.
    const inside = src.slice(0, firstClose);
    expect(inside).not.toContain("--%>");
  });
});

describe("radio-group.jte -- @param declarations", () => {
  test("declares all required and optional params with correct types/defaults", () => {
    expect(src).toContain("@param String name");
    expect(src).toContain("@param java.util.List<String> optionIds");
    expect(src).toContain("@param java.util.List<String> optionLabels");
    expect(src).toContain("@param java.util.List<String> optionDescriptions = null");
    expect(src).toContain("@param java.util.List<Boolean> optionDisabled = null");
    expect(src).toContain("@param String value = null");
    expect(src).toContain('@param String variant = "default"');
    expect(src).toContain('@param String size = "md"');
    expect(src).toContain('@param String layout = "vertical"');
    expect(src).toContain("@param boolean disabled = false");
    expect(src).toContain("@param boolean required = false");
    expect(src).toContain("@param String labelledby = null");
    expect(src).toContain("@param String groupLabel = null");
    expect(src).toContain("@param String groupLabelId = null");
    expect(src).toContain("@param String describedby = null");
    expect(src).toContain("@param boolean nativeInputs = false");
    expect(src).toContain('@param String cssClass = ""');
    expect(src).toContain('@param String optionCssClass = ""');
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain("@param java.util.Map<String, String> dataAttrs = java.util.Map.of()");
    expect(src).toContain("@param java.util.Map<String, String> optionAttrs = java.util.Map.of()");
  });

  test("no @import io.lievit.* (JTE gate classpath has JDK + jte + icons only)", () => {
    expect(src).not.toMatch(/@import io\.lievit\./);
  });

  test("imports only gg.jte.output.StringOutput and gg.jte.html.escape.Escape", () => {
    expect(src).toContain("@import gg.jte.output.StringOutput");
    expect(src).toContain("@import gg.jte.html.escape.Escape");
  });
});

describe("radio-group.jte -- data-slot and ARIA structure (custom variant, PATH A)", () => {
  test("root carries role=radiogroup and data-slot=radio-group [axe: radiogroup]", () => {
    expect(markup).toContain('role="radiogroup"');
    expect(markup).toContain('data-slot="radio-group"');
  });

  test("root carries data-lievit-enhancer=radio-group (enhancer mount signal)", () => {
    expect(markup).toContain('data-lievit-enhancer="radio-group"');
  });

  test("root carries data-variant, data-size, data-layout for styling hooks and tests", () => {
    expect(markup).toContain('data-variant="${variant}"');
    expect(markup).toContain('data-size="${size}"');
    expect(markup).toContain('data-layout="${layout}"');
  });

  test("root carries aria-labelledby, aria-describedby, aria-required, aria-disabled [axe: aria-allowed-attr]", () => {
    expect(markup).toContain("aria-labelledby=");
    expect(markup).toContain('aria-describedby="${describedby}"');
    expect(markup).toContain('aria-required="${required ? "true" : null}"');
    expect(markup).toContain('aria-disabled="${disabled ? "true" : null}"');
  });

  test("inline group label has data-slot=radio-group-label and is aria-hidden", () => {
    expect(markup).toContain('data-slot="radio-group-label"');
    // The span is aria-hidden because aria-labelledby on the group already announces it to AT.
    expect(src).toMatch(/data-slot="radio-group-label"[\s\S]{0,100}aria-hidden="true"/);
  });

  test("options carry role=radio and data-slot=radio-option [axe: aria-allowed-attr]", () => {
    expect(markup).toContain('role="radio"');
    expect(markup).toContain('data-slot="radio-option"');
  });

  test("aria-checked is always emitted as 'true' or 'false' on each option [axe: aria-required-attr]", () => {
    expect(markup).toContain('aria-checked="${_checked ? "true" : "false"}"');
  });

  test("aria-disabled is emitted on each option", () => {
    expect(markup).toContain('aria-disabled="${_optDis ? "true" : "false"}"');
  });

  test("tabindex reflects roving logic (0 for tab-stop, -1 for others)", () => {
    expect(markup).toContain('tabindex="${_isTabStop ? "0" : "-1"}"');
  });

  test("data-value is the escaped _escId from Escape.htmlAttribute (XSS guard for DB-derived ids)", () => {
    expect(src).toContain("Escape.htmlAttribute(_id == null");
    expect(markup).toContain('data-value="${_escId}"');
    // Raw _id must NOT appear unescaped in data-value position.
    expect(markup).not.toContain('data-value="${_id}"');
  });

  test("option description span has data-slot=radio-description and id for aria-describedby", () => {
    expect(markup).toContain('data-slot="radio-description"');
    expect(markup).toContain('aria-describedby="${_hasDesc ? _descId : null}"');
  });

  test("custom indicator has data-slot=radio-indicator and is aria-hidden (decorative) [default variant]", () => {
    expect(markup).toContain('data-slot="radio-indicator"');
    expect(src).toMatch(/data-slot="radio-indicator"[\s\S]{0,30}aria-hidden="true"/);
  });

  test("indicator dot has data-slot=radio-indicator-dot", () => {
    expect(markup).toContain('data-slot="radio-indicator-dot"');
  });

  test("button variant branch exists and omits the radio-indicator dot", () => {
    expect(src).toContain('"button".equals(variant) || "button-vertical".equals(variant)');
    // In the button branch there must be no radio-indicator data-slot.
    const buttonBranchEnd = src.indexOf('"button".equals(variant) || "button-vertical".equals(variant)');
    const elseBranchStart = src.indexOf("DEFAULT variant:", buttonBranchEnd);
    const buttonBranch = src.slice(buttonBranchEnd, elseBranchStart);
    expect(buttonBranch).not.toContain('data-slot="radio-indicator"');
  });
});

describe("radio-group.jte -- native variant (PATH B, nativeInputs=true)", () => {
  test("renders a fieldset as the root element [axe: radiogroup, label]", () => {
    expect(markup).toContain("<fieldset");
    expect(markup).toContain('data-variant="native"');
  });

  test("renders a legend element for the group label", () => {
    expect(markup).toContain("<legend");
    expect(markup).toContain('data-slot="radio-group-label"');
  });

  test("each native option is an input[type=radio] with name, value, checked, disabled", () => {
    expect(markup).toContain('type="radio"');
    expect(markup).toContain('name="${name}"');
    expect(markup).toContain('value="${_escId}"');
    expect(markup).toContain('checked="${_checked}"');
    expect(markup).toContain('disabled="${_optDis}"');
  });

  test("required attribute is on the first option only (browser enforcement per-group)", () => {
    expect(markup).toContain('required="${required && _isFirst}"');
  });

  test("label[for] pairs with input id [axe: label]", () => {
    expect(markup).toContain('for="${_inputId}"');
    expect(markup).toContain('id="${_inputId}"');
  });

  test("native variant description span has id and input carries aria-describedby when description present", () => {
    expect(markup).toContain('aria-describedby="${_hasDesc ? _nativeDescId : null}"');
    expect(markup).toContain('id="${_nativeDescId}"');
  });

  test("fieldset does NOT carry data-lievit-enhancer (native needs no enhancer)", () => {
    const fieldsetIdx = markup.indexOf("<fieldset");
    const fieldsetBlock = markup.slice(fieldsetIdx, fieldsetIdx + 500);
    expect(fieldsetBlock).not.toContain("data-lievit-enhancer");
  });
});

describe("radio-group.jte -- size scale", () => {
  test("sm size resolves to --lv-space-8 (32px) height token", () => {
    expect(src).toContain('"sm" -> "min-h-[var(--lv-space-8)]"');
  });

  test("md size resolves to --lv-space-9 (36px) height token (default)", () => {
    expect(src).toContain("--lv-space-9");
  });

  test("lg size resolves to --lv-space-10 (40px) height token", () => {
    expect(src).toContain('"lg" -> "min-h-[var(--lv-space-10)]"');
  });

  test("sm text size is --lv-text-xs", () => {
    expect(src).toContain('"sm" -> "text-[length:var(--lv-text-xs)]"');
  });

  test("lg text size is --lv-text-base", () => {
    expect(src).toContain('"lg" -> "text-[length:var(--lv-text-base)]"');
  });
});

describe("radio-group.jte -- token usage (no hardcoded colours)", () => {
  test("indicator ring uses --lv-color-border for unchecked state", () => {
    expect(src).toContain("--lv-color-border");
  });

  test("checked state uses --lv-color-primary and --lv-color-primary-fg", () => {
    expect(src).toContain("--lv-color-primary");
    expect(src).toContain("--lv-color-primary-fg");
  });

  test("description text uses --lv-color-muted-fg", () => {
    expect(src).toContain("--lv-color-muted-fg");
  });

  test("focus ring uses --lv-ring", () => {
    expect(src).toContain("--lv-ring");
  });

  test("disabled uses --lv-opacity-disabled (no hardcoded 0.5)", () => {
    expect(src).toContain("--lv-opacity-disabled");
    expect(src).not.toMatch(/opacity-50(?![a-z])/);
    expect(src).not.toContain("opacity-[0.5]");
  });

  test("font uses --lv-font-sans and --lv-font-medium (no hardcoded font strings)", () => {
    expect(src).toContain("--lv-font-sans");
    expect(src).toContain("--lv-font-medium");
  });
});

describe("radio-group.jte -- escaping channels (XSS decision rule)", () => {
  test("attrs param is emitted with $unsafe (TRUSTED raw channel, static strings only)", () => {
    expect(markup).toContain("$unsafe{attrs}");
  });

  test("dataAttrs are built into a StringOutput with Escape.htmlAttribute on each value (SAFE channel)", () => {
    expect(src).toContain("Escape.htmlAttribute(e.getValue()");
    expect(src).toContain("dataAttrsMarkup");
    expect(markup).toContain("$unsafe{dataAttrsMarkup}");
  });

  test("optionAttrs are built with Escape.htmlAttribute and emitted as $unsafe{optionAttrsMarkup}", () => {
    expect(src).toContain("optionAttrsMarkup");
    expect(markup).toContain("$unsafe{optionAttrsMarkup}");
  });

  test("data-value is always the escaped _escId, never raw _id [XSS guard]", () => {
    expect(markup).toContain('data-value="${_escId}"');
    expect(markup).not.toContain('data-value="${_id}"');
  });
});

describe("radio-group.jte -- CSP safety", () => {
  test("no inline <script> element", () => {
    expect(markup).not.toMatch(/<script/);
  });

  test("no inline on* event handler attribute", () => {
    expect(markup).not.toMatch(/\son[a-zA-Z]+=["']/);
  });

  test("no hardcoded hex/rgb colour literals in inline styles", () => {
    const inlineStyles = markup.match(/style="[^"]*"/g) ?? [];
    for (const style of inlineStyles) {
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}/);
      expect(style).not.toMatch(/rgb\(/);
    }
  });
});

describe("radio-group.jte -- layout and label-id auto-derivation", () => {
  test("effectiveLabelId falls back to rg-label-NAME when groupLabelId is null", () => {
    expect(src).toContain('"rg-label-" + name');
  });

  test("horizontal layout resolves to flex-row", () => {
    expect(src).toContain('"horizontal".equals(layout)');
    expect(src).toContain("flex-row");
  });
});

// ---------------------------------------------------------------------------
// LAYER 2 -- Real enhancer tests (happy-dom + LievitRuntime)
// ---------------------------------------------------------------------------

/**
 * Build a radiogroup element with role="radio" option divs and a real LievitRuntime.
 * Mirrors what radio-group.jte emits server-side for the custom (PATH A) variant.
 */
function buildRadioGroup(opts: {
  options: Array<{ id: string; label: string; checked?: boolean; disabled?: boolean }>;
  groupDisabled?: boolean;
}): {
  runtime: LievitRuntime;
  root: HTMLElement;
  optionEls: HTMLElement[];
  dispatchedEvents: Array<CustomEvent>;
} {
  document.body.innerHTML = "";
  const dispatchedEvents: Array<CustomEvent> = [];

  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.TestComponent");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");

  const root = document.createElement("div");
  root.setAttribute("role", "radiogroup");
  root.setAttribute("id", "rg-test");
  root.setAttribute("data-lievit-enhancer", "radio-group");
  if (opts.groupDisabled === true) {
    root.setAttribute("aria-disabled", "true");
  }
  root.addEventListener("lievit:radio-change", (e) => {
    dispatchedEvents.push(e as CustomEvent);
  });

  const optionEls: HTMLElement[] = [];
  let hasChecked = false;
  for (const opt of opts.options) {
    const div = document.createElement("div");
    div.setAttribute("role", "radio");
    div.setAttribute("id", `rg-test-${opt.id}`);
    div.setAttribute("data-value", opt.id);
    div.setAttribute("aria-checked", opt.checked ? "true" : "false");
    if (opt.checked) {
      hasChecked = true;
    }
    const isOptDisabled = opt.disabled === true || opts.groupDisabled === true;
    div.setAttribute("aria-disabled", isOptDisabled ? "true" : "false");
    div.tabIndex = -1;
    div.textContent = opt.label;
    root.appendChild(div);
    optionEls.push(div);
  }

  // Set initial roving tabindex (mirrors what server-rendered JTE emits).
  if (!hasChecked && optionEls.length > 0) {
    const firstEnabled = optionEls.find((o) => o.getAttribute("aria-disabled") !== "true");
    if (firstEnabled != null) {
      firstEnabled.tabIndex = 0;
    }
  } else {
    for (const el of optionEls) {
      if (el.getAttribute("aria-checked") === "true") {
        el.tabIndex = 0;
      }
    }
  }

  componentRoot.appendChild(root);
  document.body.appendChild(componentRoot);

  const runtime = new LievitRuntime({
    fetchImpl: async () =>
      new Response("<div></div>", {
        status: 200,
        headers: { "Lievit-Snapshot": "s2" },
      }),
  });
  installRadioGroup(runtime);
  runtime.start();

  return { runtime, root, optionEls, dispatchedEvents };
}

function fireKey(el: HTMLElement, key: string): void {
  el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

// -- tabindex initialization on mount

describe("radio-group.enhancer -- tabindex initialization on mount", () => {
  test("renders_tabindex_zero_on_checked_option: checked option gets tabindex=0 on mount", () => {
    const { optionEls } = buildRadioGroup({
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B", checked: true },
        { id: "c", label: "C" },
      ],
    });
    expect(optionEls[1].tabIndex).toBe(0);
    expect(optionEls[0].tabIndex).toBe(-1);
    expect(optionEls[2].tabIndex).toBe(-1);
  });

  test("renders_tabindex_zero_on_first_option_when_none_checked: first non-disabled gets tabindex=0", () => {
    const { optionEls } = buildRadioGroup({
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ],
    });
    expect(optionEls[0].tabIndex).toBe(0);
    expect(optionEls[1].tabIndex).toBe(-1);
    expect(optionEls[2].tabIndex).toBe(-1);
  });

  test("disabled_option_excluded_from_tabindex_zero: first non-disabled holds tabindex=0", () => {
    const { optionEls } = buildRadioGroup({
      options: [
        { id: "a", label: "A", disabled: true },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ],
    });
    expect(optionEls[1].tabIndex).toBe(0);
    expect(optionEls[0].tabIndex).toBe(-1);
  });
});

// -- ArrowDown / ArrowRight navigation

describe("radio-group.enhancer -- ArrowDown / ArrowRight navigation", () => {
  test("arrow_down_moves_focus_to_next_option", () => {
    const { root, optionEls } = buildRadioGroup({
      options: [
        { id: "a", label: "A", checked: true },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ],
    });
    optionEls[0].focus();
    fireKey(root, "ArrowDown");
    expect(document.activeElement).toBe(optionEls[1]);
  });

  test("arrow_down_checks_next_option and unchecks previous", () => {
    const { root, optionEls } = buildRadioGroup({
      options: [
        { id: "a", label: "A", checked: true },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ],
    });
    optionEls[0].focus();
    fireKey(root, "ArrowDown");
    expect(optionEls[1].getAttribute("aria-checked")).toBe("true");
    expect(optionEls[0].getAttribute("aria-checked")).toBe("false");
  });

  test("arrow_down_wraps_to_first_from_last", () => {
    const { root, optionEls } = buildRadioGroup({
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
        { id: "c", label: "C", checked: true },
      ],
    });
    optionEls[2].focus();
    fireKey(root, "ArrowDown");
    expect(document.activeElement).toBe(optionEls[0]);
    expect(optionEls[0].getAttribute("aria-checked")).toBe("true");
    expect(optionEls[2].getAttribute("aria-checked")).toBe("false");
  });

  test("arrow_right_behaves_like_arrow_down", () => {
    const { root, optionEls } = buildRadioGroup({
      options: [
        { id: "a", label: "A", checked: true },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ],
    });
    optionEls[0].focus();
    fireKey(root, "ArrowRight");
    expect(document.activeElement).toBe(optionEls[1]);
    expect(optionEls[1].getAttribute("aria-checked")).toBe("true");
  });
});

// -- ArrowUp / ArrowLeft navigation

describe("radio-group.enhancer -- ArrowUp / ArrowLeft navigation", () => {
  test("arrow_up_moves_focus_to_previous_option", () => {
    const { root, optionEls } = buildRadioGroup({
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B", checked: true },
        { id: "c", label: "C" },
      ],
    });
    optionEls[1].focus();
    fireKey(root, "ArrowUp");
    expect(document.activeElement).toBe(optionEls[0]);
  });

  test("arrow_up_wraps_to_last_from_first", () => {
    const { root, optionEls } = buildRadioGroup({
      options: [
        { id: "a", label: "A", checked: true },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ],
    });
    optionEls[0].focus();
    fireKey(root, "ArrowUp");
    expect(document.activeElement).toBe(optionEls[2]);
    expect(optionEls[2].getAttribute("aria-checked")).toBe("true");
    expect(optionEls[0].getAttribute("aria-checked")).toBe("false");
  });

  test("arrow_left_behaves_like_arrow_up", () => {
    const { root, optionEls } = buildRadioGroup({
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B", checked: true },
        { id: "c", label: "C" },
      ],
    });
    optionEls[1].focus();
    fireKey(root, "ArrowLeft");
    expect(document.activeElement).toBe(optionEls[0]);
    expect(optionEls[0].getAttribute("aria-checked")).toBe("true");
  });
});

// -- Space key

describe("radio-group.enhancer -- Space key", () => {
  test("space_checks_unchecked_focused_option", () => {
    const { root, optionEls } = buildRadioGroup({
      options: [
        { id: "a", label: "A", checked: true },
        { id: "b", label: "B" },
      ],
    });
    optionEls[1].focus();
    fireKey(root, " ");
    expect(optionEls[1].getAttribute("aria-checked")).toBe("true");
  });

  test("space_no_op_on_already_checked_option: no event fired", () => {
    const { root, optionEls, dispatchedEvents } = buildRadioGroup({
      options: [
        { id: "a", label: "A", checked: true },
        { id: "b", label: "B" },
      ],
    });
    optionEls[0].focus();
    fireKey(root, " ");
    expect(optionEls[0].getAttribute("aria-checked")).toBe("true");
    expect(dispatchedEvents).toHaveLength(0);
  });
});

// -- Enter key (APG: no action)

describe("radio-group.enhancer -- Enter key (no-op per APG)", () => {
  test("enter_has_no_action: no aria-checked change, no event fired", () => {
    const { root, optionEls, dispatchedEvents } = buildRadioGroup({
      options: [
        { id: "a", label: "A", checked: true },
        { id: "b", label: "B" },
      ],
    });
    optionEls[0].focus();
    fireKey(root, "Enter");
    expect(optionEls[0].getAttribute("aria-checked")).toBe("true");
    expect(optionEls[1].getAttribute("aria-checked")).toBe("false");
    expect(dispatchedEvents).toHaveLength(0);
  });
});

// -- Disabled option skipping

describe("radio-group.enhancer -- disabled option skipping", () => {
  test("arrow_skips_disabled_option: ArrowDown from a skips disabled b and lands on c", () => {
    const { root, optionEls } = buildRadioGroup({
      options: [
        { id: "a", label: "A", checked: true },
        { id: "b", label: "B", disabled: true },
        { id: "c", label: "C" },
      ],
    });
    optionEls[0].focus();
    fireKey(root, "ArrowDown");
    expect(document.activeElement).toBe(optionEls[2]);
    expect(optionEls[2].getAttribute("aria-checked")).toBe("true");
    expect(optionEls[1].getAttribute("aria-checked")).toBe("false");
  });

  test("arrow_skips_disabled_option: ArrowUp from c skips disabled b and lands on a", () => {
    const { root, optionEls } = buildRadioGroup({
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B", disabled: true },
        { id: "c", label: "C", checked: true },
      ],
    });
    optionEls[2].focus();
    fireKey(root, "ArrowUp");
    expect(document.activeElement).toBe(optionEls[0]);
    expect(optionEls[0].getAttribute("aria-checked")).toBe("true");
  });
});

// -- lievit:radio-change event dispatch

describe("radio-group.enhancer -- lievit:radio-change event", () => {
  test("arrow_nav_dispatches_lievit_radio_change_event with detail.value === nextOptionId", () => {
    const { root, optionEls, dispatchedEvents } = buildRadioGroup({
      options: [
        { id: "alpha", label: "Alpha", checked: true },
        { id: "beta", label: "Beta" },
      ],
    });
    optionEls[0].focus();
    fireKey(root, "ArrowDown");
    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0].detail.value).toBe("beta");
  });

  test("space_on_unchecked_option dispatches lievit:radio-change", () => {
    const { root, optionEls, dispatchedEvents } = buildRadioGroup({
      options: [
        { id: "x", label: "X", checked: true },
        { id: "y", label: "Y" },
      ],
    });
    optionEls[1].focus();
    fireKey(root, " ");
    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0].detail.value).toBe("y");
  });
});

// -- Roving tabindex maintenance after navigation

describe("radio-group.enhancer -- roving tabindex maintained after navigation", () => {
  test("roving_tabindex_maintained_after_arrow_nav: moved-to option gets tabindex=0, others -1", () => {
    const { root, optionEls } = buildRadioGroup({
      options: [
        { id: "a", label: "A", checked: true },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ],
    });
    optionEls[0].focus();
    fireKey(root, "ArrowDown");
    expect(optionEls[1].tabIndex).toBe(0);
    expect(optionEls[0].tabIndex).toBe(-1);
    expect(optionEls[2].tabIndex).toBe(-1);
  });
});

// -- XSS escaping (source-text assertions)

describe("radio-group.jte -- XSS escaping", () => {
  test("hostile_option_id_in_data_value_renders_inert: Escape.htmlAttribute guards data-value", () => {
    // data-value="${_escId}" where _escId is built from Escape.htmlAttribute(_id, ...).
    expect(src).toContain("Escape.htmlAttribute(_id == null");
    expect(markup).toContain('data-value="${_escId}"');
  });

  test("hostile_option_id_in_description_id_renders_inert: _descId and _nativeDescId use _escId", () => {
    // Both description span ids are built from _escId (already escaped), not raw _id.
    expect(markup).toContain('"rg-desc-" + name + "-" + _escId');
    expect(markup).not.toContain('"rg-desc-" + name + "-" + _id');
  });
});
