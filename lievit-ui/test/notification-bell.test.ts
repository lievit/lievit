/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Re-forged v-next render-asserting checks for the notification-bell partial.
 *
 * What this suite pins (source-text assertions on the JTE source -- no JTE compiler here;
 * real-compiler golden runs out-of-band via `npm run test:jte-compile`):
 *
 *   - The v-next API surface: params, data-slot taxonomy, inline count badge, panel structure.
 *   - A11y contract: bell button is icon-only with aria-label embedding the count;
 *     count badge is aria-hidden; panel is role="region" (non-modal browsable list, spec §4);
 *     items are <ul><li> in natural tab order; unread dot carries aria-label="unread".
 *   - Native popover seam: popovertarget, popover="auto", CSS anchor positioning.
 *   - Escaping: both token channels (attrs trusted-raw via $unsafe; dataAttrs safe-escaped via
 *     Escape.htmlAttribute -- same as button.jte).
 *   - No dev.lievit import statement (hard rule: template classpath is JDK + jte + icons only).
 *   - No inline <script> or on* handlers (strict CSP).
 *   - No bare hex colours (token-only).
 *   - Apache header + JTE doc-comment with Usage section.
 *
 * SPEC DELTA vs old surface (v-next changes):
 *   - items: was gg.jte.Content slot; now java.util.List<java.util.Map<String,String>> (inline
 *     rendered list; domain-agnostic Maps, no dev.lievit record import required).
 *   - Count badge: inlined (was @template.lievit.badge composition; now self-contained <span>).
 *   - Panel role: was role="menu"; now role="region" (spec §4: non-modal browsable list).
 *   - bellAriaLabel: new param (was `label`); REQUIRED for icon-only button a11y.
 *   - clearAllWireClick: new; renders a <button l:click> in the panel header when set.
 *   - size: new; sm|md|lg toolbar-height scale for the bell button (spec §3 Sizes).
 *   - effectiveBellLabel: computed local var embedding unread count in the aria-label.
 *   - id: new; uniquifies the popover panel id per page.
 *   - registryDependencies: removed badge (inlined); removed separator (header inline).
 *   - Sub-partials header.jte / item.jte remain in the registry but are NOT part of the
 *     main notification-bell component; the main partial is now self-contained.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (rel: string) => readFileSync(join(jteDir, rel), "utf8");

// ---------------------------------------------------------------------------
// The single file this suite covers.
// ---------------------------------------------------------------------------
const src = read("notification-bell.jte");

