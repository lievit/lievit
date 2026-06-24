/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Static JTE partials, Wave 1a (ADR-0012 server-first pivot): the consumer-free DISPLAY
 * islands converted to JTE partials -- alert, card, separator, progress, spinner, hover-card,
 * tooltip, button. Their Lit islands were removed; these partials are the to-be form.
 *
 * Like icon.jte's suite and static-partials-b1, this Node harness has no JTE compiler, so it
 * asserts on the partial SOURCE as text: it pins the token-driven styling (every colour /
 * space / radius reads a --lv-* var, never a hardcoded hex), the accessibility contract
 * (roles / aria / live regions), the @param API + that content/variant land in the right
 * element, the JTE comment syntax, and that no inline <script> / on* handler ships (the strict
 * CSP refuses them -- the exact regression class that motivated the pivot). The real-compiler
 * golden runs out of band via `npm run test:jte-compile` (gg.jte 3.2.4 precompileAll).
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (name: string) => readFileSync(join(jteDir, `${name}.jte`), "utf8");

const PARTIALS = [
  "alert",
  "card",
  "separator",
  "progress",
  "spinner",
  "hover-card",
  "tooltip",
  "button",
];

/**
 * Partials reached as the vendored `@template.lievit.<name>` namespace (every partial's copy-in
 * target is `lievit/<name>.jte`). `button` is mid-migration (owned elsewhere) and still shows the
 * bare `@@template.<name>` in its doc, so it is excluded here until that lands.
 */
const RESERVED_BARE = new Set<string>([]);
const callSnippet = (name: string) =>
  RESERVED_BARE.has(name) ? `@@template.${name}(` : `@@template.lievit.${name}(`;

/** Tailwind utilities that legitimately carry a fixed geometry value, not a scale token. */
const HARDCODE_EXCEPTIONS = /tracking-tight|leading-snug|leading-none|space-x-2/;

describe("static partials w1a -- shared hygiene", () => {
  for (const name of PARTIALS) {
    const src = read(name);

    test(`${name}: ships and carries a usage-doc comment (<%-- --%> syntax) with the @param API + a call snippet`, () => {
      expect(src, "missing <%-- --%> jte comment block").toContain("<%--");
      expect(src, "comment block must close").toContain("--%>");
      expect(src, "must NOT use the @* *@ comment syntax").not.toMatch(/@\*/);
      expect(src, "missing Usage section").toMatch(/Usage:/);
      expect(src, "usage snippet must show the @template call").toContain(callSnippet(name));
      expect(src, "missing param declaration").toMatch(/@param /);
    });

    test(`${name}: never reaches for Font Awesome / wa-icon`, () => {
      expect(src.toLowerCase()).not.toMatch(/font-?awesome|wa-icon|fa-/);
    });

    test(`${name}: no inline <script> and ZERO inline on* handlers (strict CSP refuses them)`, () => {
      expect(src).not.toMatch(/<script/i);
      const inlineHandlers = src.match(/\son[a-z]+=/gi) ?? [];
      expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
    });

    test(`${name}: no Lit residue in the markup (server-first, no island)`, () => {
      // The island is gone; the partial must not reach back into Lit. (The doc comment may
      // still NAME the removed <lv-*> island for provenance, so we check Lit code, not prose.)
      expect(src.toLowerCase()).not.toMatch(/customelement|litelement|adoptlightstyles|import .*\blit\b/);
    });

    test(`${name}: styling is token-driven (no bare hex colours, no raw px spacing)`, () => {
      // Strip doc comments first: hex colour examples in <%-- --%> blocks are documentation,
      // not markup (the rendered markup never emits a bare hex). The alert.jte doc comment
      // legitimately references #16a34a as an example of the token it replaces.
      const markupOnly = src.replace(/<%--[\s\S]*?--%>/g, "");
      expect(markupOnly, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      // Strip arbitrary-value brackets first so their inner --lv-* token names + fractions are
      // not mistaken for bare scale utilities; then assert no Tailwind numeric scale utility
      // (p-4, gap-2, h-10, text-sm...) survives: every dimension reads a --lv-* var.
      const stripped = src
        .replace(/\[[^\]]*\]/g, "[]")
        // a var(--lv-*) reference is token-driven by definition (incl. inside inline styles,
        // e.g. a dynamic grid's column-gap:var(--lv-space-3)): never a bare scale utility.
        .replace(/var\(--lv-[^)]*\)/g, "")
        .replace(/-\d+\/\d+/g, "")
        .replace(/\bmin-w-0\b/g, "");
      const numericUtils = (stripped.match(/\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mb|mt|gap|h|w|text|size|space)-[1-9]/g) ?? [])
        .filter((u) => !HARDCODE_EXCEPTIONS.test(u));
      expect(numericUtils, `non-token numeric utilities: ${numericUtils.join(", ")}`).toEqual([]);
    });
  }
});

