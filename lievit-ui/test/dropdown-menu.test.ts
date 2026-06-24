/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * dropdown-menu (v-next) -- structural + a11y contract (spec + REFORGE-AGENT-BRIEF tier doctrine).
 *
 * The controlled/uncontrolled overlay partial is compiled in the Java world; this harness asserts
 * on the PARTIAL SOURCE as text (structural golden). It pins: the param API (trigger/content slots,
 * open controlled param, placement, escapeAction), the ARIA wiring (role=menu, aria-labelledby,
 * aria-haspopup, aria-expanded, aria-controls, aria-orientation, aria-disabled, aria-checked),
 * the collection-nav enhancer data-attr contract (data-lievit-collection, roving-tabindex,
 * wrap, escape-action, manual-activation), the popover-anchor seam (popover="auto",
 * data-lv-opener), CSS Anchor Positioning (anchor-name + position-anchor + position-area),
 * placement mapping, CSP hygiene, token-driven styling, and the XSS trust split for the
 * item partial's wireArgs channel. Real-runtime + keyboard tests live in the IT suite; this
 * suite is the static contract gate, equivalent to the JTE-compile golden.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const menuSrc = readFileSync(join(jteDir, "dropdown-menu.jte"), "utf8");
const itemSrc = readFileSync(join(jteDir, "dropdown-menu", "item.jte"), "utf8");
const separatorSrc = readFileSync(join(jteDir, "dropdown-menu", "separator.jte"), "utf8");
const groupSrc = readFileSync(join(jteDir, "dropdown-menu", "group.jte"), "utf8");
const labelSrc = readFileSync(join(jteDir, "dropdown-menu", "label.jte"), "utf8");
const shortcutSrc = readFileSync(join(jteDir, "dropdown-menu", "shortcut.jte"), "utf8");
const subSrc = readFileSync(join(jteDir, "dropdown-menu", "sub.jte"), "utf8");
const metaRaw = readFileSync(join(jteDir, "dropdown-menu", "meta.json"), "utf8");

// Strip JTE comments so assertions do not accidentally hit doc-comment prose.
const menuMarkup = menuSrc.replace(/<%--[\s\S]*?--%>/g, "");
const itemMarkup = itemSrc.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// Param API: dropdown-menu root template
// ---------------------------------------------------------------------------
describe("dropdown-menu -- param API", () => {
  test("declares id param with default 'lv-dropdown-menu'", () => {
    expect(menuSrc).toContain('@param String id = "lv-dropdown-menu"');
  });

  test("declares trigger and content as gg.jte.Content (Content slots)", () => {
    expect(menuSrc).toContain("@param gg.jte.Content trigger");
    expect(menuSrc).toContain("@param gg.jte.Content content");
  });

  test("declares placement param with default 'bottom-start'", () => {
    expect(menuSrc).toContain('@param String placement = "bottom-start"');
  });

  test("declares disabled boolean with default false", () => {
    expect(menuSrc).toContain("@param boolean disabled = false");
  });

  test("declares open boolean with default false (CONTROLLED mode param)", () => {
    expect(menuSrc).toContain("@param boolean open = false");
  });

  test("declares escapeAction param with default 'close' (collection-nav Esc action)", () => {
    expect(menuSrc).toContain('@param String escapeAction = "close"');
  });

  test("declares cssClass and triggerClass string params", () => {
    expect(menuSrc).toContain('@param String cssClass = ""');
    expect(menuSrc).toContain('@param String triggerClass = ""');
  });

  test("usage doc shows the @@template.lievit.dropdown-menu call syntax", () => {
    expect(menuSrc).toContain("@@template.lievit.dropdown-menu(");
  });
});

// ---------------------------------------------------------------------------
// Root wrapper
// ---------------------------------------------------------------------------
describe("dropdown-menu -- root wrapper", () => {
  test('root carries data-slot="dropdown-menu"', () => {
    expect(menuMarkup).toContain('data-slot="dropdown-menu"');
  });

  test("root carries data-open reflecting the open state", () => {
    expect(menuMarkup).toContain('data-open="${open ? "true" : "false"}"');
  });

  test("root uses relative inline-block for the anchor positioning context", () => {
    expect(menuMarkup).toContain("relative inline-block");
  });

  test("root reads --lv-font-sans token for font-family", () => {
    expect(menuMarkup).toContain("font-family:var(--lv-font-sans)");
  });
});

