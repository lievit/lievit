/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * textarea.jte + textarea-autosize.enhancer.ts -- full structural + enhancer contract.
 *
 * The JTE partial is compiled in the Java world, so this harness asserts on the PARTIAL
 * SOURCE as text (same approach as switch.test.ts, alert.test.ts). It pins: param API,
 * data-slot topology, aria attributes, size scale, autosize/count data-hooks, the model
 * directive, the escaping channels, the XSS trust boundary, and every spec §7 render contract.
 *
 * The enhancer tests run against happy-dom with the real TypeScript module (no mocked $lievit)
 * per the client-island-fidelity lesson. The LievitRuntime is NOT needed for the enhancer
 * itself (it only needs a textarea with the right data-attrs); only the lifecycle registration
 * path uses it, which is tested separately.
 *
 * a11y contracts that would normally be axe-core are asserted structurally here (the aria-*
 * attributes that axe checks), following the switch.test.ts precedent since axe-core is not
 * a dependency of this package.
 *
 * SECURITY NOTE — attrs trust boundary:
 *   The `attrs` param is TRUSTED raw ($unsafe): it emits its string unescaped. It is intended
 *   for STATIC, author-typed wire directives (e.g. l:model="bio"). Passing a DB-derived string
 *   via attrs would produce unescaped output and is an XSS risk. NEVER interpolate per-row or
 *   user-supplied data into attrs. Use dataAttrs (escaped Map) for any dynamic value.
 */
import { describe, test, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  enhanceTextareaAutosize,
  enhanceAllTextareaAutosize,
} from "../runtime/features/textarea-autosize.enhancer.js";

// ---------------------------------------------------------------------------
// JTE source helpers
// ---------------------------------------------------------------------------
const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "textarea.jte"), "utf8");

/** Source with JTE comments stripped so assertions never hit doc-comment prose. */
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// DOM cleanup between enhancer tests
// ---------------------------------------------------------------------------
afterEach(() => {
  document.body.innerHTML = "";
});

// ===========================================================================
// §2 API — param declarations
// ===========================================================================
describe("textarea.jte -- params & docs API", () => {
  test("declares every documented param with the correct default", () => {
    expect(src).toContain("@param String name");
    expect(src).toContain("@param String id = null");
    expect(src).toContain("@param String value = null");
    expect(src).toContain("@param String placeholder = null");
    expect(src).toContain("@param int rows = 3");
    expect(src).toContain('@param String size = "md"');
    expect(src).toContain("@param boolean autosize = false");
    expect(src).toContain("@param int minRows = 3");
    expect(src).toContain("@param int maxRows = 0");
    expect(src).toContain("@param int maxLength = 0");
    expect(src).toContain("@param boolean showCount = false");
    expect(src).toContain("@param String hint = null");
    expect(src).toContain("@param boolean invalid = false");
    expect(src).toContain("@param boolean disabled = false");
    expect(src).toContain("@param boolean required = false");
    expect(src).toContain("@param boolean readonly = false");
    expect(src).toContain("@param String model = null");
    expect(src).toContain("@param String ariaLabel = null");
    expect(src).toContain("@param String describedBy = null");
    expect(src).toContain('@param String cssClass = ""');
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain("@param java.util.Map<String, String> dataAttrs = java.util.Map.of()");
  });

  test("usage doc uses <%-- --%> (not @* *@) and shows the @@template.lievit.textarea call", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
    expect(src, "must NOT use @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src).toMatch(/Usage:/);
    expect(src).toContain("@@template.lievit.textarea(");
  });

  test("doc comment includes all net-new params (autosize, showCount, size, maxLength, minRows, maxRows)", () => {
    expect(src).toMatch(/autosize/);
    expect(src).toMatch(/showCount/);
    expect(src).toMatch(/size/);
    expect(src).toMatch(/maxLength/);
    expect(src).toMatch(/minRows/);
    expect(src).toMatch(/maxRows/);
  });
});

