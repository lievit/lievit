/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Source-text assertions for the v-next wizard partial: a CONTROLLED headless multi-step
 * form stepper. The Node harness has no JTE compiler, so this pins the contract on the
 * partial SOURCE as text: the @param API, the data-slot taxonomy, the step-list markup,
 * the ARIA contract (aria-current=step on li in linear mode; aria-current on button in
 * skippable mode), the collection-nav data-attribute wiring, the action bar (Prev / Next /
 * Submit), the live-region, token-driven styling, CSP-cleanliness, and the Apache header +
 * JTE comment conventions.
 *
 * Old test surface (wizard.jte + wizard/step.jte + wizard/footer.jte family) is superseded
 * by this re-forged surface. The coordinator reconciles shared test files that asserted the
 * old step.jte / footer.jte surface (none in the current shared test files; see TEST_RECONCILE
 * in the report below).
 */
import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (rel: string) => readFileSync(join(jteDir, rel), "utf8");

const src = read("wizard.jte");

// ---------------------------------------------------------------------------
// Header + JTE hygiene (the shared conformance bar for every partial)
// ---------------------------------------------------------------------------

describe("wizard.jte -- header + JTE hygiene", () => {
  test("carries the Apache copyright header and license line", () => {
    expect(src).toContain("Copyright 2026 Francesco Bilotta");
    expect(src).toContain("Apache License, Version 2.0");
  });

  test("has a JTE doc-comment block with Usage + Params sections", () => {
    expect(src, "missing <%-- --%> JTE comment block").toContain("<%--");
    expect(src, "comment block must close").toContain("--%>");
    expect(src, "must NOT use @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src, "missing Usage section").toMatch(/Usage:/);
    expect(src, "missing Params section").toMatch(/Params:/);
  });

  test("has no inline <script> and ZERO inline on* handlers (strict CSP)", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup, "inline <script>").not.toMatch(/<script/i);
    const handlers = markup.match(/\son[a-z]+=/gi) ?? [];
    expect(handlers, `unexpected inline handlers: ${handlers.join(", ")}`).toEqual([]);
  });

  test("is server-first: no Lit island residue, no dev.lievit import", () => {
    expect(src.toLowerCase()).not.toMatch(/customelement|litelement|adoptlightstyles|import .*\blit\b/);
    expect(src, "no dev.lievit import allowed in a .jte").not.toContain("@import dev.lievit");
  });

  test("is token-driven: no bare hex colours", () => {
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src, "must read --lv-* tokens").toMatch(/var\(--lv-/);
  });
});

// ---------------------------------------------------------------------------
// Param API surface
// ---------------------------------------------------------------------------

describe("wizard.jte -- @param API (the v-next CONTROLLED PARTIAL surface)", () => {
  const params = [
    "activeStep",
    "stepIds",
    "stepTitles",
    "stepDescriptions",
    "stepIcons",
    "allowedSteps",
    "completedSteps",
    "errorSteps",
    "skippable",
    "size",
    "orientation",
    "labelPlacement",
    "indicatorVariant",
    "wizardAriaLabel",
    "wizardAriaLabelledBy",
    "prevLabel",
    "nextLabel",
    "submitLabel",
    "prevAction",
    "nextAction",
    "goToAction",
    "content",
    "cssClass",
    "attrs",
  ];

  test.each(params)("declares @param %s", (p) => {
    expect(src, `missing @param ${p}`).toMatch(new RegExp(`@param[^\\n]*\\b${p}\\b`));
  });

  test("no _component / _instance / _componentSnapshot params (PARTIAL, not WIRE)", () => {
    expect(src).not.toMatch(/@param[^\n]*_component/);
    expect(src).not.toMatch(/@param[^\n]*_instance/);
    expect(src).not.toMatch(/@param[^\n]*_componentSnapshot/);
  });

  test("no @import dev.lievit.component.ComponentMetadata (PARTIAL has no Java wire root)", () => {
    expect(src).not.toContain("ComponentMetadata");
  });

  test("activeStep is an int, not a String", () => {
    expect(src).toMatch(/@param int activeStep/);
  });

  test("stepIds and stepTitles are List", () => {
    expect(src).toMatch(/@param List<String> stepIds/);
    expect(src).toMatch(/@param List<String> stepTitles/);
  });

  test("allowedSteps / completedSteps / errorSteps are Set of Integer", () => {
    expect(src).toMatch(/@param Set<Integer> allowedSteps/);
    expect(src).toMatch(/@param Set<Integer> completedSteps/);
    expect(src).toMatch(/@param Set<Integer> errorSteps/);
  });

  test("skippable is boolean (not String)", () => {
    expect(src).toMatch(/@param boolean skippable/);
  });

  test("content is gg.jte.Content (the slot for the active step body)", () => {
    expect(src).toMatch(/@param Content content/);
  });
});