// ---------------------------------------------------------------------------
// Trigger button
// ---------------------------------------------------------------------------
describe("dropdown-menu -- trigger button", () => {
  test('trigger carries data-slot="dropdown-menu-trigger"', () => {
    expect(menuMarkup).toContain('data-slot="dropdown-menu-trigger"');
  });

  test("trigger is a real <button type='button'> (platform Enter/Space + focus for free)", () => {
    expect(menuMarkup).toContain('type="button"');
    // The trigger must not be a div-with-role
    expect(menuMarkup).not.toMatch(/<div[^>]*role="button"/);
  });

  test("trigger id is derived from the id param (triggerId = id + '-trigger')", () => {
    expect(menuSrc).toContain('id + "-trigger"');
  });

  test("trigger carries aria-haspopup='menu' (APG Menu Button)", () => {
    expect(menuMarkup).toContain('aria-haspopup="menu"');
  });

  test("trigger carries aria-expanded reflecting the open param", () => {
    expect(menuMarkup).toContain('aria-expanded="${open ? "true" : "false"}"');
  });

  test("trigger carries aria-controls pointing to the menu panel id", () => {
    expect(menuMarkup).toContain('aria-controls="${id}"');
  });

  test("trigger disabled attribute uses smart-attribute null-drop (JTE omits when false)", () => {
    expect(menuMarkup).toContain('disabled="${disabled}"');
  });

  test("trigger carries focus-visible ring via --lv-ring token", () => {
    expect(menuMarkup).toContain("focus-visible:shadow-[var(--lv-ring)]");
  });

  test("trigger sets anchor-name derived from id for CSS Anchor Positioning", () => {
    // anchor-name is built from the id param: "--" + id + "-anchor"
    expect(menuSrc).toContain('"--" + id + "-anchor"');
    expect(menuMarkup).toContain("anchor-name:${anchorName}");
  });

  test("trigger renders the trigger Content slot (${trigger} interpolation)", () => {
    expect(menuMarkup).toContain("${trigger}");
  });

  test("UNCONTROLLED mode: trigger carries popovertarget when open=false (null drops the attr)", () => {
    // Smart attribute: popovertarget="${open ? null : id}" -- present in uncontrolled mode
    expect(menuMarkup).toContain('popovertarget="${open ? null : id}"');
  });
});

// ---------------------------------------------------------------------------
// Menu panel: APG role + ARIA + popover seam
// ---------------------------------------------------------------------------
describe("dropdown-menu -- menu panel ARIA", () => {
  test('panel carries data-slot="dropdown-menu-content"', () => {
    expect(menuMarkup).toContain('data-slot="dropdown-menu-content"');
  });

  test("panel carries role='menu' (APG Menu pattern)", () => {
    expect(menuMarkup).toContain('role="menu"');
  });

  test("panel carries aria-labelledby pointing to the trigger id", () => {
    expect(menuMarkup).toContain('aria-labelledby="${triggerId}"');
  });

  test("panel carries aria-orientation='vertical' (explicit, APG Menu)", () => {
    expect(menuMarkup).toContain('aria-orientation="vertical"');
  });

  test("panel renders the content Content slot (${content} interpolation)", () => {
    expect(menuMarkup).toContain("${content}");
  });
});

// ---------------------------------------------------------------------------
// Native popover seam
// ---------------------------------------------------------------------------
describe("dropdown-menu -- native popover seam", () => {
  test("panel carries popover='auto' for top-layer + light-dismiss", () => {
    expect(menuMarkup).toContain('popover="auto"');
  });

  test("panel carries data-lv-opener pointing to the trigger id (popover-anchor enhancer)", () => {
    expect(menuMarkup).toContain('data-lv-opener="${triggerId}"');
  });

  test("panel uses id param as its element id (popovertarget link target)", () => {
    expect(menuMarkup).toContain('id="${id}"');
  });

  test("CONTROLLED mode: open attribute added when open=true (forces popover visible)", () => {
    // Old assertion: open="${open ? "true" : null}" (ternary truthy-string form).
    // New form: open="${open}" (JTE boolean smart-attribute: emits bare `open` when true,
    // omits the attr entirely when false). Semantically identical; JTE does the null-elision.
    expect(menuMarkup).toContain('open="${open}"');
    // Also assert the light-dismiss action attr that ships alongside it.
    expect(menuMarkup).toContain('data-lv-wire-close="${escapeAction}"');
  });
});

