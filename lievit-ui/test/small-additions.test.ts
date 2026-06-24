/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * shadcn fidelity Type-2 (issue #464) -- the smaller compound sub-components, variants and
 * positioning features we did not cover yet:
 *   - avatar: AvatarGroupCount ("+N" overflow tile) + AvatarBadge (status dot)
 *   - kbd: KbdGroup (wraps several keys as one shortcut)
 *   - badge / chip: ghost + link variants
 *   - tooltip: arrow + side / sideOffset / align positioning
 *   - hover-card: align + sideOffset positioning
 *   - toast: default + loading + promise variants, stacking viewport + position
 *
 * Like the sibling static-partial suites this Node harness has no JTE compiler, so it asserts on
 * the partial SOURCE as text (the @param API, the data-slot names mirroring shadcn new-york-v4,
 * the token-driven switch cases, the a11y wiring, and that no inline script / on* handler ships).
 * The real-compiler golden runs out of band via the jte-compile smoke; these structural checks
 * mirror what that proves so the invariants survive without the JVM on the Node CI path.
 */
import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (rel: string) => readFileSync(join(jteDir, rel), "utf8");
/** The markup with the JTE doc/inline comments stripped (so prose never trips a markup assertion). */
const markup = (src: string) => src.replace(/<%--[\s\S]*?--%>/g, "");

const ALL_NEW = [
  "avatar/group-count.jte",
  "avatar/badge.jte",
  "kbd/group.jte",
  "toast/viewport.jte",
] as const;

describe("Type-2 new partials: shared house rules (CSP-clean, JTE comments, token-driven)", () => {
  test.each(ALL_NEW)("%s ships with an Apache header + a JTE doc comment + a @param", (rel) => {
    const src = read(rel);
    expect(existsSync(join(jteDir, rel)), `${rel} must exist`).toBe(true);
    expect(src, "Apache header").toContain("Licensed under the Apache License");
    expect(src, "JTE comment block opens").toContain("<%--");
    expect(src, "JTE comment block closes").toContain("--%>");
    expect(src, "must NOT use the @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src, "missing Usage section").toMatch(/Usage:/);
    expect(src, "missing @param").toMatch(/@param /);
  });

  test.each(ALL_NEW)("%s never ships an inline <script> or on* handler (strict CSP)", (rel) => {
    const src = read(rel);
    expect(src).not.toMatch(/<script/i);
    const handlers = markup(src).match(/\son[a-z]+=/gi) ?? [];
    expect(handlers, `inline handlers: ${handlers.join(", ")}`).toEqual([]);
  });

  test.each(ALL_NEW)("%s leaks no hardcoded hex colour (token-driven)", (rel) => {
    expect(read(rel)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test.each(ALL_NEW)("%s has no em-dash (house rule)", (rel) => {
    expect(read(rel)).not.toContain("—");
  });
});

// ---------------------------------------------------------------------------
// avatar: AvatarGroupCount + AvatarBadge (shadcn new-york-v4 data-slot names)
// ---------------------------------------------------------------------------
describe("avatar/group-count (the +N overflow tile, data-slot=avatar-group-count)", () => {
  const src = read("avatar/group-count.jte");
  test('carries the shadcn data-slot + a count param rendered as "+N"', () => {
    expect(src).toContain('data-slot="avatar-group-count"');
    expect(src).toContain("@param int count");
    expect(src).toContain("+${count}");
  });
  test("sizes via the avatar scale (sm/default/lg) + reads the muted token pair, rounded-full", () => {
    expect(src).toContain('@param String size');
    expect(src).toContain('size.equals("sm") ? "1.5rem"');
    expect(src).toContain('size.equals("lg") ? "2.5rem"');
    expect(src).toContain("rounded-[var(--lv-radius-full)]");
    expect(src).toContain("bg-[var(--lv-color-muted-bg)]");
    expect(src).toContain("text-[var(--lv-color-muted-fg)]");
  });
});

describe("avatar/badge (the status dot, data-slot=avatar-badge)", () => {
  const src = read("avatar/badge.jte");
  test("carries the shadcn data-slot, absolutely pinned to the corner with a surface ring", () => {
    expect(src).toContain('data-slot="avatar-badge"');
    expect(src).toContain("absolute");
    expect(src).toContain("right-0");
    expect(src).toContain("bottom-0");
    expect(src).toContain("ring-2");
    expect(src).toContain("ring-[var(--lv-color-bg)]");
  });
  test("default fill is the primary token pair; an optional content slot carries a glyph/count", () => {
    expect(src).toContain("bg-[var(--lv-color-primary)]");
    expect(src).toContain("text-[var(--lv-color-primary-fg)]");
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).toContain("@if(content != null)${content}@endif");
  });
  test("a11y: a non-blank label announces it (role=img + aria-label), else it is decorative", () => {
    expect(src).toContain("@param String label");
    expect(src).toContain('labelled = label != null && !label.isBlank()');
    expect(src).toContain('role="${labelled ? "img" : null}"');
    expect(src).toContain('aria-label="${labelled ? label : null}"');
    expect(src).toContain('aria-hidden="${labelled ? null : "true"}"');
  });
});

// ---------------------------------------------------------------------------
// kbd: KbdGroup
// ---------------------------------------------------------------------------
describe("kbd/group (KbdGroup, data-slot=kbd-group)", () => {
  const src = read("kbd/group.jte");
  test("renders a <kbd> wrapper with the shadcn data-slot + a content slot of keys", () => {
    expect(src).toMatch(/<kbd[\s\n]/);
    expect(src).toContain("</kbd>");
    expect(src).toContain('data-slot="kbd-group"');
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).toContain("${content}");
  });
  test("is an inline flex row with a token gap (shadcn inline-flex items-center gap-1)", () => {
    expect(src).toContain("inline-flex");
    expect(src).toContain("items-center");
    expect(src).toContain("gap-[var(--lv-space-1)]");
  });
});

// ---------------------------------------------------------------------------
// badge / chip: ghost + link variants (shadcn new-york-v4 badgeVariants)
// ---------------------------------------------------------------------------
describe("badge: ghost + link variants (mirroring shadcn new-york-v4)", () => {
  const src = read("badge.jte");
  test("both switches gain ghost (transparent fill) + link (transparent fill) cases", () => {
    // bg switch: both are fill-less
    expect(src).toContain('case "ghost"       -> "transparent";');
    expect(src).toContain('case "link"        -> "transparent";');
  });
  test("ghost is foreground text; link is primary-coloured text (shadcn treatment)", () => {
    expect(src).toContain('case "ghost"       -> "var(--lv-color-fg)";');
    expect(src).toContain('case "link"        -> "var(--lv-color-primary)";');
  });
  test("link underlines on hover (underline-offset-4 + the anchor hover:underline)", () => {
    expect(src).toContain('"link".equals(variant) ? " underline-offset-4" : ""');
    expect(src).toContain('"link".equals(variant) ? "hover:underline"');
  });
  test("the variant doc lists ghost + link", () => {
    expect(src).toContain('"ghost"');
    expect(src).toContain('"link"');
  });
});

describe("chip: ghost + link variants (mirrors badge once it has them)", () => {
  const src = read("chip.jte");
  test("both switches gain ghost + link cases, same token treatment as badge", () => {
    expect(src).toContain('case "ghost"       -> "transparent";');
    expect(src).toContain('case "link"        -> "transparent";');
    expect(src).toContain('case "ghost"       -> "var(--lv-color-fg)";');
    expect(src).toContain('case "link"        -> "var(--lv-color-primary)";');
  });
  test("link gets underline-offset (mirrors badge)", () => {
    expect(src).toContain('"link".equals(variant) ? " underline-offset-4" : ""');
  });
  test("the rendered MARKUP stays domain-agnostic (no filiale / housetree / gestionale leak)", () => {
    // the doc comment legitimately NAMES domain meaning as the thing that must NOT live here
    // (e.g. "which filter, a filiale"); the agnostic invariant is about the rendered markup.
    expect(markup(src).toLowerCase()).not.toMatch(/filiale|housetree|gestionale/);
  });
});

// ---------------------------------------------------------------------------
// tooltip: v-next reforge — popover+enhancer, placement, arrow
// ---------------------------------------------------------------------------
describe("tooltip: positioning (placement via CSS Anchor Positioning) + arrow", () => {
  // v-next changes: side/align/sideOffset params removed; replaced by a single `placement`
  // param that maps to CSS Anchor Positioning `position-area` values. CSS-only group-hover
  // reveal is gone; the bubble is popover="manual" shown by tooltip.enhancer.ts. No server-side
  // aria-describedby (the enhancer wires it at mount). Arrow is a <span class="lv-tooltip__arrow">
  // (aria-hidden inline span), not a data-slot element filled with a token background.
  const src = read("tooltip.jte");
  test("keeps the WAI-ARIA tooltip contract (role=tooltip + stable id + popover=manual)", () => {
    // v-next WAI-ARIA contract: role="tooltip" on the bubble, stable id, popover="manual".
    // aria-describedby is wired by tooltip.enhancer.ts at mount, NOT server-side.
    expect(src).toContain('role="tooltip"');
    expect(src).toContain('id="${id}"');
    // No server-side aria-describedby: the enhancer sets it on the trigger at mount.
    expect(src).not.toContain('aria-describedby=');
    // The bubble is a native popover (hidden by UA until enhancer calls showPopover()).
    expect(src).toContain('popover="manual"');
    // CSS group-hover is gone; the enhancer controls show/hide.
    expect(src).not.toContain("group-hover:visible");
    expect(src).not.toContain("group-focus-within:visible");
  });
  test("uses `placement` param (not side/align/sideOffset) mapping to CSS position-area values", () => {
    // v-next: `placement` replaces the old side/align/sideOffset trio.
    expect(src).toContain('@param String placement = "top"');
    expect(src).not.toContain("@param String side");
    expect(src).not.toContain("@param String align");
    expect(src).not.toContain("@param String sideOffset");
    // The wrapper mirrors placement as data-lievit-tooltip-placement for the enhancer.
    expect(src).toContain('data-lievit-tooltip-placement="${placement}"');
  });
  test("placement drives CSS Anchor Positioning position-area (not absolute left/top offsets)", () => {
    // v-next: placement maps to CSS position-area two-keyword values.
    expect(src).toContain('"top center"');    // default "top" placement
    expect(src).toContain('"bottom center"'); // "bottom" placement
    expect(src).toContain('"left center"');   // "left" placement
    expect(src).toContain('"right center"');  // "right" placement
    // The position-area value is set inline on the bubble via the style attribute.
    expect(src).toContain("position-area:${positionArea}");
    // No old absolute-position math.
    expect(src).not.toContain('case "right"  -> "left:100%;"');
    expect(src).not.toContain('case "bottom" -> "top:100%;"');
  });
  test("ships the CSS arrow (lv-tooltip__arrow span, aria-hidden) — no data-slot, no token fill", () => {
    // v-next: arrow is a <span class="lv-tooltip__arrow" aria-hidden="true"> rendered inline.
    // It is NOT a data-slot element and does NOT use bg-[var(--lv-color-fg)] (it inherits bg).
    expect(src).toContain('class="lv-tooltip__arrow"');
    expect(src).toContain('aria-hidden="true"');
    // The arrow param controls whether it is rendered.
    expect(src).toContain("@param boolean arrow = true");
    // Old data-slot and token-fill gone:
    expect(src).not.toContain('data-slot="tooltip-arrow"');
    expect(src).not.toContain("bg-[var(--lv-color-fg)]");
  });
});

// ---------------------------------------------------------------------------
// hover-card: align + sideOffset
// ---------------------------------------------------------------------------
describe("hover-card: positioning (align + sideOffset), preview model intact", () => {
  const src = read("hover-card.jte");
  test("keeps the Radix preview model: content panel has NO role + is aria-hidden", () => {
    expect(src).toContain('data-slot="hover-card-content"');
    expect(src).toContain('aria-hidden="true"');
    // no role= on the content panel (the preview-model invariant the central suite also pins)
    expect(src).not.toMatch(/data-slot="hover-card-content"[^>]*\srole=/);
  });
  test("adds align + sideOffset params + mirrors align as data-align", () => {
    expect(src).toContain("@param String align");
    expect(src).toContain("@param String sideOffset");
    expect(src).toContain('data-align="${align}"');
  });
  test("align maps to the horizontal anchoring; sideOffset is the token gap below the trigger", () => {
    expect(src).toContain('case "center" -> "left:50%; transform:translateX(-50%);"');
    expect(src).toContain('case "end"    -> "right:0;"');
    // default gap is a bracketed token margin class; caller override is inline
    expect(src).toContain('"mt-[var(--lv-space-1)]"');
    expect(src).toContain('"margin-top:" + sideOffset');
  });
  test("still revealed purely by CSS (no Floating UI, no JS)", () => {
    expect(src).toContain("group-hover:visible");
    expect(src.toLowerCase()).not.toContain("floating-ui");
  });
});

// ---------------------------------------------------------------------------
// toast: re-forged item (Wave 5) + region.jte live-region container
// ---------------------------------------------------------------------------
// REMOVED from item: promiseState/promise variant, loading variant + spinner composition,
// heading, gg.jte.Content content/actions slots (replaced by action/actionHref/actionWireClick
// params), standalone/position (placement now lives in region.jte).
//   - promise/loading variants were removed because: promise resolves server-side to a
//     concrete severity before the fragment is rendered; loading state belongs to
//     progress/loading-section, not to the transient toast stamp.
//   - standalone/position were removed because: placement is now a region concern
//     (region.jte's `placement` param), not an item concern. The item is always injected
//     into the region's live-region sub-containers by the enhancer.
//   - Content slots were replaced by flat action params to keep the item a pure static
//     stamp (no slot composition complexity for the enhancer injection path).
describe("toast item (Wave 5 re-forge): new surface", () => {
  const item = read("toast.jte");
  test("item declares the re-forged variant vocabulary (info|success|warning|destructive)", () => {
    // Variant drives live-region routing + accent token pair.
    // promise/loading/default are REMOVED: promise resolves server-side; loading belongs
    // in progress/loading-section, not a transient toast.
    expect(item).toContain('@param String variant = "info"');
    expect(item).toContain('"info"');
    expect(item).toContain('"success"');
    expect(item).toContain('"warning"');
    expect(item).toContain('"destructive"');
    expect(item).not.toContain('@param String promiseState');
    expect(item).not.toContain('"loading"');
    expect(item).not.toContain('"promise"');
  });
  test("item has role=none (content lives inside the live region, no extra role on the card)", () => {
    // WAI-ARIA Alert pattern: the live-region role (status/alert) is on the sub-containers
    // in region.jte; the item card is content inside that region and carries role=none.
    expect(item).toContain('role="none"');
    expect(item).not.toContain('role="alert"');
    expect(item).not.toContain('role="status"');
  });
  test("item carries the enhancer data contract (data-slot, data-variant, data-toast-id, data-toast-duration)", () => {
    // The enhancer (toast.enhancer.ts) reads these to route items and manage countdown timers.
    expect(item).toContain('data-slot="toast-item"');
    expect(item).toContain('data-variant="${variant}"');
    expect(item).toContain('data-toast-id="${toastId}"');
    expect(item).toContain('data-toast-duration="${duration}"');
  });
  test("item action params replace the old Content slots (flat params, no gg.jte.Content)", () => {
    // action/actionHref/actionWireClick replace the old gg.jte.Content actions slot.
    // Flat params allow the enhancer to inject the fragment without slot composition.
    expect(item).toContain('@param String action = null');
    expect(item).toContain('@param String actionHref = null');
    expect(item).toContain('@param String actionWireClick = null');
    expect(item).not.toContain('@param gg.jte.Content actions');
    expect(item).not.toContain('@param gg.jte.Content content');
  });
  test("item has no standalone/position params (placement is a region.jte concern now)", () => {
    // Placement moved to region.jte `placement` param; the item is always injected
    // into the region's live-region sub-containers — it never positions itself.
    expect(item).not.toContain('@param boolean standalone');
    expect(item).not.toContain('@param String position');
    expect(item).not.toContain('standalone ?');
  });
  test("item has no spinner composition (loading variant removed)", () => {
    // Loading variant was removed: spinner belongs to progress/loading-section,
    // not to the transient toast stamp.
    expect(item).not.toContain('@template.lievit.spinner(');
  });
  test("item dismissible button is present (data-slot=toast-dismiss, aria-label)", () => {
    // WAI-ARIA: real <button type=button aria-label="Dismiss notification">.
    expect(item).toContain('data-slot="toast-dismiss"');
    expect(item).toContain('aria-label="Dismiss notification"');
  });
});

describe("toast region.jte (Wave 5): live-region container surface", () => {
  const region = read("toast/region.jte");
  test("region has two sub-containers: role=status polite (info/success) + role=alert assertive (warning/destructive)", () => {
    // WAI-ARIA APG Alert pattern: disruptive variants use role=alert/assertive;
    // non-disruptive use role=status/polite. aria-atomic=false so each item announces
    // individually, not the full container.
    expect(region).toContain('role="status"');
    expect(region).toContain('aria-live="polite"');
    expect(region).toContain('role="alert"');
    expect(region).toContain('aria-live="assertive"');
    expect(region).toContain('aria-atomic="false"');
  });
  test("region placement param drives fixed positioning (top/bottom * start/center/end)", () => {
    // Placement is a region concern, not an item concern (item removed standalone/position).
    expect(region).toContain('@param String placement = "bottom-end"');
    expect(region).toContain('"top-start"');
    expect(region).toContain('"top-end"');
    expect(region).toContain('"bottom-start"');
    expect(region).toContain('"bottom-end"');
    expect(region).toContain('position:fixed');
  });
  test("region carries data-slot=toast-region and the enhancer data attributes", () => {
    // The enhancer reads data-toast-max-visible, data-toast-sse-url, data-toast-bell-id.
    expect(region).toContain('data-slot="toast-region"');
    expect(region).toContain('data-toast-max-visible="${maxVisible}"');
    expect(region).toContain('data-toast-placement="${placement}"');
  });
  test("bottom placements stack column-reverse so a new toast appears nearest the edge (sonner model)", () => {
    expect(region).toContain('placement.startsWith("bottom")');
    expect(region).toContain('"column-reverse"');
    expect(region).toContain('"column"');
  });
  test("region has no inline <script> (CSP-clean; behavior lives in toast.enhancer.ts)", () => {
    expect(region).not.toMatch(/<script/i);
  });
});

describe("toast: stacking viewport + position (toast/viewport.jte is retained)", () => {
  // toast/viewport.jte is the fixed stack container (retained for backward compat /
  // pre-enhancer SSR stacking use-case). The item no longer has standalone/position params
  // (those belong to region.jte now), but viewport.jte is its own standalone container.
  const vp = read("toast/viewport.jte");
  test("viewport is the fixed stack container (data-slot=toast-viewport) keyed on position", () => {
    expect(vp).toContain('data-slot="toast-viewport"');
    expect(vp).toContain("@param String position");
    expect(vp).toContain("@param gg.jte.Content content");
    expect(vp).toContain("${content}");
    expect(vp).toContain("position: fixed");
    expect(vp).toContain("z-index: var(--lv-z-toast");
  });
  test("bottom positions stack column-reverse so a new toast pushes the older ones up (sonner)", () => {
    expect(vp).toContain('bottom = position.startsWith("bottom")');
    expect(vp).toContain('bottom ? "column-reverse" : "column"');
  });
});

// ---------------------------------------------------------------------------
// registration: each touched/new component lists its files in its meta.json
// ---------------------------------------------------------------------------
describe("meta.json registration of the new sub-partials + the viewport", () => {
  const meta = (name: string) => JSON.parse(read(`${name}/meta.json`));
  const paths = (name: string) => meta(name).files.map((f: { path: string }) => f.path);

  test("avatar/meta.json registers the group-count + badge children", () => {
    expect(paths("avatar")).toContain("jte/avatar/group-count.jte");
    expect(paths("avatar")).toContain("jte/avatar/badge.jte");
  });
  test("kbd/meta.json registers the group child", () => {
    expect(paths("kbd")).toContain("jte/kbd/group.jte");
  });
  test("toast/meta.json registers region.jte + viewport.jte; depends on icon (not spinner)", () => {
    // Wave 5 re-forge: toast item no longer composes the spinner partial (loading variant
    // removed), so spinner is no longer a registryDependency. The icon partial is used
    // for the intent icon slot. Both region.jte and viewport.jte are listed in files.
    expect(paths("toast")).toContain("jte/toast/region.jte");
    expect(paths("toast")).toContain("jte/toast/viewport.jte");
    expect(meta("toast").registryDependencies).toContain("icon");
    expect(meta("toast").registryDependencies).not.toContain("spinner");
  });
});
