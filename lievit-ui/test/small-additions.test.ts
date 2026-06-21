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
// tooltip: arrow + side / sideOffset / align
// ---------------------------------------------------------------------------
describe("tooltip: positioning (side/align/sideOffset) + arrow", () => {
  const src = read("tooltip.jte");
  test("keeps the WAI-ARIA tooltip contract (role + id + aria-describedby + CSS reveal)", () => {
    expect(src).toContain('role="tooltip"');
    expect(src).toContain('id="${tipId}"');
    expect(src).toContain('aria-describedby="${tipId}"');
    expect(src).toContain("group-hover:visible");
    expect(src).toContain("group-focus-within:visible");
  });
  test("adds side / align / sideOffset params + mirrors them as data-side / data-align", () => {
    expect(src).toContain("@param String side");
    expect(src).toContain("@param String align");
    expect(src).toContain("@param String sideOffset");
    expect(src).toContain('data-side="${side}"');
    expect(src).toContain('data-align="${align}"');
  });
  test("side drives the anchored edge; align drives the cross-axis", () => {
    expect(src).toContain('case "right"  -> "left:100%;"');
    expect(src).toContain('case "bottom" -> "top:100%;"');
    expect(src).toContain('case "left"   -> "right:100%;"');
    // top (default) anchors to bottom:100%
    expect(src).toContain('default       -> "bottom:100%;"');
  });
  test("sideOffset is token-driven: default per-side bracketed margin class, caller override inline", () => {
    // the default token lives ONLY inside [ ] (so the central no-bare-utility gate passes)
    expect(src).toContain('case "bottom" -> "mt-[var(--lv-space-1)]"');
    expect(src).toContain('case "right"  -> "ml-[var(--lv-space-1)]"');
    // a caller-supplied sideOffset overrides inline
    expect(src).toContain('"margin-bottom:" + sideOffset');
  });
  test("ships the arrow (data-slot=tooltip-arrow): a rotated square, aria-hidden, token-filled", () => {
    expect(src).toContain('data-slot="tooltip-arrow"');
    expect(src).toContain("rotate(45deg)");
    expect(src).toMatch(/data-slot="tooltip-arrow"[^>]*aria-hidden="true"/);
    expect(src).toContain("bg-[var(--lv-color-fg)]");
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
// toast: default + loading + promise variants, stacking viewport + position
// ---------------------------------------------------------------------------
describe("toast: default / loading / promise variants", () => {
  const src = read("toast.jte");
  test("declares the new variants in the param doc + a promiseState param", () => {
    expect(src).toContain('@param String variant = "info"');
    expect(src).toContain("@param String promiseState");
    expect(src).toContain('"default"');
    expect(src).toContain('"loading"');
    expect(src).toContain('"promise"');
  });
  test("promise resolves server-side to a concrete severity (success or danger)", () => {
    expect(src).toContain('"promise".equals(variant) ? ("danger".equals(promiseState) ? "danger" : "success") : variant');
  });
  test("default + loading are neutral: surface fill, no severity tint, polite (not alert)", () => {
    expect(src).toContain('neutral = "default".equals(effective) || "loading".equals(effective)');
    expect(src).toContain('neutral ? "var(--lv-color-surface)"');
    // urgent (assertive) is only danger/warning, so neutral stays role=status/polite
    expect(src).toContain('urgent = "danger".equals(effective) || "warning".equals(effective)');
  });
  test("loading swaps the severity icon for the spinner partial", () => {
    expect(src).toContain('@if("loading".equals(effective))');
    expect(src).toContain("@template.lievit.spinner(");
  });
  test("the enhancer contract is preserved (data-lievit-toast + duration + dismiss button)", () => {
    expect(src).toContain("data-lievit-toast");
    expect(src).toContain('data-toast-duration="${duration}"');
    expect(src).toContain("data-toast-dismiss");
    expect(src).toContain('aria-atomic="true"');
  });
});

describe("toast: stacking viewport + position", () => {
  const toast = read("toast.jte");
  const vp = read("toast/viewport.jte");
  test("a standalone toast fixes itself to one of the six sonner positions", () => {
    expect(toast).toContain("@param String position");
    expect(toast).toContain("@param boolean standalone");
    for (const p of ["top-left", "top-center", "top-right", "bottom-left", "bottom-center"]) {
      expect(toast, `position case ${p}`).toContain(`"${p}"`);
    }
    expect(toast).toContain('standalone ? "position: fixed; z-index: var(--lv-z-toast');
  });
  test("inside a viewport the toast flows (standalone=false => position: relative)", () => {
    expect(toast).toContain('standalone ? "position: fixed');
    expect(toast).toContain('"position: relative;"');
  });
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
  test("toast/meta.json registers the viewport child + depends on spinner", () => {
    expect(paths("toast")).toContain("jte/toast/viewport.jte");
    expect(meta("toast").registryDependencies).toContain("spinner");
  });
});