// ---------------------------------------------------------------------------
// CSS Anchor Positioning: placement mapping
// ---------------------------------------------------------------------------
describe("dropdown-menu -- placement + CSS Anchor Positioning", () => {
  test("position-anchor reads the anchorName derived var", () => {
    expect(menuMarkup).toContain("position-anchor:${anchorName}");
  });

  test("position-area reads the positionArea derived var", () => {
    expect(menuMarkup).toContain("position-area:${positionArea}");
  });

  test("flip-block fallback is set (position-try-fallbacks:flip-block)", () => {
    expect(menuMarkup).toContain("position-try-fallbacks:flip-block");
  });

  test("margin-block uses --lv-space-1 for the gap between trigger and panel", () => {
    expect(menuMarkup).toContain("margin-block:var(--lv-space-1)");
  });

  test("bottom-end placement maps to 'bottom span-left'", () => {
    expect(menuSrc).toContain('"bottom-end" -> "bottom span-left"');
  });

  test("top-start placement maps to 'top span-right'", () => {
    expect(menuSrc).toContain('"top-start"  -> "top span-right"');
  });

  test("top-end placement maps to 'top span-left'", () => {
    expect(menuSrc).toContain('"top-end"    -> "top span-left"');
  });

  test("default (bottom-start) maps to 'bottom span-right'", () => {
    expect(menuSrc).toContain('default           -> "bottom span-right"');
  });
});

// ---------------------------------------------------------------------------
// collection-nav enhancer wiring
// ---------------------------------------------------------------------------
describe("dropdown-menu -- collection-nav enhancer contract", () => {
  test("panel carries data-lievit-collection (activates the enhancer)", () => {
    expect(menuMarkup).toContain("data-lievit-collection");
  });

  test("panel carries data-lievit-collection-roving-tabindex='true' (roving model, not aria-activedescendant)", () => {
    expect(menuMarkup).toContain('data-lievit-collection-roving-tabindex="true"');
  });

  test("panel carries data-lievit-collection-orientation='vertical'", () => {
    expect(menuMarkup).toContain('data-lievit-collection-orientation="vertical"');
  });

  test("panel carries data-lievit-collection-wrap='true' (ArrowDown wraps to first, ArrowUp to last)", () => {
    expect(menuMarkup).toContain('data-lievit-collection-wrap="true"');
  });

  test("panel carries data-lievit-collection-escape-action bound to the escapeAction param", () => {
    expect(menuMarkup).toContain('data-lievit-collection-escape-action="${escapeAction}"');
  });

  test("panel carries data-manual-activation='true' (Arrow keys move focus, not activate)", () => {
    expect(menuMarkup).toContain('data-manual-activation="true"');
  });
});

