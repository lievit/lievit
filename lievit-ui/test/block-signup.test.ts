/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * SIGNUP block (#459) -- the registration composition (registry/jte/blocks/signup.jte).
 * Like the static-partials suites, this is a structural golden over the partial SOURCE as
 * text (a render/golden in the Java runtime is out of scope for the JS suite): it pins the
 * server-rendered form contract (real <form method="post"> + action + CSRF slot), the
 * composed-from-existing-components shape (input-group fields, Lucide icon partial), the
 * labelled + error-wired a11y, and the token-only styling. It is the equivalent structural
 * golden the planning DONE criteria asks for.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(
  join(import.meta.dirname, "..", "registry", "jte", "blocks", "signup.jte"),
  "utf8"
);

/**
 * The rendered markup only: the `@* ... *@` doc/usage comment is stripped, so prose that
 * legitimately names the issue (#459) or the islands it deliberately does NOT use (<lv-input>)
 * is not mistaken for leaked hex colours or posting controls. Body-shape assertions use this.
 */
const body = src.replace(/@\*[\s\S]*?\*@/g, "");

describe("signup block (#459) -- shared hygiene", () => {
  test("ships a usage-doc comment with the @param API + a @template call snippet", () => {
    expect(src, "missing jte comment block").toContain("@*");
    expect(src, "missing Usage section").toMatch(/Usage/);
    expect(src, "usage snippet must show the @template.blocks.signup call").toContain(
      "@template.blocks.signup("
    );
    expect(src, "missing param declaration").toMatch(/@param /);
  });

  test("uses JTE comment syntax, never block C-style comments", () => {
    expect(src).toContain("@*");
    expect(src).toContain("*@");
  });

  test("never reaches for Font Awesome / wa-icon", () => {
    expect(src.toLowerCase()).not.toMatch(/font-?awesome|wa-icon|fa-/);
  });

  test("no inline <script> and no inline on* handlers", () => {
    expect(src).not.toMatch(/<script/i);
    const inlineHandlers = body.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });

  test("styling is token-driven (no bare hex colours, no raw px spacing-scale utilities)", () => {
    expect(body, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // Strip arbitrary-value brackets (px-[var(--lv-space-3)], size-[var(--lv-space-4)]...) and
    // fractions (top-1/2) so their inner token names + fractions are not mistaken for scale
    // utilities. grid-cols-N / col-span-N are layout COUNTS (not a spacing scale), allowed.
    const stripped = body
      .replace(/\[[^\]]*\]/g, "[]")
      .replace(/-\d+\/\d+/g, "")
      .replace(/\bgrid-cols-\d+\b/g, "")
      .replace(/\bmax-w-\d+xl\b/g, "") // named container widths (max-w-3xl), not a spacing scale
      .replace(/\bmin-w-0\b/g, "");
    const numericUtils =
      stripped.match(/\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mb|mt|gap|h|w|text|size|space)-[1-9]/g) ?? [];
    expect(numericUtils, `non-token numeric utilities: ${numericUtils.join(", ")}`).toEqual([]);
  });
});

describe("signup block -- server-rendered form contract", () => {
  test("a real POST form to the action param, no SPA", () => {
    expect(src).toContain("@param String action");
    expect(src).toMatch(/<form\b/);
    expect(src).toContain('method="post"');
    expect(src).toContain('action="${action}"');
  });

  test("exposes a CSRF slot rendered inside the form", () => {
    expect(src).toContain("@param gg.jte.Content csrf");
    expect(src).toContain("${csrf}");
  });

  test("every credential is a native named input so the browser posts it", () => {
    expect(src).toMatch(/<input\b/);
    expect(src).toContain('name="${fName}"');
    // the islands carry no name and must not be the posting controls in the rendered markup
    expect(body).not.toContain("<lv-input");
  });

  test("the submit is a native submit button (not a wire-bound island)", () => {
    expect(src).toMatch(/<button[^>]*type="submit"/);
    expect(src).toContain('data-slot="signup-submit"');
  });
});

describe("signup block -- composes the existing components", () => {
  test("renders the field icons through the Lucide icon partial", () => {
    expect(src).toContain("@template.icon(");
    // the documented credential icons
    for (const icon of ['"user"', '"mail"', '"lock"']) {
      expect(src, `missing icon ${icon}`).toContain(icon);
    }
  });

  test("reuses the input-group shape (role=group + the focus-within ring) for fields", () => {
    expect(src).toContain('data-slot="input-group"');
    expect(src).toContain('data-slot="input-group-control"');
    expect(src).toContain("focus-within:border-[var(--lv-color-ring)]");
    expect(src).toContain("focus-within:shadow-[var(--lv-ring)]");
    expect(src).toMatch(/border-0/);
  });

  test("declares the documented param API", () => {
    for (const p of [
      "String action",
      "String variant",
      "String image",
      "boolean confirmPassword",
      "boolean terms",
      "gg.jte.Content csrf",
      "gg.jte.Content social",
      "java.util.Map<String, String> errors",
      "String signInHref",
    ]) {
      expect(src, `missing @param ${p}`).toContain(`@param ${p}`);
    }
  });

  test("offers card + split variants with an optional side image", () => {
    expect(src).toContain('"split".equals(variant)');
    expect(src).toContain("md:grid-cols-2");
    expect(src).toContain("${image}");
  });
});

describe("signup block -- accessibility", () => {
  test("the block is one labelled region (section aria-labelledby the heading)", () => {
    expect(src).toMatch(/<section\b/);
    expect(src).toContain('aria-labelledby="${titleId}"');
    expect(src).toMatch(/<h1\b[^>]*id="\$\{titleId\}"/);
  });

  test("every field has a real <label for> bound to the input id", () => {
    expect(src).toContain('<label for="${fName}"');
    expect(src).toContain('id="${fName}"');
  });

  test("errors are announced (role=alert) and wire aria-invalid + aria-describedby", () => {
    expect(src).toContain('role="alert"');
    expect(src).toContain('aria-invalid="${hasErr ? "true" : "false"}"');
    expect(src).toMatch(/aria-describedby=/);
  });

  test("the password requirement is a persistent described-by note, not just placeholder", () => {
    expect(src).toContain("Must be at least 8 characters long.");
    expect(src).toContain("pwHelpId");
  });

  test("a labelled, required terms-acceptance checkbox that posts", () => {
    expect(src).toMatch(/<input\b[^>]*type="checkbox"/);
    expect(src).toContain('name="terms"');
    expect(src).toMatch(/type="checkbox"[\s\S]*?required/);
  });

  test("the decorative split image is hidden from AT and has an empty alt", () => {
    expect(src).toContain('data-slot="signup-aside"');
    expect(src).toContain('aria-hidden="true"');
    expect(src).toMatch(/<img[^>]*alt=""/);
  });

  test('offers the "already have an account? sign in" footer link', () => {
    expect(src.toLowerCase()).toContain("already have an account");
    expect(src).toContain('href="${signInHref}"');
  });
});
