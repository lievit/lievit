/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Render-asserting checks for the server-first wizard partial family: a multi-step form (the
 * Filament Wizard / Wizard\Step, the io.lievit.kit.schema.Wizard + io.lievit.kit.WizardAction
 * view-models). wizard.jte (the numbered step header over the current step's content + footer) +
 * wizard/step.jte (one numbered step with a completed-check + a trailing separator) +
 * wizard/footer.jte (prev / cancel / next / submit). The cursor is server-owned; advancing is a
 * real wire-action POST, so the chrome ships with ZERO JS.
 *
 * Like the other static-partial suites, this Node harness has no JTE compiler, so the load-bearing
 * contract is pinned on the partial SOURCE as text: the data-slot taxonomy, the per-step
 * data-state complete/current/upcoming with the completed-check vs number, the separators between
 * steps, the footer action set (prev off the first step, submit on the last), the wire-action
 * affordances, the aria contract (ol + aria-current=step), token-only styling, the Apache header +
 * JTE comment syntax, and NO inline <script> / on* handler / Lit island. The real-compiler golden
 * runs out of band via `npm run test:jte-compile`.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (rel: string) => readFileSync(join(jteDir, rel), "utf8");

const FAMILY = ["wizard.jte", "wizard/step.jte", "wizard/footer.jte"] as const;

describe("wizard family -- shared hygiene", () => {
  test.each(FAMILY)("%s carries the Apache header + a usage-doc comment (<%-- --%>), no @* *@", (f) => {
    const src = read(f);
    expect(src, "missing Apache copyright header").toContain("Copyright 2026 Francesco Bilotta");
    expect(src, "missing Apache license line").toContain("Apache License, Version 2.0");
    expect(src, "missing <%-- --%> jte comment block").toContain("<%--");
    expect(src, "comment block must close").toContain("--%>");
    expect(src, "must NOT use the @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src, "missing Usage section").toMatch(/Usage:/);
    expect(src, "missing param declaration").toMatch(/@param /);
  });

  test.each(FAMILY)("%s has no inline <script> and ZERO inline on* handlers (strict CSP)", (f) => {
    const src = read(f);
    expect(src).not.toMatch(/<script/i);
    const inlineHandlers = src.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });

  test.each(FAMILY)("%s is server-first: no Lit island residue", (f) => {
    const src = read(f);
    expect(src.toLowerCase()).not.toMatch(/customelement|litelement|adoptlightstyles|import .*\blit\b/);
  });

  test.each(FAMILY)("%s never reaches for Font Awesome / wa-icon", (f) => {
    const src = read(f);
    expect(src.toLowerCase()).not.toMatch(/font-?awesome|wa-icon|fa-/);
  });

  test.each(FAMILY)("%s is token-driven: no bare hex colours", (f) => {
    const src = read(f);
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src, "must read --lv-* tokens").toMatch(/var\(--lv-/);
  });
});

describe("wizard.jte -- the step header over the content + footer", () => {
  const src = read("wizard.jte");

  test("declares its public API: id, currentStep, steps, content, footer", () => {
    for (const p of ["id", "currentStep", "steps", "content", "footer", "label"]) {
      expect(src, `missing @param ${p}`).toMatch(new RegExp(`@param[^\\n]*\\b${p}\\b`));
    }
  });

  test("carries the slot taxonomy: wizard / steps / content / footer", () => {
    for (const slot of ["wizard", "wizard-steps", "wizard-content", "wizard-footer"]) {
      expect(src, `missing data-slot="${slot}"`).toContain(`data-slot="${slot}"`);
    }
  });

  test("the step header is a labelled ordered list (numbered, the natural stepper)", () => {
    expect(src, "steps must be an <ol> (ordered numbering)").toMatch(/<ol[^>]*data-slot="wizard-steps"/);
    expect(src, "the step list must be labelled").toMatch(/wizard-steps"[\s\S]*?aria-label="\$\{label\}"/);
  });

  test("renders the steps + content slots and exposes currentStep to styling", () => {
    expect(src, "must render the steps slot").toMatch(/\$\{steps\}/);
    expect(src, "must render the content slot").toMatch(/\$\{content\}/);
    expect(src, "must surface the cursor for styling").toMatch(/data-current-step="\$\{currentStep\}"/);
  });

  test("the footer is optional and renders the nav when supplied", () => {
    expect(src, "footer is optional").toMatch(/@param gg.jte.Content footer = null/);
    expect(src, "footer renders only when supplied").toMatch(/@if\(footer != null\)/);
    expect(src, "must render the footer slot").toMatch(/\$\{footer\}/);
  });
});

describe("wizard/step.jte -- one numbered step with completed-check + separator", () => {
  const src = read("wizard/step.jte");

  test("declares the step API: index, label, description, state, last, href", () => {
    for (const p of ["index", "label", "description", "state", "last", "href"]) {
      expect(src, `missing @param ${p}`).toMatch(new RegExp(`@param[^\\n]*\\b${p}\\b`));
    }
  });

  test("carries the slot taxonomy: step / marker / label / description", () => {
    for (const slot of ["wizard-step", "wizard-step-marker", "wizard-step-label"]) {
      expect(src, `missing data-slot="${slot}"`).toContain(`data-slot="${slot}"`);
    }
  });

  test("the step state is the shadcn data-state complete | current | upcoming", () => {
    expect(src, "step must carry data-state").toMatch(/data-state="\$\{state\}"/);
    expect(src, "must distinguish complete").toMatch(/var complete = "complete".equals\(state\)/);
    expect(src, "must distinguish current").toMatch(/var current = "current".equals\(state\)/);
  });

  test("a complete step shows the completed-check, otherwise the 1-based number", () => {
    expect(src, "must branch the marker on complete").toMatch(/@if\(complete\)@template\.lievit\.icon\(name = "check"/);
    expect(src, "non-complete marker shows the number (index + 1)").toMatch(/var number = index \+ 1/);
    expect(src, "else branch renders the number").toMatch(/@else\$\{number\}@endif/);
  });

  test("a current step is announced via aria-current=step; the marker is decorative", () => {
    expect(src, "current step carries aria-current").toMatch(/aria-current="\$\{current \? "step" : null\}"/);
    expect(src, "the step states its number + label + state for SR").toMatch(/aria-label="Step \$\{number\}: \$\{label\}, \$\{stateWord\}"/);
    expect(src, "the marker glyph is aria-hidden decoration").toMatch(/wizard-step-marker"[\s\S]*?aria-hidden="true"/);
  });

  test("a separator trails every step except the last", () => {
    expect(src, "separator is gated on !last").toMatch(/@if\(!last\)/);
    expect(src, "separator reuses the lievit-ui separator partial").toMatch(/@template\.lievit\.separator\(\)/);
  });
});

describe("wizard/footer.jte -- prev / cancel / next / submit nav", () => {
  const src = read("wizard/footer.jte");

  test("declares the footer API: showPrevious, showCancel, showSubmit, nextDisabled + the actions", () => {
    for (const p of ["showPrevious", "showCancel", "showSubmit", "nextDisabled", "previousAction", "nextAction", "submitAction"]) {
      expect(src, `missing @param ${p}`).toMatch(new RegExp(`@param[^\\n]*\\b${p}\\b`));
    }
  });

  test("carries the action slots: previous / cancel / next / submit", () => {
    for (const slot of ["wizard-footer-nav", "wizard-previous", "wizard-cancel", "wizard-next", "wizard-submit"]) {
      expect(src, `missing data-slot="${slot}"`).toContain(`data-slot="${slot}"`);
    }
  });

  test("PREVIOUS shows off the first step, SUBMIT replaces NEXT on the last step", () => {
    expect(src, "previous gated on showPrevious").toMatch(/@if\(showPrevious\)/);
    expect(src, "submit-vs-next switch").toMatch(/@if\(showSubmit\)[\s\S]*?wizard-submit[\s\S]*?@else[\s\S]*?wizard-next/);
  });

  test("each nav button drives a wire action via formaction (server-first), never inline JS", () => {
    expect(src, "previous posts via formaction").toMatch(/formaction="\$\{previousAction.isEmpty\(\)/);
    expect(src, "next posts via formaction").toMatch(/formaction="\$\{nextAction.isEmpty\(\)/);
    expect(src, "submit posts via formaction").toMatch(/formaction="\$\{submitAction.isEmpty\(\)/);
  });

  test("NEXT can be disabled when the current step is incomplete", () => {
    expect(src, "next carries a disabled affordance").toMatch(/disabled="\$\{nextDisabled\}"/);
    expect(src, "and the matching aria-disabled").toMatch(/aria-disabled="\$\{nextDisabled \? "true" : null\}"/);
  });

  test("nav buttons carry text labels + directional chevrons (never icon-only)", () => {
    expect(src, "previous has a left chevron + label").toMatch(/icon\(name = "chevron-left"[\s\S]*?\$\{previousLabel\}/);
    expect(src, "next has a label + right chevron").toMatch(/\$\{nextLabel\}[\s\S]*?icon\(name = "chevron-right"/);
    expect(src, "submit has a text label").toMatch(/\$\{submitLabel\}/);
  });
});