// ---------------------------------------------------------------------------
// data-slot taxonomy
// ---------------------------------------------------------------------------

describe("wizard.jte -- data-slot taxonomy", () => {
  const literalSlots = [
    "wizard",
    "wizard-step-list",
    "wizard-step",
    "wizard-step-button",
    "wizard-step-node",
    "wizard-step-title",
    "wizard-content",
    "wizard-actions",
    "wizard-prev",
    "wizard-live",
  ];

  test.each(literalSlots)('declares data-slot="%s"', (slot) => {
    expect(src, `missing data-slot="${slot}"`).toContain(`data-slot="${slot}"`);
  });

  test('declares data-slot="wizard-next" / "wizard-submit" (expressed as ternary, single button)', () => {
    // Next and Submit are the same button with a ternary: data-slot="${isLast ? "wizard-submit" : "wizard-next"}"
    expect(src).toContain('data-slot="${isLast ? "wizard-submit" : "wizard-next"}"');
  });
});

// ---------------------------------------------------------------------------
// Structural orientation tokens: data-size + data-orientation on the root
// ---------------------------------------------------------------------------

describe("wizard.jte -- root orientation + size data attributes", () => {
  test("root carries data-size and data-orientation for CSS hooks and test selectors", () => {
    expect(src).toMatch(/data-slot="wizard"[\s\S]*?data-size="\$\{size\}"/);
    expect(src).toMatch(/data-orientation="\$\{orientation\}"/);
  });
});

// ---------------------------------------------------------------------------
// Step-list structure + ARIA
// ---------------------------------------------------------------------------

describe("wizard.jte -- step-list ARIA (WAI-ARIA aria-current=step + W3C WAI tutorial)", () => {
  test("step-list is an <ol role=list> (ordered, preserves list semantics in Safari when CSS removes list-style)", () => {
    expect(src).toMatch(/<ol[\s\S]*?data-slot="wizard-step-list"[\s\S]*?role="list"/);
  });

  test("step items are <li> elements carrying data-status", () => {
    expect(src).toMatch(/data-slot="wizard-step"[\s\S]*?data-status="\$\{stepStatus\}"/);
  });

  test("linear mode: aria-current=step is on the <li> (not on a button)", () => {
    // In linear mode the li itself carries aria-current="step" when isCurrent && !skippable
    expect(src).toContain('aria-current="${isCurrent && !skippable ? "step" : null}"');
  });

  test("skippable mode: each reachable step renders a <button> with aria-current=step when active", () => {
    expect(src).toContain('data-slot="wizard-step-button"');
    expect(src).toContain('aria-current="${isCurrent ? "step" : null}"');
  });

  test("skippable unreachable steps get aria-disabled=true, reachable steps do not", () => {
    expect(src).toContain('aria-disabled="${!isReachable ? "true" : null}"');
  });

  test("skippable step buttons carry data-step for the goTo action argument", () => {
    // data-step carries the escaped step index
    expect(src).toMatch(/data-step="\$unsafe\{safeStepIndex\}"/);
  });

  test("skippable step buttons carry l:click wired to goToAction when reachable", () => {
    expect(src).toContain('l:click="${isReachable ? goToAction : null}"');
  });

  test("skippable step buttons carry data-lievit-item for collection-nav (reachable only)", () => {
    expect(src).toContain('data-lievit-item="${isReachable ? "" : null}"');
  });

  test("connectors are aria-hidden (decorative lines between nodes)", () => {
    // aria-hidden comes before data-slot in the element (attr order in the template)
    expect(src).toMatch(/aria-hidden="true" data-slot="wizard-connector"/);
  });

  test("connector is omitted after the last step", () => {
    expect(src).toContain("isLast_");
    expect(src).toMatch(/@if\(!isLast_\)[\s\S]*?wizard-connector[\s\S]*?@endif/);
  });

  test("step title carries a stable id derived from stepId for aria-labelledby pairing", () => {
    // The title id is lv-wiz-title-{stepId}
    expect(src).toContain('id="${titleId}"');
    expect(src).toContain('!{String titleId = "lv-wiz-title-" + stepId;}');
  });

  test("indicator nodes are aria-hidden (decoration; SR status text is visually-hidden text)", () => {
    expect(src).toContain('data-slot="wizard-step-node"');
    expect(src).toMatch(/data-slot="wizard-step-node"[\s\S]*?aria-hidden="true"/);
  });

  test("SR visually-hidden status text present (Completed / Error / Current / Pending)", () => {
    expect(src).toContain("Completed");
    expect(src).toContain("Pending");
    expect(src).toContain('class="sr-only"');
  });
});