describe("alert", () => {
  const src = read("alert");
  test("declares the documented param API + a content slot for the message", () => {
    // v-next API: variant, title (String), boolean icon, closable, banner, role, content slot.
    // `heading` and the separate `description` Content slot are gone; `title` is now a String
    // rendered as <p>; the body slot is data-slot="alert-content" (was alert-description).
    expect(src).toContain("@param String variant");
    expect(src).toContain("@param String title = null");
    expect(src).toContain("@param boolean icon = true");
    expect(src).toContain("@param boolean closable = false");
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).toContain("${content}");
  });
  test("severity drives the live role: destructive/warning assertive, info/success polite", () => {
    // v-next: role auto-derived as _autoRole = (warning|destructive) ? "alert" : "status".
    // The effectiveRole/emitRole indirection supports a role= override and role="none" suppression.
    expect(src).toMatch(/"destructive"\.equals\(variant\)/);
    expect(src).toMatch(/"warning"\.equals\(variant\)/);
    // The auto-role expression:
    expect(src).toContain('("warning".equals(variant) || "destructive".equals(variant)) ? "alert" : "status"');
    // The role attribute is conditionally emitted (null when _emitRole is false):
    expect(src).toContain('role="${_emitRole ? _effectiveRole : null}"');
  });
  test("the title renders before the body content, only when set", () => {
    // v-next: title is a String param rendered as a <p data-slot="alert-title">; the body
    // lives in data-slot="alert-content" (replacing alert-description). Title is before content.
    expect(src).toContain('data-slot="alert-title"');
    expect(src).toContain('data-slot="alert-content"');
    // Title element is a <p> not a heading.
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<p\s[^>]*data-slot="alert-title"/);
    expect(src.indexOf('data-slot="alert-title"')).toBeLessThan(
      src.indexOf('data-slot="alert-content"'),
    );
  });
  test("tint is token-driven via color-mix over the severity token", () => {
    expect(src).toContain("color-mix(in srgb");
    expect(src).toContain("var(--lv-color-destructive)");
    expect(src).toContain("var(--lv-color-bg)");
  });
});