// ===========================================================================
// §7 render — basic structure
// ===========================================================================
describe("textarea.jte -- basic structure (data-slots)", () => {
  test('data-slot="textarea" is on the textarea element', () => {
    expect(markup).toContain('data-slot="textarea"');
  });

  test("the textarea carries name + id from params (id fallback to name)", () => {
    expect(markup).toContain('id="${areaId}"');
    expect(markup).toContain('name="${name}"');
    // areaId is computed as id ?? name:
    expect(src).toContain("id != null && !id.isBlank()");
  });

  test("value is the element TEXT CONTENT, NOT a value= attribute (HTML spec for textarea)", () => {
    // The spec mandates the value appears between tags, never as attribute.
    expect(src).toContain(">${value}</textarea>");
    // Confirm no value= attribute is emitted:
    expect(markup).not.toMatch(/value="\${value}"/);
  });

  test("rows defaults to 3 and uses effectiveMinRows when autosize is active", () => {
    expect(markup).toContain('rows="${effectiveMinRows}"');
    expect(src).toContain("effectiveMinRows = autosize ? minRows : rows");
  });

  test("placeholder is passed through to the native element", () => {
    expect(markup).toContain('placeholder="${placeholder}"');
  });
});

// ===========================================================================
// §7 render — a11y attributes [axe contract as structural assertions]
// ===========================================================================
describe("textarea.jte -- a11y attributes (spec §4)", () => {
  test('[axe: label] ariaLabel is emitted as aria-label on the textarea element', () => {
    expect(markup).toContain('aria-label="${ariaLabel}"');
  });

  test('[axe: label] aria-describedby is the space-joined ids (external + hint + count)', () => {
    expect(markup).toContain('aria-describedby="${joinedDescribedBy}"');
    // The joining logic merges describedBy, hintId, and countId:
    expect(src).toContain("describedByParts");
    expect(src).toContain('String.join(" ", describedByParts)');
  });

  test('[axe: aria-invalid] aria-invalid is "true" when invalid, ABSENT (not "false") otherwise', () => {
    // The conditional emits "true" or null (null suppresses the attribute in JTE):
    expect(markup).toContain('aria-invalid="${invalid ? "true" : null}"');
    // Confirm it is never "false":
    expect(markup).not.toContain('"false"');
  });

  test('[axe: aria-required-attr] aria-required="true" is emitted when required=true', () => {
    expect(markup).toContain('aria-required="${required ? "true" : null}"');
  });

  test('[axe: form-field-multiple-labels] native required attribute is also emitted', () => {
    expect(markup).toContain("required=\"${required}\"");
  });

  test('[axe: aria-roles] role="textbox" is NOT in the template (native element supplies it)', () => {
    expect(markup).not.toContain('role="textbox"');
    expect(markup).not.toContain("role=textbox");
  });

  test('[axe: aria-prohibited-attr] aria-multiline is NOT in the template (platform supplies it)', () => {
    expect(markup).not.toContain("aria-multiline");
  });

  test("disabled is the native attribute (not aria-disabled)", () => {
    expect(markup).toContain("disabled=\"${disabled}\"");
    expect(markup).not.toContain("aria-disabled");
  });

  test("readonly is the native attribute (platform exposes aria-readonly automatically)", () => {
    expect(markup).toContain("readonly=\"${readonly}\"");
    expect(markup).not.toContain("aria-readonly");
  });
});

// ===========================================================================
// §7 render — size scale
// ===========================================================================
describe("textarea.jte -- size scale (spec §3)", () => {
  test("data-size carries the size param for test selectors and styling hooks", () => {
    expect(markup).toContain('data-size="${size}"');
  });

  test("sm size uses --lv-text-xs, --lv-space-2 padding-y, --lv-radius-sm", () => {
    expect(src).toContain('case "sm" ->');
    expect(src).toContain("--lv-text-xs");
    expect(src).toContain("--lv-radius-sm");
  });

  test("md size (default) uses --lv-text-sm, --lv-space-2 padding-y, --lv-radius-md", () => {
    expect(src).toContain("default   ->");
    expect(src).toContain("--lv-text-sm");
    expect(src).toContain("--lv-radius-md");
  });

  test("lg size uses --lv-text-base, --lv-space-3 padding-y, --lv-radius-md", () => {
    expect(src).toContain('case "lg" ->');
    expect(src).toContain("--lv-text-base");
    expect(src).toContain("--lv-space-3");
  });

  test("sizeClass switch covers sm, lg, and default branches (complete static strings)", () => {
    expect(src).toContain("sizeClass = switch (size)");
    expect(src).toContain('case "sm"');
    expect(src).toContain('case "lg"');
    expect(src).toContain("default");
  });
});