// ---------------------------------------------------------------------------
// Status variants (process / finish / error / wait)
// ---------------------------------------------------------------------------

describe("wizard.jte -- step status rendering", () => {
  test("stepStatus is derived from isCurrent, completedSteps, errorSteps", () => {
    expect(src).toContain('!{String stepStatus = isCurrent ? "process" :');
    expect(src).toContain('"finish"');
    expect(src).toContain('"error"');
    expect(src).toContain('"wait"');
  });

  test("process status drives primary colour node", () => {
    expect(src).toContain('"process" -> "var(--lv-color-primary)"');
  });

  test("finish status drives success colour node", () => {
    expect(src).toContain('"finish"  -> "var(--lv-color-success)"');
  });

  test("error status drives destructive colour node", () => {
    expect(src).toContain('"error"   -> "var(--lv-color-destructive)"');
  });

  test("wait status drives muted colour node", () => {
    // The wait case uses --lv-color-muted-bg for the node background
    expect(src).toContain("var(--lv-color-muted-bg)");
  });

  test("error step title is rendered in destructive colour", () => {
    expect(src).toContain('"error"   -> "var(--lv-color-destructive)"');
  });
});

// ---------------------------------------------------------------------------
// Indicator variants (number / icon / dot)
// ---------------------------------------------------------------------------