describe("card", () => {
  const src = read("card");
  test("optional heading + headingId + a body content slot (back-compat)", () => {
    expect(src).toContain("@param String heading");
    expect(src).toContain("@param String headingId");
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).toContain("${content}");
  });
  test("ships the full shadcn slot set: title / description / action / content / footer", () => {
    // each distinct shadcn sub-component maps to a Content slot param + a data-slot region
    expect(src).toContain("@param gg.jte.Content title");
    expect(src).toContain("@param gg.jte.Content description");
    expect(src).toContain("@param gg.jte.Content action");
    expect(src).toContain("@param gg.jte.Content footer");
    expect(src).toContain('data-slot="card-header"');
    expect(src).toContain('data-slot="card-title"');
    expect(src).toContain('data-slot="card-description"');
    expect(src).toContain('data-slot="card-action"');
    expect(src).toContain('data-slot="card-content"');
    expect(src).toContain('data-slot="card-footer"');
  });
  test("each optional slot renders only when supplied (no empty regions)", () => {
    expect(src).toContain("@if(description != null)");
    expect(src).toContain("@if(action != null)");
    expect(src).toContain("@if(footer != null)");
    // the rich title slot wins over the plain heading (content-over-scalar)
    expect(src).toContain("@if(title != null)${title}@else${heading}@endif");
  });
  test("a title makes it a labelled region; no title => no landmark", () => {
    expect(src).toContain('role="${hasTitle ? "region" : null}"');
    expect(src).toContain('aria-labelledby="${hasTitle ? headingId : null}"');
    expect(src).toContain('id="${headingId}"');
  });
  test("elevated surface via the shadow token", () => {
    expect(src).toContain("shadow-[var(--lv-shadow-sm)]");
    expect(src).toContain("border-[var(--lv-color-border)]");
  });
});

describe("separator", () => {
  const src = read("separator");
  test("orientation + decorative params", () => {
    expect(src).toContain("@param String orientation");
    expect(src).toContain("@param boolean decorative");
  });
  test("announced => role=separator + aria-orientation; decorative => dropped + aria-hidden", () => {
    expect(src).toContain('role="${decorative ? null : "separator"}"');
    expect(src).toContain('aria-orientation="${decorative ? null : orientation}"');
    expect(src).toContain('aria-hidden="${decorative ? "true" : null}"');
  });
  test("the rule colour reads the border token", () => {
    expect(src).toContain("bg-[var(--lv-color-border)]");
  });
});

describe("progress", () => {
  const src = read("progress");
  test("typed value + label params", () => {
    expect(src).toContain("@param int value");
    expect(src).toContain("@param String label");
  });
  test("WAI-ARIA progressbar: role + min/max + label, valuenow only when determinate", () => {
    expect(src).toContain('role="progressbar"');
    expect(src).toContain('aria-valuemin="0"');
    expect(src).toContain('aria-valuemax="100"');
    expect(src).toContain('aria-label="${label}"');
    expect(src).toContain('aria-valuenow="${indeterminate ? null : String.valueOf(pct)}"');
  });
  test("indeterminate animates and respects reduced motion", () => {
    expect(src).toContain("@if(indeterminate)");
    expect(src).toContain("motion-reduce:animate-none");
    expect(src).toContain("bg-[var(--lv-color-primary)]");
  });
});

describe("spinner", () => {
  const src = read("spinner");
  test("size + label params", () => {
    expect(src).toContain("@param String size");
    expect(src).toContain("@param String label");
  });
  test("WAI-ARIA status: role=status + aria-label, reduced-motion guard", () => {
    expect(src).toContain('role="status"');
    expect(src).toContain('aria-label="${label}"');
    expect(src).toContain("motion-reduce:animate-none");
  });
  test("ring colours read tokens", () => {
    expect(src).toContain("border-[var(--lv-color-border)]");
    expect(src).toContain("border-t-[var(--lv-color-primary)]");
  });
});

describe("hover-card (CSS-only, Radix preview model)", () => {
  const src = read("hover-card");
  test("trigger + content slots", () => {
    expect(src).toContain("@param gg.jte.Content trigger");
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).toContain("${trigger}");
    expect(src).toContain("${content}");
  });
  test("preview model: content panel has NO role and is aria-hidden", () => {
    expect(src).toContain('aria-hidden="true"');
    expect(src).toContain('data-slot="hover-card-content"');
    expect(src).not.toMatch(/data-slot="hover-card-content"[^>]*role=/);
  });
  test("revealed purely by CSS group-hover / group-focus-within (no JS, no Floating UI)", () => {
    expect(src).toContain("group-hover:visible");
    expect(src).toContain("group-focus-within:visible");
    expect(src.toLowerCase()).not.toContain("floating-ui");
  });
  test("popover surface reads tokens", () => {
    expect(src).toContain("bg-[var(--lv-color-popover)]");
    expect(src).toContain("z-[var(--lv-z-popover)]");
  });
});