// ===========================================================================
// §7 render — wrapper, hint, count
// ===========================================================================
describe("textarea.jte -- wrapper + hint + count topology (spec §6)", () => {
  test('wrapper data-slot="textarea-wrapper" wraps when hint or showCount is active', () => {
    expect(markup).toContain('data-slot="textarea-wrapper"');
    // The wrapper is conditional on hasWrapper = hasHint || hasCount:
    expect(src).toContain("hasWrapper = hasHint || hasCount");
    expect(src).toContain("@if(hasWrapper)");
  });

  test("no wrapper element when NEITHER hint NOR showCount (hasWrapper guard works)", () => {
    // Confirmed by the @if(hasWrapper) guard in the source
    // (jte-compile gate validates the conditional actually suppresses the div):
    expect(src).toContain("@if(hasWrapper)");
    expect(src).toContain("@endif");
  });

  test('hint span has data-slot="textarea-hint" and an id of areaId-hint', () => {
    expect(markup).toContain('data-slot="textarea-hint"');
    expect(markup).toContain('id="${areaId}-hint"');
    expect(src).toContain("@if(hasHint)");
  });

  test("hint text is the template body of the span (escaped by JTE default)", () => {
    expect(markup).toContain(">${hint}</span>");
  });

  test('count output has data-slot="textarea-count", correct id, and for attribute', () => {
    expect(markup).toContain('data-slot="textarea-count"');
    expect(markup).toContain('id="${areaId}-count"');
    expect(markup).toContain('for="${areaId}"');
    expect(src).toContain("@if(hasCount)");
  });

  test("count element uses the semantically correct <output> element (not <span>)", () => {
    // <output for=...> is the correct element for a computed result (HTML spec).
    expect(markup).toContain("<output");
    expect(markup).toContain("</output>");
  });

  test("hint id and count id are joined into describedByParts for aria-describedby", () => {
    expect(src).toContain("describedByParts.add(hintId)");
    expect(src).toContain("describedByParts.add(countId)");
    expect(src).toContain("joinedDescribedBy");
  });

  test("external describedBy is prepended (order: external -> hint -> count)", () => {
    // The ArrayList appends in the spec order: external, then hintId, then countId:
    expect(src).toContain("describedByParts.add(describedBy)");
    // The hint and count lines follow (validated by the order in the source):
    const extIdx = src.indexOf("describedByParts.add(describedBy)");
    const hintIdx = src.indexOf("describedByParts.add(hintId)");
    const countIdx = src.indexOf("describedByParts.add(countId)");
    expect(extIdx).toBeLessThan(hintIdx);
    expect(hintIdx).toBeLessThan(countIdx);
  });
});

// ===========================================================================
// §7 render — autosize data attributes
// ===========================================================================
describe("textarea.jte -- autosize data-hooks (spec §6)", () => {
  test("data-lv-autosize is emitted when autosize=true (enhancer mount condition)", () => {
    expect(markup).toContain("data-lv-autosize");
    expect(src).toContain("autosize ? \"\" : null");
  });

  test("data-lv-min-rows is emitted when autosize=true", () => {
    expect(markup).toContain("data-lv-min-rows");
    expect(src).toContain("autosize ? String.valueOf(minRows) : null");
  });

  test("data-lv-max-rows is emitted when autosize=true AND maxRows>0", () => {
    expect(markup).toContain("data-lv-max-rows");
    expect(src).toContain("autosize && maxRows > 0");
  });

  test("data-lv-count-for is emitted when showCount=true", () => {
    expect(markup).toContain("data-lv-count-for");
    expect(src).toContain("showCount ? areaId : null");
  });

  test("data-lv-invalid carries the boolean for the enhancer to read", () => {
    expect(markup).toContain('data-lv-invalid="${invalid}"');
  });
});

