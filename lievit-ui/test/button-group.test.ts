/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * button-group.jte -- structural golden for the v-next layout wrapper.
 *
 * button-group is a pure layout partial: role=group div that collapses inner border-radius
 * and merges adjacent borders on any children. Zero JS, zero client state.
 * This suite pins the HTML structure, ARIA contract, CSS join-trick, attrs pass-through,
 * and CSP cleanliness as source-text assertions.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "button-group.jte"), "utf8");
/** Source with doc comment stripped so assertions never accidentally match doc prose. */
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// §1 API — param declarations
// ---------------------------------------------------------------------------
describe("button-group.jte -- params", () => {
  test("declares every documented param with the correct default", () => {
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).toContain('@param String orientation = "horizontal"');
    expect(src).toContain("@param String label = null");
    expect(src).toContain('@param String cssClass = ""');
    expect(src).toContain('@param String attrs = ""');
  });

  test("content has no default (required)", () => {
    // If content had a default the @param line would end with "= ..."
    expect(src).toMatch(/@param gg\.jte\.Content content\s*\n/);
  });

  test("does NOT declare removed params (icon, pressedAction, value, invalid, wireClick)", () => {
    // button-group is layout only: no interactive params
    expect(src).not.toContain("@param String wireClick");
    expect(src).not.toContain("@param boolean invalid");
    expect(src).not.toContain("@param String pressedAction");
    expect(src).not.toContain("@param String value");
  });
});

// ---------------------------------------------------------------------------
// §2 Structure — root element
// ---------------------------------------------------------------------------
describe("button-group.jte -- root element structure", () => {
  test("root is a <div> with role=group", () => {
    expect(markup).toContain("<div");
    expect(markup).toContain('role="group"');
  });

  test("data-slot=button-group identifies the root", () => {
    expect(markup).toContain('data-slot="button-group"');
  });

  test("data-orientation reflects the orientation param", () => {
    expect(markup).toContain('data-orientation="${orientation}"');
  });

  test("aria-label is emitted (null becomes absent via JTE smart attr)", () => {
    expect(markup).toContain('aria-label="${label}"');
  });
});

// ---------------------------------------------------------------------------
// §3 CSS — flex layout + join-trick
// ---------------------------------------------------------------------------
describe("button-group.jte -- CSS layout and join-trick classes", () => {
  test("root carries inline-flex w-fit items-stretch for the flex box", () => {
    expect(src).toContain("inline-flex w-fit items-stretch");
  });

  test("horizontal joinReset: collapsed left rounding + border on non-first-child", () => {
    expect(src).toContain("[&>*:not(:first-child)]:rounded-l-none");
    expect(src).toContain("[&>*:not(:first-child)]:border-l-0");
    expect(src).toContain("[&>*:not(:last-child)]:rounded-r-none");
  });

  test("vertical joinReset: collapsed top rounding + border on non-first-child", () => {
    expect(src).toContain("[&>*:not(:first-child)]:rounded-t-none");
    expect(src).toContain("[&>*:not(:first-child)]:border-t-0");
    expect(src).toContain("[&>*:not(:last-child)]:rounded-b-none");
  });

  test("focus ring guard: focused children raise z-index so ring is not clipped", () => {
    expect(src).toContain("[&>*:focus-visible]:relative");
    expect(src).toContain("[&>*:focus-visible]:z-10");
  });

  test("flex axis is computed from orientation (flex-row / flex-col)", () => {
    expect(src).toContain("flex-row");
    expect(src).toContain("flex-col");
  });

  test("cssClass is appended to the root class attribute", () => {
    expect(markup).toContain("${cssClass}");
  });
});

// ---------------------------------------------------------------------------
// §4 attrs pass-through ($unsafe channel)
// ---------------------------------------------------------------------------
describe("button-group.jte -- attrs $unsafe pass-through", () => {
  test("attrs is emitted via $unsafe{attrs} on the root element", () => {
    expect(markup).toContain("$unsafe{attrs}");
  });
});

// ---------------------------------------------------------------------------
// §5 Content slot
// ---------------------------------------------------------------------------
describe("button-group.jte -- content slot", () => {
  test("content slot is rendered directly inside the root div", () => {
    expect(markup).toContain("${content}");
  });

  test("content slot renders inline with no extra whitespace wrapper", () => {
    // The content renders as >${content}</div> to avoid adding whitespace
    expect(markup).toMatch(/>\s*\$\{content\}\s*<\/div>/);
  });
});

// ---------------------------------------------------------------------------
// §6 CSP safety
// ---------------------------------------------------------------------------
describe("button-group.jte -- CSP safety", () => {
  test("no inline <script> tags", () => {
    expect(markup).not.toMatch(/<script/);
  });

  test("no on* inline event handlers", () => {
    expect(markup).not.toMatch(/\son[a-z]+=/);
  });
});

// ---------------------------------------------------------------------------
// §7 Documentation
// ---------------------------------------------------------------------------
describe("button-group.jte -- documentation", () => {
  test("has a <%-- --%> doc comment (not @* *@ JavaDoc style)", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
  });

  test("Usage section shows @@template.lievit.button-group call", () => {
    expect(src).toContain("@@template.lievit.button-group");
  });
});