// ---------------------------------------------------------------------------
// Shared hygiene (canonical checks every partial must pass).
// ---------------------------------------------------------------------------
describe("notification-bell.jte -- shared hygiene", () => {
  test("carries the Apache header and a JTE doc-comment block with a Usage section", () => {
    expect(src, "missing Apache copyright").toContain("Copyright 2026 Francesco Bilotta");
    expect(src, "missing Apache license line").toContain("Apache License, Version 2.0");
    expect(src, "missing <%-- --%> comment block").toContain("<%--");
    expect(src, "doc-comment must close").toContain("--%>");
    expect(src, "must NOT use @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src, "missing Usage section in doc-comment").toMatch(/Usage:/);
    expect(src, "must declare at least one @param").toMatch(/@param /);
  });

  test("has no inline <script> and ZERO inline on* handlers (strict CSP)", () => {
    expect(src).not.toMatch(/<script/i);
    const inlineHandlers = src.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });

  test("is server-first: no Lit island residue", () => {
    expect(src.toLowerCase()).not.toMatch(/customelement|litelement|adoptlightstyles/);
  });

  test("does NOT have an @import dev.lievit statement (hard rule: template classpath is JDK + jte + icons)", () => {
    // The hard rule is no `@import dev.lievit.*` LINE. The doc-comment may mention "dev.lievit"
    // in prose (e.g. "no dev.lievit import is needed") -- so we match the import statement form.
    expect(src).not.toMatch(/@import\s+dev\.lievit/);
  });

  test("never reaches for Font Awesome / wa-icon", () => {
    expect(src.toLowerCase()).not.toMatch(/font-?awesome|wa-icon|fa-/);
  });

  test("is token-driven: no bare hex colours", () => {
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src, "must read --lv-* tokens").toMatch(/var\(--lv-/);
  });
});

// ---------------------------------------------------------------------------
// v-next API surface.
// ---------------------------------------------------------------------------
describe("notification-bell.jte -- v-next API surface", () => {
  test("declares the full v-next param set", () => {
    for (const p of [
      "unreadCount",
      "maxCount",
      "items",
      "emptyLabel",
      "clearAllLabel",
      "clearAllWireClick",
      "bellAriaLabel",
      "size",
      "id",
      "cssClass",
      "attrs",
      "dataAttrs",
    ]) {
      expect(src, `missing @param ${p}`).toMatch(new RegExp(`@param[^\\n]*\\b${p}\\b`));
    }
  });

  test("items param uses java.util.List and java.util.Map (domain-agnostic, no dev.lievit record)", () => {
    expect(src, "items must be a java.util.List").toMatch(/java\.util\.List/);
    expect(src, "items must be a java.util.Map list").toMatch(/java\.util\.Map/);
    expect(src, "no dev.lievit import statement").not.toMatch(/@import\s+dev\.lievit/);
  });

  test("size param governs the bell button height-based toolbar-aligned scale", () => {
    // sm → lv-space-8, md → lv-space-9, lg → lv-space-10.
    expect(src, "sm size uses --lv-space-8").toMatch(/lv-space-8/);
    expect(src, "md size uses --lv-space-9").toMatch(/lv-space-9/);
    expect(src, "lg size uses --lv-space-10").toMatch(/lv-space-10/);
  });
});

// ---------------------------------------------------------------------------
// data-slot taxonomy.
// ---------------------------------------------------------------------------
describe("notification-bell.jte -- data-slot taxonomy", () => {
  test("carries all v-next data-slot values", () => {
    for (const slot of [
      "notification-bell",
      "notification-bell-trigger",
      "notification-bell-count",
      "notification-bell-panel",
      "notification-bell-header",
      "notification-bell-title",
      "notification-bell-list",
      "notification-bell-item",
      "notification-bell-item-body",
      "notification-bell-item-message",
      "notification-bell-item-dot",
      "notification-bell-empty",
    ]) {
      expect(src, `missing data-slot="${slot}"`).toContain(`data-slot="${slot}"`);
    }
  });
});

// ---------------------------------------------------------------------------
// Bell trigger button a11y.
// ---------------------------------------------------------------------------
describe("notification-bell.jte -- bell button a11y", () => {
  test("trigger is a real <button> with popovertarget (native popover, no JS)", () => {
    expect(src, "trigger must carry data-slot").toContain('data-slot="notification-bell-trigger"');
    // The button must open the panel via popovertarget (native popover API).
    expect(src, "trigger must have popovertarget").toMatch(/popovertarget="\$\{id\}"/);
  });

  test("trigger carries aria-haspopup=listbox (non-modal browsable list, spec §4)", () => {
    expect(src, "must be aria-haspopup=listbox").toContain('aria-haspopup="listbox"');
  });

  test("bell button aria-label embeds the unread count (sole accessible name for icon-only)", () => {
    // effectiveBellLabel is the computed label that includes the count when unreadCount > 0.
    expect(src, "must compute effectiveBellLabel with count").toMatch(/effectiveBellLabel/);
    expect(src, "must embed badgeLabel + 'unread' in the computed label").toMatch(/badgeLabel.*unread|unread.*badgeLabel/);
    expect(src, "trigger aria-label must use the computed effective label").toMatch(/aria-label="\$\{effectiveBellLabel\}"/);
  });

  test("renders the bell icon via the icon partial (valid params only: name, size, cssClass, label)", () => {
    expect(src, "must render the bell icon").toMatch(/icon\(name = "bell"/);
    // Hard rule: icon partial does NOT accept ariaHidden param.
    const iconCalls = src.match(/@template\.lievit\.icon\([^)]+\)/g) ?? [];
    for (const call of iconCalls) {
      expect(call, `invalid icon param in: ${call}`).not.toMatch(/ariaHidden|aria_hidden/);
    }
  });

  test("count badge is inlined (not composing @template.lievit.badge) and aria-hidden", () => {
    // The brief: prefer inlining a trivial visual bit over composing a sub-partial.
    expect(src, "count badge must NOT compose @template.lievit.badge").not.toMatch(/@template\.lievit\.badge\(/);
    // The inline badge span carries aria-hidden (count is in aria-label already).
    expect(src, "count badge must be aria-hidden").toMatch(/notification-bell-count[\s\S]{0,200}aria-hidden="true"/);
  });

  test("count badge is gated on hasUnread and clamps count to 99+", () => {
    expect(src, "must gate the badge on hasUnread").toMatch(/@if\(hasUnread\)/);
    expect(src, "must clamp the count via badgeLabel > maxCount logic").toMatch(/maxCount.*\+|badgeLabel/);
    expect(src, "must output '99+' for the clamped case").toContain("99+");
  });

  test("trigger stores data-unread-count for enhancer increments after page load", () => {
    expect(src, "must carry data-unread-count on the trigger").toMatch(/data-unread-count="\$\{unreadCount\}"/);
  });
});

// ---------------------------------------------------------------------------
// Panel structure a11y.
// ---------------------------------------------------------------------------
describe("notification-bell.jte -- panel structure a11y", () => {
  test("panel is a native auto popover with CSS Anchor Positioning (no JS, no z-index war)", () => {
    expect(src, "panel must be popover=auto").toContain('popover="auto"');
    expect(src, "panel must use CSS Anchor Positioning anchor name").toMatch(/position-anchor/);
    expect(src, "panel must flip on overflow").toMatch(/position-try-fallbacks/);
  });

  test("panel is role=region (non-modal browsable list, not a menu -- spec §4)", () => {
    expect(src, "panel must be role=region").toMatch(/notification-bell-panel[\s\S]{0,400}role="region"/);
  });

  test("panel has an accessible name via aria-label", () => {
    expect(src, "panel must carry aria-label").toMatch(/notification-bell-panel[\s\S]{0,400}aria-label/);
  });

  test("panel uses --lv-z-popover for stacking (never a hardcoded z-index number)", () => {
    expect(src, "must use --lv-z-popover token").toMatch(/lv-z-popover/);
    // Hardcoded z-index numbers are forbidden (token-only rule).
    expect(src, "must NOT have a hardcoded z-index integer alone").not.toMatch(/z-index\s*:\s*\d{3,}/);
  });

  test("panel background uses --lv-color-popover tokens", () => {
    expect(src, "must use --lv-color-popover").toMatch(/lv-color-popover/);
  });

  test("panel has a header with title and optional clear-all button", () => {
    expect(src, "must have notification-bell-header").toContain('data-slot="notification-bell-header"');
    expect(src, "must have notification-bell-title").toContain('data-slot="notification-bell-title"');
    expect(src, "must have notification-bell-clear-all when clearAllWireClick set").toContain('data-slot="notification-bell-clear-all"');
  });

  test("clear-all button is gated on clearAllWireClick being non-null and non-blank", () => {
    expect(src, "clear-all must be conditional on non-null").toMatch(/clearAllWireClick != null/);
    expect(src, "clear-all must guard against blank").toMatch(/!clearAllWireClick.isBlank\(\)/);
  });

  test("clear-all button uses l:click (safe wire action, not inline JS)", () => {
    expect(src, "must wire clear-all via l:click").toMatch(/l:click="\$\{clearAllWireClick\}"/);
  });
});

// ---------------------------------------------------------------------------
// lv-popover Stimulus seam (conversion of popover-anchor.enhancer.ts).
//
// The notification-bell is a native popover (trigger + panel). Its one irreducible client bit --
// focus-return to the bell on light-dismiss -- is now owned by the shared lv-popover Stimulus
// controller (no duplicated focus/dismiss logic; the controlled/uncontrolled doctrine lives once
// in DismissableController). Behaviour is proven through the real controller + real morph in
// test/lv-notification-bell-controller.test.ts; this block pins the template-side contract.
// ---------------------------------------------------------------------------
describe("notification-bell.jte -- lv-popover Stimulus seam", () => {
  test("the bell trigger carries a stable id the panel can point its opener at", () => {
    // triggerId = id + "-trigger"; the button id is what data-lv-opener resolves for focus-return.
    expect(src, "must derive a triggerId from the panel id").toMatch(/triggerId\s*=\s*id\s*\+\s*"-trigger"/);
    expect(src, "the bell button must carry id=${triggerId}").toMatch(/id="\$\{triggerId\}"/);
  });

  test("panel carries data-controller='lv-popover' (the shared converted popover seam)", () => {
    // The popover seam is owned by the shared lv-popover Stimulus controller; the legacy
    // popover-anchor.enhancer.ts skips this panel via its data-controller~="lv-popover" guard.
    expect(src, "panel must attach the lv-popover controller").toContain('data-controller="lv-popover"');
  });

  test("panel carries data-lv-opener pointing at the bell trigger (focus-return target)", () => {
    expect(src, "panel must declare its opener").toMatch(/data-lv-opener="\$\{triggerId\}"/);
  });

  test("panel is UNCONTROLLED: no data-lv-wire-close (browser-owned open, zero wire round-trip)", () => {
    // The controlled/uncontrolled doctrine (wire-410 fix): an uncontrolled overlay must NEVER stamp
    // a close action. The bell's open state is browser-owned, so the marker must be absent. Match
    // the ATTRIBUTE-emission form (data-lv-wire-close="...") — the doc-comment legitimately names
    // the attribute in prose, so a bare substring check would false-positive on the documentation.
    expect(src, "uncontrolled bell must NOT emit a data-lv-wire-close attribute").not.toMatch(/data-lv-wire-close="/);
  });
});

// ---------------------------------------------------------------------------
// Item list rendering.
// ---------------------------------------------------------------------------
describe("notification-bell.jte -- item list", () => {
  test("item list is a <ul> with <li> rows (natural list semantics)", () => {
    expect(src, "must use <ul> for the item list").toMatch(/<ul\b[^>]*>/);
    expect(src, "must use <li> for items").toMatch(/<li\b/);
  });

  test("item list is gated on items.isEmpty() -- renders emptyLabel when no items", () => {
    expect(src, "must branch on items.isEmpty()").toMatch(/items\.isEmpty\(\)/);
    expect(src, "must render emptyLabel in the empty branch").toMatch(/\$\{emptyLabel\}/);
    expect(src, "empty state uses notification-bell-empty slot").toContain('data-slot="notification-bell-empty"');
  });

  test("item loop iterates items and reads Map keys (domain-agnostic)", () => {
    // The loop must declare the item type explicitly (java.util.Map<String, String>).
    expect(src, "must iterate items with @for and typed Map variable").toMatch(/@for\(java\.util\.Map.*item : items\)/);
    expect(src, "must read item message from map").toMatch(/getOrDefault\("message"/);
    expect(src, "must read item variant from map").toMatch(/getOrDefault\("variant"/);
  });

  test("item renders a variant icon using the icon partial (valid params only)", () => {
    expect(src, "must render an intent icon for the item").toMatch(/icon\(name = itemIconName/);
  });

  test("variant icon colour comes from a token-based switch (not hardcoded hex)", () => {
    expect(src, "icon colour switch must reference --lv-color-success").toMatch(/lv-color-success/);
    expect(src, "icon colour switch must reference --lv-color-warning").toMatch(/lv-color-warning/);
    expect(src, "icon colour switch must reference --lv-color-destructive").toMatch(/lv-color-destructive/);
    expect(src, "icon colour switch must reference --lv-color-info").toMatch(/lv-color-info/);
  });

  test("unread dot is gated on !isRead and carries role=img aria-label=unread (AT announcement)", () => {
    // The implementation derives isRead from item.get("read") and gates the dot on !isRead.
    expect(src, "dot must be gated on !isRead").toMatch(/!\s*isRead/);
    expect(src, "dot must carry aria-label=unread for AT").toMatch(/notification-bell-item-dot[\s\S]{0,200}aria-label="unread"/);
    expect(src, "dot must carry role=img").toMatch(/notification-bell-item-dot[\s\S]{0,200}role="img"/);
  });

  test("item description and timestamp are conditionally rendered", () => {
    expect(src, "description is conditional").toMatch(/notification-bell-item-description/);
    expect(src, "timestamp is conditional").toMatch(/notification-bell-item-timestamp/);
  });
});

// ---------------------------------------------------------------------------
// Escaping channels (XSS contract).
// ---------------------------------------------------------------------------
describe("notification-bell.jte -- escaping channels", () => {
  test("imports gg.jte.output.StringOutput and gg.jte.html.escape.Escape (safe-escaped channel)", () => {
    expect(src, "must import StringOutput").toContain("import gg.jte.output.StringOutput");
    expect(src, "must import Escape").toContain("import gg.jte.html.escape.Escape");
  });

  test("dataAttrs values are escaped via Escape.htmlAttribute (safe channel)", () => {
    expect(src, "must call Escape.htmlAttribute on dataAttrs values").toMatch(/Escape\.htmlAttribute/);
    expect(src, "must build the escaped fragment into dataAttrsMarkup").toMatch(/dataAttrsMarkup/);
  });

  test("attrs channel is emitted with $unsafe (trusted-raw, static strings only)", () => {
    expect(src, "attrs must be emitted with $unsafe{}").toMatch(/\$unsafe\{attrs\}/);
  });

  test("item message and description are rendered via JTE default escaping (not $unsafe)", () => {
    expect(src, "item message must use ${} not $unsafe{}").toMatch(/\$\{itemMsg\}/);
    expect(src, "item message must NOT be routed through $unsafe").not.toMatch(/\$unsafe\{itemMsg\}/);
  });
});
