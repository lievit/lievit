/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Structural golden for the LOGIN block (#458). A block is a composition: a server-rendered
 * .jte template that wires the existing lievit-ui partials (icon, input-group) into the
 * representative login pattern. Like the static-partials suite, the .jte is compiled in the
 * Java world, so the harness asserts on the partial SOURCE as text: it pins token-only
 * styling (every colour/space/radius reads a --lv-* var), the real <form method="post"> with
 * its action + CSRF slot, the accessibility contract (landmark, labelled fields, error
 * alert + aria-describedby), the @param API, that it COMPOSES partials rather than rebuilding
 * primitives, and that icons go through the Lucide partial (never Font Awesome / wa-icon).
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(
  join(import.meta.dirname, "..", "registry", "jte", "blocks", "login.jte"),
  "utf8"
);

/** The rendered markup only: the leading `<%-- ... --%>` usage-doc comment stripped away. */
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

/** Tailwind utilities that legitimately carry a fixed / fractional geometry value. */
const HARDCODE_EXCEPTIONS = /tracking-tight|leading-snug|leading-none|leading-relaxed|h-px|h-full|w-full|min-h-screen/;

describe("login block (#458) -- hygiene", () => {
  test("ships a usage-doc comment with the @param API + a @template call snippet", () => {
    expect(src, "missing jte comment block").toContain("<%--");
    expect(src, "missing Usage section").toMatch(/Usage:/);
    expect(src, "usage snippet must show the @template call").toContain("@template.lievit.blocks.login(");
    expect(src, "missing param declaration").toMatch(/@param /);
  });

  test("uses jte comment syntax (<%-- --%>), never @* *@ or an HTML/JS comment for the doc block", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
    expect(src, "must NOT use the @* *@ comment syntax").not.toMatch(/@\*/);
  });

  test("never reaches for Font Awesome / wa-icon", () => {
    expect(src.toLowerCase()).not.toMatch(/font-?awesome|wa-icon|fa-/);
  });

  test("no inline <script> and no inline on* event handlers", () => {
    expect(src).not.toMatch(/<script/i);
    const inlineHandlers = src.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });

  test("no em-dashes (Francesco universal preference)", () => {
    expect(src).not.toContain("—");
  });

  test("styling is token-driven (no bare hex colours, no raw px spacing)", () => {
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    const stripped = src
      .replace(/\[[^\]]*\]/g, "[]")
      .replace(/-\d+\/\d+/g, "")
      .replace(/\bmin-w-0\b/g, "")
      .replace(/\bmd:grid-cols-2\b/g, "")
      .replace(/\bmax-w-4xl\b/g, "")
      .replace(/\bmax-w-sm\b/g, "");
    const numericUtils = (stripped.match(/\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mb|mt|gap|h|w|text|size|space)-[1-9]/g) ?? [])
      .filter((u) => !HARDCODE_EXCEPTIONS.test(u));
    expect(numericUtils, `non-token numeric utilities: ${numericUtils.join(", ")}`).toEqual([]);
  });
});

describe("login block -- the @param API", () => {
  test("declares the documented params", () => {
    for (const p of [
      "String action",
      "gg.jte.Content csrf",
      "String title",
      "String description",
      "String emailName",
      "String passwordName",
      "String error",
      "String forgotUrl",
      "String signupUrl",
      "gg.jte.Content social",
      "String variant",
      "String image",
    ]) {
      expect(src, `missing @param ${p}`).toContain(`@param ${p}`);
    }
  });
});

describe("login block -- it is a real posting form", () => {
  test("renders a native <form method=post> with the action param", () => {
    expect(src).toMatch(/<form[^>]*method="post"/);
    expect(src).toContain('action="${action}"');
  });

  test("carries the CSRF hidden-field slot (rendered when provided)", () => {
    expect(src).toContain("@if(csrf != null)");
    expect(src).toContain("${csrf}");
  });

  test("submit is a real submit button", () => {
    expect(src).toMatch(/type="submit"/);
    expect(src).toContain("${submitLabel}");
  });
});

describe("login block -- composes existing partials, never rebuilds primitives", () => {
  test("uses the input-group partial for the email + password fields", () => {
    const calls = src.match(/@template\.lievit\.input-group\(/g) ?? [];
    expect(calls.length, "expected two input-group compositions").toBeGreaterThanOrEqual(2);
    expect(src).toContain("name = emailName");
    expect(src).toContain("name = passwordName");
  });

  test("renders all icons through the Lucide partial", () => {
    expect(src).toContain("@template.lievit.icon(name =");
    // the password field uses a lock glyph, the email a mail glyph -- both vendored Lucide.
    expect(src).toContain('@template.lievit.icon(name = "mail")');
    expect(src).toContain('@template.lievit.icon(name = "lock")');
  });

  test("emits NO custom-element <lv-*> tag at all (ADR-0012 server-first, even in the doc)", () => {
    // server-first: the block is native <input>/<button> + the input-group partial. No island
    // tag may remain anywhere, not even spelled in the rationale comment.
    const islandTags = src.match(/<lv-[a-z-]+/gi) ?? [];
    expect(islandTags, `island tags must be gone: ${islandTags.join(", ")}`).toEqual([]);
    expect(markup, "rendered markup must invent no <lv-input> primitive").not.toMatch(/<lv-input/);
  });
});

describe("login block -- accessibility", () => {
  test("is a landmark: <main> wrapper + a labelled <section> region", () => {
    expect(src).toMatch(/<main/);
    expect(src).toContain('role="region"');
    expect(src).toContain('aria-labelledby="${headingId}"');
  });

  test("the title is an <h1> carrying the id the region points at", () => {
    expect(src).toMatch(/<h1 id="\$\{headingId\}"/);
  });

  test("each field is a real <label for> bound to a real input id", () => {
    expect(src).toContain('for="${emailId}"');
    expect(src).toContain("id = emailId");
    expect(src).toContain('for="${passwordId}"');
    expect(src).toContain("id = passwordId");
  });

  test("a form-level error is an alert region + the submit references it via aria-describedby", () => {
    expect(src).toContain('role="alert"');
    expect(src).toContain("aria-live");
    expect(src).toContain('aria-describedby="${describedBy}"');
  });

  test("the split-variant image panel is decorative (aria-hidden + empty alt)", () => {
    expect(src).toContain('aria-hidden="true"');
    expect(src).toMatch(/alt=""/);
  });

  test("focus is visible via the ring token on interactive controls", () => {
    expect(src).toContain("focus-visible:shadow-[var(--lv-ring)]");
  });
});

describe("login block -- variants are options, not copies", () => {
  test("a single variant param folds card / plain / split", () => {
    expect(src).toContain("@param String variant");
    expect(src).toContain('variant.equals("split")');
    expect(src).toContain('variant.equals("plain")');
  });

  test("the split layout is a two-column grid gated by the variant", () => {
    expect(src).toContain("md:grid-cols-2");
    expect(src).toContain("@if(split)");
  });

  test("an optional social slot brings a separator only when present", () => {
    expect(src).toContain("@if(social != null)");
    expect(src).toContain("${social}");
  });
});