describe("tooltip (popover+enhancer, WAI-ARIA tooltip pattern)", () => {
  // v-next reforge: CSS-only group-hover reveal is gone. The bubble is popover="manual"
  // (UA hides it by default). The enhancer (tooltip.enhancer.ts) calls showPopover()/hidePopover()
  // on hover/focus events and wires aria-describedby at runtime. The `tipId` param is renamed
  // to `id`; there is no server-side aria-describedby (the enhancer does it at mount).
  const src = read("tooltip");
  test("trigger slot + content text + a stable bubble id", () => {
    expect(src).toContain("@param gg.jte.Content trigger");
    expect(src).toContain("@param String content");
    // v-next: param is `id`, not `tipId`
    expect(src).toContain("@param String id");
    expect(src).toContain("${content}");
    expect(src).toContain("${trigger}");
  });
  test("role=tooltip bubble with stable id; aria-describedby is wired by the enhancer, not server-side", () => {
    expect(src).toContain('role="tooltip"');
    // The bubble id is stamped from the `id` param; the wrapper mirrors it in data-lievit-tooltip-id.
    expect(src).toContain('id="${id}"');
    expect(src).toContain('data-lievit-tooltip-id="${id}"');
    // No server-side aria-describedby: the enhancer wires it at mount on the first focusable
    // descendant (or the wrapper itself), so it does NOT appear in the static source.
    expect(src).not.toContain('aria-describedby=');
  });
  test("revealed via native popover='manual' + the enhancer (not CSS group-hover)", () => {
    // v-next: the bubble is a native popover, hidden by the UA until the enhancer shows it.
    expect(src).toContain('popover="manual"');
    // CSS-only group-hover is gone.
    expect(src).not.toContain("group-hover:visible");
    expect(src).not.toContain("group-focus-within:visible");
    // The enhancer is declared in the JTE doc comment (the show/hide mechanism contract).
    expect(src).toContain("tooltip.enhancer.ts");
  });
});

describe("button (the click is wired by the consumer via l:click)", () => {
  const src = read("button");
  test("variant / type / href / disabled params + a content label slot", () => {
    expect(src).toContain("@param String variant");
    expect(src).toContain("@param String type");
    expect(src).toContain("@param String href");
    expect(src).toContain("@param boolean disabled");
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).toContain("${content}");
  });
  test("renders a native <button> by default, an <a href> when href is set", () => {
    expect(src).toContain("@if(href != null)");
    expect(src).toMatch(/<a\b/);
    expect(src).toMatch(/<button\b/);
    expect(src).toContain('type="${type}"');
  });
  test("native control carries activation for free: no manual role/tabindex on the button", () => {
    // a real <button>/<a> gives role + keyboard for free; the partial must not fake it.
    expect(src).not.toMatch(/role="button"/);
  });
  test("disabled is a real boolean attr on the button, aria-disabled on the link", () => {
    // Wave 1 re-forge: `isBlocked = disabled || loading` -- both disabled AND loading block
    // activation. The <button> uses `disabled="${isBlocked}"` (JTE smart attr: emits the bare
    // `disabled` attr when true, omits when false). The <a> uses the ternary form since <a>
    // cannot be natively disabled.
    expect(src).toContain('disabled="${isBlocked}"');
    expect(src).toContain('aria-disabled="${isBlocked ? "true" : null}"');
  });
  test("focus ring + variant colours read tokens", () => {
    expect(src).toContain("focus-visible:shadow-[var(--lv-ring)]");
    expect(src).toContain("bg-[var(--lv-color-primary)]");
    expect(src).toContain("bg-[var(--lv-color-destructive)]");
  });
});