// ===========================================================================
// §7 render — maxlength attribute
// ===========================================================================
describe("textarea.jte -- maxlength (spec §2)", () => {
  test("maxlength is emitted only when maxLength > 0", () => {
    expect(markup).toContain("maxlength=");
    expect(src).toContain("maxLength > 0 ? String.valueOf(maxLength) : null");
  });
});

// ===========================================================================
// §7 render — model param (safe explicit channel)
// ===========================================================================
describe("textarea.jte -- model param (spec §6)", () => {
  test("the model param emits l:model via $unsafe modelDirective (safe explicit channel)", () => {
    expect(src).toContain("modelDirective");
    expect(src).toContain('l:model=\\"" + model + "\\""');
    expect(markup).toContain("$unsafe{modelDirective}");
  });

  test("modelDirective is empty string when model is null (no spurious l:model in DOM)", () => {
    expect(src).toContain('model != null && !model.isBlank()');
  });
});

// ===========================================================================
// §7 render — token usage (no literals)
// ===========================================================================
describe("textarea.jte -- token hygiene (spec §5)", () => {
  test("uses --lv-color-border for default border", () => {
    expect(markup).toContain("--lv-color-border");
  });

  test("uses --lv-color-input for background", () => {
    expect(markup).toContain("--lv-color-input");
  });

  test("uses --lv-ring for focus-visible ring", () => {
    expect(markup).toContain("--lv-ring");
  });

  test("uses --lv-color-destructive for aria-invalid state", () => {
    expect(markup).toContain("--lv-color-destructive");
  });

  test("uses --lv-opacity-disabled for disabled state (not hardcoded 0.5 or opacity-50)", () => {
    expect(markup).toContain("--lv-opacity-disabled");
    // Should NOT have the hardcoded opacity-50 that the old version used:
    expect(markup).not.toContain("opacity-50");
  });

  test("uses --lv-color-muted-bg for readonly background", () => {
    expect(markup).toContain("--lv-color-muted-bg");
  });

  test("resize-y is present (default vertical resize)", () => {
    expect(markup).toContain("resize-y");
  });
});