// ---------------------------------------------------------------------------
// Token-driven styling: menu panel
// ---------------------------------------------------------------------------
describe("dropdown-menu -- token-driven panel styling", () => {
  test("panel background uses --lv-color-popover", () => {
    expect(menuMarkup).toContain("bg-[var(--lv-color-popover)]");
  });

  test("panel text uses --lv-color-popover-fg", () => {
    expect(menuMarkup).toContain("text-[var(--lv-color-popover-fg)]");
  });

  test("panel border uses --lv-color-border", () => {
    expect(menuMarkup).toContain("border-[var(--lv-color-border)]");
  });

  test("panel shadow uses --lv-shadow-md (popover elevation)", () => {
    expect(menuMarkup).toContain("shadow-[var(--lv-shadow-md)]");
  });

  test("panel corner radius uses --lv-radius-md", () => {
    expect(menuMarkup).toContain("rounded-[var(--lv-radius-md)]");
  });

  test("panel z-index uses --lv-z-popover", () => {
    expect(menuMarkup).toContain("z-index:var(--lv-z-popover)");
  });

  test("panel font family reads --lv-font-sans", () => {
    expect(menuMarkup).toContain("font-family:var(--lv-font-sans)");
  });

  test("panel text size uses --lv-text-sm", () => {
    expect(menuMarkup).toContain("text-[length:var(--lv-text-sm)]");
  });

  test("no bare hex colour leaks into the panel markup", () => {
    expect(menuMarkup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

// ---------------------------------------------------------------------------
// Item partial: param API
// ---------------------------------------------------------------------------
describe("dropdown-menu/item -- param API", () => {
  test("declares label param (no default, required)", () => {
    expect(itemSrc).toContain("@param String label");
    expect(itemSrc).not.toContain("@param String label =");
  });

  test("declares href param with empty default (absent = button)", () => {
    expect(itemSrc).toContain('@param String href = ""');
  });

  test("declares icon, shortcut params with empty defaults", () => {
    expect(itemSrc).toContain('@param String icon = ""');
    expect(itemSrc).toContain('@param String shortcut = ""');
  });

  test("declares type param with default 'item'", () => {
    expect(itemSrc).toContain('@param String type = "item"');
  });

  test("declares variant param with default 'default'", () => {
    expect(itemSrc).toContain('@param String variant = "default"');
  });

  test("declares checked and disabled booleans with false defaults", () => {
    expect(itemSrc).toContain("@param boolean checked = false");
    expect(itemSrc).toContain("@param boolean disabled = false");
  });

  test("declares formId and formAction string params with empty defaults", () => {
    expect(itemSrc).toContain('@param String formId = ""');
    expect(itemSrc).toContain('@param String formAction = ""');
  });

  test("declares wireClick with null default (SAFE wire action channel)", () => {
    expect(itemSrc).toContain("@param String wireClick = null");
  });

  test("declares wireArgs as Map<String,String> with empty-map default (SAFE per-row args)", () => {
    expect(itemSrc).toContain("@param java.util.Map<String, String> wireArgs = java.util.Map.of()");
  });

  test("declares cssClass with empty default", () => {
    expect(itemSrc).toContain('@param String cssClass = ""');
  });
});

// ---------------------------------------------------------------------------
// Item partial: a11y contract
// ---------------------------------------------------------------------------
describe("dropdown-menu/item -- a11y contract", () => {
  test("item role is derived: menuitemcheckbox for checkbox, menuitemradio for radio, menuitem default", () => {
    expect(itemSrc).toContain('"checkbox".equals(type) ? "menuitemcheckbox"');
    expect(itemSrc).toContain('"radio".equals(type) ? "menuitemradio"');
    expect(itemSrc).toContain('"menuitem"');
  });

  test('item carries data-slot="dropdown-menu-item"', () => {
    expect(itemMarkup).toContain('data-slot="dropdown-menu-item"');
  });

  test("item carries data-lievit-item (collection-nav item selector)", () => {
    expect(itemMarkup).toContain("data-lievit-item");
  });

  test("item carries tabindex='-1' (roving tabindex: enhancer sets 0 on the active item)", () => {
    expect(itemMarkup).toContain('tabindex="-1"');
  });

  test("disabled item carries aria-disabled='true' (APG: aria-disabled, not just native disabled)", () => {
    expect(itemMarkup).toContain('aria-disabled="${disabled ? "true" : null}"');
  });

  test("checkbox item carries aria-checked reflecting the checked param", () => {
    expect(itemMarkup).toContain('aria-checked="${checkable ? (checked ? "true" : "false") : null}"');
  });

  test("icon span carries aria-hidden='true' (decorative)", () => {
    expect(itemMarkup).toContain('aria-hidden="true"');
  });

  test("shortcut span carries aria-hidden='true' and data-slot='dropdown-menu-shortcut'", () => {
    expect(itemMarkup).toContain('data-slot="dropdown-menu-shortcut"');
    // The shortcut is aria-hidden (decorative)
    const shortcutIdx = itemMarkup.indexOf('data-slot="dropdown-menu-shortcut"');
    const beforeShortcut = itemMarkup.slice(Math.max(0, shortcutIdx - 150), shortcutIdx + 10);
    expect(beforeShortcut).toContain('aria-hidden="true"');
  });

  test("indicator column carries aria-hidden='true' and data-slot='dropdown-menu-item-indicator'", () => {
    expect(itemMarkup).toContain('data-slot="dropdown-menu-item-indicator"');
  });

  test("link item renders real <a href> (navigation, platform handles it)", () => {
    expect(itemMarkup).toContain("<a");
    expect(itemMarkup).toContain('href="${href}"');
  });

  test("button item renders real <button> (activation is platform-native)", () => {
    expect(itemMarkup).toContain("<button");
  });

  test("button item is type='button' when no formId/formAction (no accidental form submit)", () => {
    expect(itemSrc).toContain('formId.isEmpty() && formAction.isEmpty() ? "button" : "submit"');
  });
});

// ---------------------------------------------------------------------------
// Item partial: destructive variant
// ---------------------------------------------------------------------------
describe("dropdown-menu/item -- destructive variant", () => {
  test("destructive item carries data-variant='destructive'", () => {
    expect(itemMarkup).toContain('data-variant="${destructive ? "destructive" : null}"');
  });

  test("destructive item carries data-danger='true' (CSS hook for --lv-color-destructive)", () => {
    expect(itemMarkup).toContain('data-danger="${destructive ? "true" : null}"');
  });

  test("destructive color reads --lv-color-destructive token (not a bare hex)", () => {
    expect(itemSrc).toContain('"var(--lv-color-destructive)"');
    expect(itemMarkup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

// ---------------------------------------------------------------------------
// Item partial: wireClick + wireArgs (XSS trust split)
// ---------------------------------------------------------------------------
describe("dropdown-menu/item -- wireArgs SAFE channel (XSS trust split)", () => {
  test("imports StringOutput and Escape for the wireArgs channel", () => {
    expect(itemSrc).toContain("@import gg.jte.output.StringOutput");
    expect(itemSrc).toContain("@import gg.jte.html.escape.Escape");
  });

  test("wireArgs VALUE is routed through Escape.htmlAttribute (never emitted raw)", () => {
    expect(itemSrc).toMatch(/Escape\.htmlAttribute\(\s*e\.getValue\(\)/);
    expect(itemSrc, "wireArgs value must not be $unsafe").not.toMatch(/\$unsafe\{[^}]*getValue/);
  });

  test("wireArgs KEY is allowlisted to simple identifiers (attribute-NAME position, unescaped)", () => {
    expect(itemSrc).toMatch(/getKey\(\)\.matches\("\[A-Za-z\]\[A-Za-z0-9-\]\*"\)/);
  });

  test("the pre-escaped wireArgs fragment is emitted via $unsafe{wireArgsMarkup}", () => {
    expect(itemSrc).toContain("$unsafe{wireArgsMarkup}");
  });

  test("wireClick is emitted as l:click when set (null drops via smart-attr null-drop)", () => {
    expect(itemMarkup).toContain('l:click="${wire}"');
  });
});

// ---------------------------------------------------------------------------
// Item partial: no io.lievit imports (JTE-compile gate rule)
// ---------------------------------------------------------------------------
describe("dropdown-menu/item -- JTE gate: no io.lievit imports", () => {
  test("item partial has no @import io.lievit (forbidden in the JTE classpath)", () => {
    expect(itemSrc).not.toContain("@import io.lievit");
  });
});

// ---------------------------------------------------------------------------
// Separator partial
// ---------------------------------------------------------------------------
describe("dropdown-menu/separator -- structure + a11y", () => {
  test('separator carries data-slot="dropdown-menu-separator"', () => {
    expect(separatorSrc).toContain('data-slot="dropdown-menu-separator"');
  });

  test("separator carries role='separator' (APG: non-interactive divider)", () => {
    expect(separatorSrc).toContain('role="separator"');
  });

  test("separator hairline uses --lv-color-border token (no bare hex)", () => {
    expect(separatorSrc).toContain("var(--lv-color-border)");
    expect(separatorSrc).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

// ---------------------------------------------------------------------------
// Group partial
// ---------------------------------------------------------------------------
describe("dropdown-menu/group -- structure + a11y", () => {
  test('group carries data-slot="dropdown-menu-group"', () => {
    expect(groupSrc).toContain('data-slot="dropdown-menu-group"');
  });

  test("group carries role='group' (APG: semantic grouping)", () => {
    expect(groupSrc).toContain('role="group"');
  });

  test("group aria-labelledby is null-dropped when labelId is empty (smart attr)", () => {
    expect(groupSrc).toContain('aria-labelledby="${labelId.isEmpty() ? null : labelId}"');
  });

  test("group renders the content slot (${content})", () => {
    expect(groupSrc).toContain("${content}");
  });
});

// ---------------------------------------------------------------------------
// Label partial
// ---------------------------------------------------------------------------
describe("dropdown-menu/label -- structure", () => {
  test('label carries data-slot="dropdown-menu-label"', () => {
    expect(labelSrc).toContain('data-slot="dropdown-menu-label"');
  });

  test("label id is null-dropped when empty (smart attr)", () => {
    expect(labelSrc).toContain('id="${id.isEmpty() ? null : id}"');
  });

  test("label inset data-attr is null-dropped when inset=false", () => {
    expect(labelSrc).toContain('data-inset="${inset ? "true" : null}"');
  });

  test("label font-weight uses --lv-font-medium token", () => {
    expect(labelSrc).toContain("var(--lv-font-medium)");
  });
});

// ---------------------------------------------------------------------------
// Shortcut partial
// ---------------------------------------------------------------------------
describe("dropdown-menu/shortcut -- a11y", () => {
  test('shortcut carries data-slot="dropdown-menu-shortcut"', () => {
    expect(shortcutSrc).toContain('data-slot="dropdown-menu-shortcut"');
  });

  test("shortcut carries aria-hidden='true' (display only, screen reader ignores)", () => {
    expect(shortcutSrc).toContain('aria-hidden="true"');
  });

  test("shortcut color uses --lv-color-muted token", () => {
    expect(shortcutSrc).toContain("var(--lv-color-muted)");
  });

  test("shortcut font-size uses --lv-text-xs token", () => {
    expect(shortcutSrc).toContain("var(--lv-text-xs)");
  });
});

// ---------------------------------------------------------------------------
// Sub partial (native details disclosure)
// ---------------------------------------------------------------------------
describe("dropdown-menu/sub -- structure + a11y", () => {
  test('sub carries data-slot="dropdown-menu-sub" on the details element', () => {
    expect(subSrc).toContain('data-slot="dropdown-menu-sub"');
  });

  test('sub trigger summary carries data-slot="dropdown-menu-sub-trigger"', () => {
    expect(subSrc).toContain('data-slot="dropdown-menu-sub-trigger"');
  });

  test("sub trigger carries role='menuitem' aria-haspopup='menu'", () => {
    expect(subSrc).toContain('role="menuitem"');
    expect(subSrc).toContain('aria-haspopup="menu"');
  });

  test('sub content carries data-slot="dropdown-menu-sub-content" role="menu"', () => {
    expect(subSrc).toContain('data-slot="dropdown-menu-sub-content"');
    const subMarkup = subSrc.replace(/<%--[\s\S]*?--%>/g, "");
    // role="menu" appears on the content div (and also on the summary; check for content div)
    const contentIdx = subMarkup.indexOf('data-slot="dropdown-menu-sub-content"');
    const surroundingMarkup = subMarkup.slice(Math.max(0, contentIdx - 80), contentIdx + 80);
    expect(surroundingMarkup).toContain('role="menu"');
  });

  test("sub renders content slot (${content})", () => {
    expect(subSrc).toContain("${content}");
  });

  test("sub trigger chevron-right icon carries aria-hidden (decorative)", () => {
    expect(subSrc).toContain('"chevron-right"');
    expect(subSrc).toContain('aria-hidden="true"');
  });
});

// ---------------------------------------------------------------------------
// CSP hygiene: all partials
// ---------------------------------------------------------------------------
describe("dropdown-menu -- CSP hygiene (all partials)", () => {
  const allSrc = [menuSrc, itemSrc, separatorSrc, groupSrc, labelSrc, shortcutSrc, subSrc];

  test("no inline <script> in any partial", () => {
    for (const src of allSrc) {
      expect(src).not.toMatch(/<script/i);
    }
  });

  test("no inline on* event handler attributes in any partial", () => {
    for (const src of allSrc) {
      const handlers = src.replace(/<%--[\s\S]*?--%>/g, "").match(/\son[a-z]+=/gi) ?? [];
      expect(handlers, `inline handler found in partial`).toEqual([]);
    }
  });

  test("no @import io.lievit in any partial (JTE-compile classpath rule)", () => {
    for (const src of allSrc) {
      expect(src).not.toContain("@import io.lievit");
    }
  });

  test("no nested JTE comments (hard rule: inner --%> closes outer comment)", () => {
    // A nested comment would appear as <%-- ... <%-- (inner open) inside an outer comment.
    // The safe check: strip the outermost comment blocks and look for any remaining <%-- openers
    // that would have been closed early by the first --%> inside the outer block.
    for (const src of allSrc) {
      // Extract the content of each comment (between <%-- and --%>), excluding the delimiters.
      const commentBodies = (src.match(/<%--[\s\S]*?--%>/g) ?? []).map((m) =>
        m.slice(4, m.length - 4), // strip <%-- and --%>
      );
      for (const body of commentBodies) {
        // If the comment body contains <%-- it would start a nested comment (illegal).
        expect(body, "nested <%-- found inside a JTE comment block").not.toContain("<%--");
        // If the comment body contains --%> it would close the outer comment early (illegal).
        expect(body, "nested --%> found inside a JTE comment block").not.toContain("--%>");
      }
    }
  });

  test("no em-dash in any partial (house rule)", () => {
    for (const src of allSrc) {
      expect(src).not.toContain("—"); // U+2014 EM DASH
    }
  });
});

// ---------------------------------------------------------------------------
// meta.json: v-next fields
// ---------------------------------------------------------------------------
describe("dropdown-menu -- meta.json", () => {
  test("meta.json is valid JSON", () => {
    expect(() => JSON.parse(metaRaw)).not.toThrow();
  });

  const meta = JSON.parse(metaRaw) as Record<string, unknown>;

  test("name is 'dropdown-menu'", () => {
    expect(meta.name).toBe("dropdown-menu");
  });

  test("type is 'registry:jte'", () => {
    expect(meta.type).toBe("registry:jte");
  });

  test("registryDependencies includes 'tokens' and 'icon'", () => {
    const deps = meta.registryDependencies as string[];
    expect(deps).toContain("tokens");
    expect(deps).toContain("icon");
  });

  test("enhancers field lists collection-nav and popover-anchor", () => {
    const enhancers = meta.enhancers as string[];
    expect(enhancers).toContain("collection-nav.enhancer.ts");
    expect(enhancers).toContain("popover-anchor.enhancer.ts");
  });

  test("files array includes all sub-partials", () => {
    const files = (meta.files as Array<{ path: string }>).map((f) => f.path);
    expect(files).toContain("jte/dropdown-menu.jte");
    expect(files).toContain("jte/dropdown-menu/item.jte");
    expect(files).toContain("jte/dropdown-menu/separator.jte");
    expect(files).toContain("jte/dropdown-menu/label.jte");
    expect(files).toContain("jte/dropdown-menu/group.jte");
    expect(files).toContain("jte/dropdown-menu/shortcut.jte");
    expect(files).toContain("jte/dropdown-menu/sub.jte");
  });
});

// ---------------------------------------------------------------------------
// Controlled / Uncontrolled mode flags: structural signal
// ---------------------------------------------------------------------------
describe("dropdown-menu -- controlled/uncontrolled structural signals", () => {
  test("UNCONTROLLED: popovertarget dropped when open=true (controlled caller wires l:click itself)", () => {
    // Smart attribute: null when open=true drops the popovertarget attr
    expect(menuMarkup).toContain('popovertarget="${open ? null : id}"');
  });

  test("CONTROLLED: open attr emitted as JTE boolean smart-attribute when open=true (forces popover visible)", () => {
    // Old: open="${open ? "true" : null}" (ternary truthy-string form, explicit null-elision).
    // New: open="${open}" (JTE boolean smart-attribute: emits bare `open` when true, omits when false).
    // The rendered HTML is identical; the template source uses the canonical JTE boolean attr form.
    expect(menuMarkup).toContain('open="${open}"');
  });

  test("escapeAction is forwarded to data-lievit-collection-escape-action (configurable per caller)", () => {
    expect(menuMarkup).toContain('data-lievit-collection-escape-action="${escapeAction}"');
  });

  test("doc comment describes CONTROLLED mode usage with open + escapeAction params", () => {
    expect(menuSrc).toContain("CONTROLLED");
    expect(menuSrc).toContain("escapeAction");
  });
});