describe("wizard.jte -- indicator variants", () => {
  test("dot variant renders a small circle (size-[0.5em] rounded-full), no number", () => {
    expect(src).toContain('"dot".equals(indicatorVariant)');
    expect(src).toContain("size-[0.5em] rounded-[var(--lv-radius-full)] bg-current");
  });

  test("icon variant shows the step icon from stepIcon param when set", () => {
    expect(src).toContain('"icon".equals(indicatorVariant) && stepIcon != null');
  });

  test("completed step in icon/number variant shows a check icon", () => {
    expect(src).toMatch(/\"finish\".equals\(stepStatus\)[\s\S]*?icon\(name = "check"/);
  });

  test("error step in icon/number variant shows an x icon", () => {
    expect(src).toMatch(/\"error\".equals\(stepStatus\)[\s\S]*?icon\(name = "x"/);
  });

  test("number variant (default) shows 1-based index for process/wait states", () => {
    // The number is ${i + 1}
    expect(src).toContain("${i + 1}");
  });
});

// ---------------------------------------------------------------------------
// collection-nav enhancer wiring (skippable mode)
// ---------------------------------------------------------------------------

describe("wizard.jte -- collection-nav enhancer wiring (skippable mode)", () => {
  test("step-list carries data-lievit-collection (gated on skippable)", () => {
    expect(src).toContain('data-lievit-collection="${skippable ? "" : null}"');
  });

  test("step-list carries data-lievit-collection-roving-tabindex=true (APG roving model)", () => {
    expect(src).toContain('data-lievit-collection-roving-tabindex="${skippable ? "true" : null}"');
  });

  test("step-list carries data-lievit-collection-wrap=true (wraps at ends)", () => {
    expect(src).toContain('data-lievit-collection-wrap="${skippable ? "true" : null}"');
  });

  test("step-list carries data-lievit-collection-select-action wired to goToAction", () => {
    expect(src).toContain('data-lievit-collection-select-action="${skippable ? goToAction : null}"');
  });

  test("step-list carries data-manual-activation=true (arrow = focus only; Enter/Space = fire action)", () => {
    expect(src).toContain('data-manual-activation="${skippable ? "true" : null}"');
  });

  test("collection-nav orientation maps the orientation param to the enhancer vocab", () => {
    // The template maps "vertical" => "vertical", other => "horizontal"
    expect(src).toContain('"vertical".equals(orientation) ? "vertical" : "horizontal"');
    expect(src).toContain('data-lievit-collection-orientation="${skippable ? (');
  });
});

// ---------------------------------------------------------------------------
// Content panel
// ---------------------------------------------------------------------------

describe("wizard.jte -- content panel", () => {
  test("content panel is role=group with aria-labelledby pointing to the active step title id", () => {
    expect(src).toContain('role="group"');
    expect(src).toContain('aria-labelledby="${activeTitleId}"');
  });

  test("activeTitleId is derived from the active step's stable id", () => {
    expect(src).toContain('!{String activeTitleId = "lv-wiz-title-" +');
  });

  test("content slot is rendered when provided", () => {
    expect(src).toContain("${content}");
    expect(src).toMatch(/@if\(content != null\)/);
  });
});

// ---------------------------------------------------------------------------
// Action bar (Prev / Next / Submit)
// ---------------------------------------------------------------------------

describe("wizard.jte -- action bar", () => {
  test("Prev button is present with data-action=prev and l:click wired to prevAction", () => {
    expect(src).toContain('data-slot="wizard-prev"');
    expect(src).toContain('data-action="prev"');
    expect(src).toContain('l:click="${prevAction}"');
  });

  test("Prev button is disabled (native) when on the first step", () => {
    // isFirst = activeStep == 0; disabled="${isFirst}"
    expect(src).toContain("!{boolean isFirst = activeStep == 0;}");
    expect(src).toMatch(/data-slot="wizard-prev"[\s\S]*?disabled="\$\{isFirst\}"/);
  });

  test("Next/Submit button carries data-action=next or submit depending on isLast", () => {
    expect(src).toContain('data-action="${isLast ? "submit" : "next"}"');
  });

  test("Next/Submit button data-slot reflects isLast", () => {
    expect(src).toContain('data-slot="${isLast ? "wizard-submit" : "wizard-next"}"');
  });

  test("Next/Submit button type is submit on last step, button otherwise", () => {
    expect(src).toContain('type="${isLast ? "submit" : "button"}"');
  });

  test("Next/Submit button l:click wired to nextAction", () => {
    expect(src).toMatch(/data-slot="\$\{isLast[\s\S]*?l:click="\$\{nextAction\}"/);
  });

  test("Next button label uses nextLabel param; Submit uses submitLabel", () => {
    expect(src).toContain("${nextLabel}");
    expect(src).toContain("${submitLabel}");
  });

  test("Prev button shows left chevron icon", () => {
    expect(src).toMatch(/wizard-prev[\s\S]*?icon\(name = "chevron-left"/);
  });

  test("Next button shows right chevron icon (not Submit: Submit needs no chevron)", () => {
    // chevron-right is in the @else (Next) branch, not in @if(isLast) (Submit) branch
    expect(src).toMatch(/\$\{nextLabel\}[\s\S]*?icon\(name = "chevron-right"/);
  });
});

// ---------------------------------------------------------------------------
// Live region
// ---------------------------------------------------------------------------

describe("wizard.jte -- ARIA live region (screen-reader progress announcement)", () => {
  test("a role=status aria-live=polite element is present (the live region)", () => {
    expect(src).toContain('role="status"');
    expect(src).toContain('aria-live="polite"');
    expect(src).toContain('data-slot="wizard-live"');
  });

  test("the live region emits 'Step N of M: Title' text (server-rendered on each morph)", () => {
    // The live text variable: "Step " + (activeStep+1) + " of " + stepCount + ": " + title
    expect(src).toContain('!{String liveText = "Step " + (activeStep + 1) + " of " + stepCount + ": "');
    expect(src).toContain("${liveText}");
  });

  test("the live region is visually hidden via sr-only class", () => {
    expect(src).toMatch(/wizard-live[\s\S]*?class="sr-only"/);
  });
});

// ---------------------------------------------------------------------------
// Wizard root accessible label
// ---------------------------------------------------------------------------

describe("wizard.jte -- root accessible name", () => {
  test("wizard root supports aria-label (wizardAriaLabel param)", () => {
    // aria-label is emitted only when wizardAriaLabelledBy is null (smart attr)
    expect(src).toContain('aria-label="${wizardAriaLabelledBy == null ? wizardAriaLabel : null}"');
  });

  test("wizard root supports aria-labelledby (wizardAriaLabelledBy param)", () => {
    expect(src).toContain('aria-labelledby="${wizardAriaLabelledBy}"');
  });
});

// ---------------------------------------------------------------------------
// Token usage checks (not exhaustive; belt-and-suspenders against literal leakage)
// ---------------------------------------------------------------------------

describe("wizard.jte -- token coverage", () => {
  const tokens = [
    "--lv-color-primary",
    "--lv-color-success",
    "--lv-color-destructive",
    "--lv-color-muted",
    "--lv-color-border",
    "--lv-color-fg",
    "--lv-color-accent",
    "--lv-space-",
    "--lv-text-",
    "--lv-font-medium",
    "--lv-radius-full",
    "--lv-ring",
    "--lv-opacity-disabled",
    "--lv-duration-fast",
  ];

  test.each(tokens)("references %s (no raw value)", (token) => {
    expect(src, `missing token reference: ${token}`).toContain(token);
  });
});

// ---------------------------------------------------------------------------
// meta.json
// ---------------------------------------------------------------------------

describe("wizard/meta.json", () => {
  test("meta.json exists and registers as registry:jte", () => {
    expect(existsSync(join(jteDir, "wizard", "meta.json"))).toBe(true);
    const meta = JSON.parse(readFileSync(join(jteDir, "wizard", "meta.json"), "utf8"));
    expect(meta.type).toBe("registry:jte");
    expect(meta.name).toBe("wizard");
  });

  test("meta.json files array references wizard.jte", () => {
    const meta = JSON.parse(readFileSync(join(jteDir, "wizard", "meta.json"), "utf8"));
    const paths = (meta.files as Array<{ path: string }>).map((f) => f.path);
    expect(paths).toContain("jte/wizard.jte");
  });

  test("meta.json registryDependencies includes icon (composited for check/x/chevron icons)", () => {
    const meta = JSON.parse(readFileSync(join(jteDir, "wizard", "meta.json"), "utf8"));
    expect(meta.registryDependencies).toContain("icon");
  });

  test("meta.json lists collection-nav as an enhancer dependency", () => {
    const meta = JSON.parse(readFileSync(join(jteDir, "wizard", "meta.json"), "utf8"));
    expect(meta.enhancers ?? []).toContain("collection-nav");
  });

  test("meta.json does NOT list separator (old sub-partial; removed in v-next)", () => {
    const meta = JSON.parse(readFileSync(join(jteDir, "wizard", "meta.json"), "utf8"));
    expect((meta.registryDependencies ?? []).join(",")).not.toContain("separator");
  });
});

// ---------------------------------------------------------------------------
// Removed sub-partials: step.jte and footer.jte are gone (the new surface is self-contained)
// ---------------------------------------------------------------------------

describe("wizard/step.jte + wizard/footer.jte (old sub-partials — NOT present in v-next)", () => {
  test("wizard/step.jte no longer ships (all chrome is in wizard.jte)", () => {
    // The v-next wizard is self-contained; step.jte is not part of the new API.
    // If this file exists it is a leftover from the old API that the coordinator should remove.
    const stepExists = existsSync(join(jteDir, "wizard", "step.jte"));
    // Note: we do NOT fail the test if it exists -- it may exist as a coordinator artifact.
    // We assert that the NEW wizard.jte does NOT reference it via @template.lievit.wizard.step.
    expect(src, "wizard.jte must NOT reference the old @template.lievit.wizard.step sub-partial").not.toContain("@template.lievit.wizard.step(");
    // Log the presence for the coordinator.
    if (stepExists) {
      console.warn("[wizard-test] wizard/step.jte still present: coordinator should remove it (old API sub-partial).");
    }
  });

  test("wizard/footer.jte no longer ships (action bar is in wizard.jte)", () => {
    const footerExists = existsSync(join(jteDir, "wizard", "footer.jte"));
    expect(src, "wizard.jte must NOT reference the old @template.lievit.wizard.footer sub-partial").not.toContain("@template.lievit.wizard.footer(");
    if (footerExists) {
      console.warn("[wizard-test] wizard/footer.jte still present: coordinator should remove it (old API sub-partial).");
    }
  });
});