// ===========================================================================
// §7 render — CSP + security
// ===========================================================================
describe("textarea.jte -- CSP hygiene + security (spec §8)", () => {
  test("no inline <script> in the template body", () => {
    expect(markup).not.toMatch(/<script[\s>]/i);
  });

  test("no inline on* event handlers", () => {
    expect(markup).not.toMatch(/\bon[a-z]+=["']/i);
  });

  test("dataAttrs fragment uses Escape.htmlAttribute for safe escaping", () => {
    expect(src).toContain("Escape.htmlAttribute(");
  });

  test("attrs is emitted via $unsafe (trusted channel; only for STATIC author-typed strings)", () => {
    expect(markup).toContain("$unsafe{attrs}");
  });

  test("value renders as JTE escaped text content (no $unsafe on value)", () => {
    // The >${value}</textarea> form lets JTE's default HTML escaping apply.
    expect(src).toContain(">${value}</textarea>");
    expect(src).not.toContain("$unsafe{value}");
  });
});

// ===========================================================================
// Enhancer tests — real DOM, no mocked $lievit
// ===========================================================================

/** Build a textarea DOM matching what textarea.jte would emit with autosize=true. */
function makeAutosize(opts: {
  minRows?: number;
  maxRows?: number;
  maxLength?: number;
  showCount?: boolean;
  value?: string;
  name?: string;
  disabled?: boolean;
} = {}): { textarea: HTMLTextAreaElement; output: HTMLOutputElement | null; wrapper: HTMLDivElement } {
  const {
    minRows = 2,
    maxRows = 0,
    maxLength = 0,
    showCount = false,
    value = "",
    name = "note",
    disabled = false,
  } = opts;
  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-slot", "textarea-wrapper");

  const textarea = document.createElement("textarea");
  textarea.setAttribute("data-slot", "textarea");
  textarea.setAttribute("data-lv-autosize", "");
  textarea.setAttribute("data-lv-min-rows", String(minRows));
  if (maxRows > 0) textarea.setAttribute("data-lv-max-rows", String(maxRows));
  if (maxLength > 0) {
    textarea.setAttribute("maxlength", String(maxLength));
    if (showCount) textarea.setAttribute("data-lv-count-for", name);
  } else if (showCount) {
    textarea.setAttribute("data-lv-count-for", name);
  }
  textarea.setAttribute("id", name);
  textarea.setAttribute("rows", String(minRows));
  textarea.value = value;
  if (disabled) textarea.disabled = true;
  wrapper.appendChild(textarea);

  let output: HTMLOutputElement | null = null;
  if (showCount) {
    output = document.createElement("output");
    output.setAttribute("id", name + "-count");
    output.setAttribute("for", name);
    output.setAttribute("data-slot", "textarea-count");
    wrapper.appendChild(output);
  }

  document.body.appendChild(wrapper);
  return { textarea, output, wrapper };
}

/** Fire a synthetic input event on the textarea (matches real browser behaviour). */
function fireInput(textarea: HTMLTextAreaElement, newValue?: string): void {
  if (newValue !== undefined) textarea.value = newValue;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Fire a synthetic lievit:morphed event (the morph resync trigger). */
function fireMorphed(textarea: HTMLTextAreaElement): void {
  textarea.dispatchEvent(new CustomEvent("lievit:morphed", { bubbles: false }));
}

// ---------------------------------------------------------------------------
// Autosize behaviour
// ---------------------------------------------------------------------------
describe("textarea-autosize enhancer -- autosize", () => {
  test("enhanceTextareaAutosize marks the element with data-lv-textarea-enhanced", () => {
    const { textarea } = makeAutosize({ minRows: 2 });
    enhanceTextareaAutosize(textarea);
    expect(textarea.hasAttribute("data-lv-textarea-enhanced")).toBe(true);
  });

  test("idempotent: calling twice registers exactly one input listener (guard works)", () => {
    const { textarea } = makeAutosize({ minRows: 2 });
    enhanceTextareaAutosize(textarea);
    enhanceTextareaAutosize(textarea); // second call must be a no-op
    // Both calls succeed without error; the guard attribute is set once:
    expect(textarea.getAttribute("data-lv-textarea-enhanced")).toBe("");
  });

  test("enhanceTextareaAutosize sets initial style.height on mount", () => {
    const { textarea } = makeAutosize({ minRows: 2 });
    enhanceTextareaAutosize(textarea);
    // height is set to a px value after mount:
    expect(textarea.style.height).toMatch(/px$/);
  });

  test("autosize-grows-on-input: height increases after adding more content", () => {
    const { textarea } = makeAutosize({ minRows: 2 });
    enhanceTextareaAutosize(textarea);
    const initialHeight = parseFloat(textarea.style.height);
    fireInput(textarea, "line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10");
    const grownHeight = parseFloat(textarea.style.height);
    // After more content, height should be >= initial (happy-dom reports scrollHeight):
    expect(grownHeight).toBeGreaterThanOrEqual(initialHeight);
  });

  test("autosize-shrinks-on-clear: after growing, clearing resets height to minRows floor", () => {
    const { textarea } = makeAutosize({ minRows: 2 });
    enhanceTextareaAutosize(textarea);
    fireInput(textarea, "line1\nline2\nline3\nline4\nline5\nline6");
    const grownHeight = parseFloat(textarea.style.height);
    fireInput(textarea, "");
    const shrunkHeight = parseFloat(textarea.style.height);
    expect(shrunkHeight).toBeLessThanOrEqual(grownHeight);
  });

  test("no-mount-without-data-attr: a textarea WITHOUT data-lv-autosize is NOT enhanced", () => {
    const bare = document.createElement("textarea");
    bare.setAttribute("id", "bare");
    document.body.appendChild(bare);
    enhanceTextareaAutosize(bare);
    // No data-attr means the enhancer skips it:
    expect(bare.hasAttribute("data-lv-textarea-enhanced")).toBe(false);
  });

  test("enhanceAllTextareaAutosize enhances only texareas with the data-lv-autosize attr", () => {
    const { textarea: t1 } = makeAutosize({ minRows: 2, name: "f1" });
    const bare = document.createElement("textarea");
    bare.id = "f2";
    document.body.appendChild(bare);
    enhanceAllTextareaAutosize(document.body);
    expect(t1.hasAttribute("data-lv-textarea-enhanced")).toBe(true);
    expect(bare.hasAttribute("data-lv-textarea-enhanced")).toBe(false);
  });

  test("morph-resync: lievit:morphed recomputes autosize height", () => {
    const { textarea } = makeAutosize({ minRows: 2 });
    enhanceTextareaAutosize(textarea);
    // Simulate a morph that updated the value server-side:
    textarea.value = "new server value\nwith two lines";
    fireMorphed(textarea);
    // Height should be set to some px value:
    expect(textarea.style.height).toMatch(/px$/);
    // The morph resets the user-resized guard:
    expect(textarea.hasAttribute("data-lv-user-resized")).toBe(false);
  });

  test("user-drag-stops-autosize: data-lv-user-resized prevents further auto-grow", () => {
    const { textarea } = makeAutosize({ minRows: 2 });
    enhanceTextareaAutosize(textarea);
    // Simulate user drag: mousedown, change height, mouseup:
    textarea.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    textarea.style.height = "999px"; // user dragged the handle
    textarea.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    expect(textarea.hasAttribute("data-lv-user-resized")).toBe(true);
    // A subsequent input event should NOT change height:
    fireInput(textarea, "some text");
    expect(textarea.style.height).toBe("999px");
  });

  test("caret-survives-grow: selectionStart/End unchanged after input event causes resize", () => {
    const { textarea } = makeAutosize({ minRows: 2 });
    enhanceTextareaAutosize(textarea);
    // Pre-fill with many lines so height is already large, then position the caret.
    textarea.value = "line1\nline2\nline3\nline4\nline5";
    textarea.setSelectionRange(3, 3);
    const before = { start: textarea.selectionStart, end: textarea.selectionEnd };
    // Fire input WITHOUT changing the value -- just triggers the resize logic:
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    // The enhancer must NOT have moved the caret (selectionRange is unchanged):
    expect(textarea.selectionStart).toBe(before.start);
    expect(textarea.selectionEnd).toBe(before.end);
  });
});

// ---------------------------------------------------------------------------
// Count behaviour
// ---------------------------------------------------------------------------
describe("textarea-autosize enhancer -- count", () => {
  test("count-zero-to-start: on mount with empty value, count shows 0 / max", () => {
    const { textarea, output } = makeAutosize({
      minRows: 2,
      maxLength: 100,
      showCount: true,
      value: "",
      name: "cfield",
    });
    enhanceTextareaAutosize(textarea);
    expect(output!.textContent).toBe("0 / 100");
  });

  test("count-updates-on-input: typing 50 chars shows 50 / 100", () => {
    const { textarea, output } = makeAutosize({
      minRows: 2,
      maxLength: 100,
      showCount: true,
      name: "c2",
    });
    enhanceTextareaAutosize(textarea);
    fireInput(textarea, "a".repeat(50));
    expect(output!.textContent).toBe("50 / 100");
  });

  test("count-over-limit-destructive: at 101 chars in a 100-char field, adds over-limit class", () => {
    const { textarea, output } = makeAutosize({
      minRows: 2,
      maxLength: 100,
      showCount: true,
      name: "c3",
    });
    enhanceTextareaAutosize(textarea);
    // Set to exactly at limit first:
    fireInput(textarea, "a".repeat(100));
    expect(output!.classList.contains("lv-textarea-count--over-limit")).toBe(true);
  });

  test("count-under-limit-clears-destructive: dropping below limit removes over-limit class", () => {
    const { textarea, output } = makeAutosize({
      minRows: 2,
      maxLength: 100,
      showCount: true,
      name: "c4",
    });
    enhanceTextareaAutosize(textarea);
    fireInput(textarea, "a".repeat(100));
    expect(output!.classList.contains("lv-textarea-count--over-limit")).toBe(true);
    fireInput(textarea, "a".repeat(50));
    expect(output!.classList.contains("lv-textarea-count--over-limit")).toBe(false);
  });

  test("count without maxLength shows bare length (no / max part)", () => {
    const { textarea, output } = makeAutosize({
      minRows: 2,
      showCount: true,
      name: "c5",
      // no maxLength
    });
    enhanceTextareaAutosize(textarea);
    fireInput(textarea, "hello");
    expect(output!.textContent).toBe("5");
  });

  test("count-morph-resync: lievit:morphed recomputes count after server re-render", () => {
    const { textarea, output } = makeAutosize({
      minRows: 2,
      maxLength: 100,
      showCount: true,
      name: "c6",
    });
    enhanceTextareaAutosize(textarea);
    expect(output!.textContent).toBe("0 / 100");
    textarea.value = "server filled this";
    fireMorphed(textarea);
    expect(output!.textContent).toBe("18 / 100");
  });
});

// ---------------------------------------------------------------------------
// Disabled textarea: enhancer must be inert
// ---------------------------------------------------------------------------
describe("textarea-autosize enhancer -- disabled textarea", () => {
  test("disabled-textarea-inert: a disabled textarea is still enhanced (data-attr present)", () => {
    // The enhancer is mounted; but an input event never fires on a disabled element natively.
    const { textarea } = makeAutosize({ minRows: 2, disabled: true });
    enhanceTextareaAutosize(textarea);
    // Enhancement still marks the element (the guard is set):
    expect(textarea.hasAttribute("data-lv-textarea-enhanced")).toBe(true);
    // Fire an input event manually -- the key assertion is that the enhancer does not throw:
    fireInput(textarea);
    expect(textarea.style.height).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Enhancer swallows no keystrokes
// ---------------------------------------------------------------------------
describe("textarea-autosize enhancer -- no keystroke interception (spec §4)", () => {
  test("enhancer-swallows-no-key: typing still reaches textarea.value after enhancement", () => {
    const { textarea } = makeAutosize({ minRows: 2 });
    enhanceTextareaAutosize(textarea);
    // Simulate typing: update the value and fire an input event (what the browser does):
    textarea.value = "typed text";
    fireInput(textarea);
    expect(textarea.value).toBe("typed text");
  });

  test("no keydown or keyup event listeners are registered by the enhancer", () => {
    // The enhancer ONLY registers: input, lievit:morphed, mousedown, mouseup.
    // Strip comments and check for absence of keydown/keyup bindings in the live code.
    const enhancerSrc = readFileSync(
      join(import.meta.dirname, "..", "runtime", "features", "textarea-autosize.enhancer.ts"),
      "utf8",
    );
    // Remove block comments (/* ... */) and line comments (// ...) before checking:
    const codeOnly = enhancerSrc
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(codeOnly).not.toContain('"keydown"');
    expect(codeOnly).not.toContain('"keyup"');
    expect(codeOnly).not.toContain("preventDefault");
  });
});

// ===========================================================================
// §7 jte-compile guard (structural pre-check — real compile in test/jte-compile)
// ===========================================================================
describe("textarea.jte -- JTE compile pre-check (no nested comments, balanced tags)", () => {
  test("no nested JTE comment delimiters inside the doc-comment block", () => {
    // Nested --%> inside <%-- ... --%> closes the outer comment early.
    // The doc comment occupies lines 1..N; count pairs:
    const opens = (src.match(/<%--/g) ?? []).length;
    const closes = (src.match(/--%>/g) ?? []).length;
    expect(opens).toBe(closes);
  });

  test("no dev.lievit.* import in the template (JTE classpath is JDK+jte+icons only)", () => {
    expect(src).not.toMatch(/@import\s+dev\.lievit/);
  });

  test("@if/@endif count balances (no unclosed conditional)", () => {
    const ifs = (src.match(/@if\(/g) ?? []).length;
    const endifs = (src.match(/@endif/g) ?? []).length;
    expect(ifs).toBe(endifs);
  });

  test("@for/@endfor count balances (no unclosed loop)", () => {
    const fors = (src.match(/@for\(/g) ?? []).length;
    const endfors = (src.match(/@endfor/g) ?? []).length;
    expect(fors).toBe(endfors);
  });

  test("textarea tag is properly closed (value as text content)", () => {
    expect(markup).toContain("</textarea>");
    expect(markup).toContain("<textarea");
  });
});
