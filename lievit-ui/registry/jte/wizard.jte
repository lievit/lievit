@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui wizard partial -- a multi-step form (the Filament Wizard / Wizard\Step, the
  io.lievit.kit.schema.Wizard + io.lievit.kit.WizardAction view-models): a numbered STEP HEADER
  (each step a wizard/step item with a number / completed-check, label, and a separator between
  steps) over the current step's CONTENT, with a FOOTER of prev / cancel / next / submit
  actions. Server-first PARTIAL (ADR-0012), ZERO shipped JS.

  TIER DECISION (why PARTIAL, not WIRE): the wizard's CURSOR (which step is current, which are
  complete) is server-owned data the Wizard driver already tracks (currentStep()); the partial
  renders the header + the current step's body + the footer for THAT cursor. Advancing
  (next / previous / submit) is a real wire-action POST the adopter wires on the footer buttons
  (an l:click or a form submit) -- the kit's WizardActionComponent drives next()/previous() and
  calls submit() on the last step. This partial is the pure VIEW of one cursor position; the
  host owns the state machine. (The kit's wizard-action.jte WIRE template composes THIS partial's
  chrome with l:click hooks; the registry ships the presentational primitive.)

  STRUCTURE (scientific decision rule): the Filament wizard header is a numbered stepper --
  Radix/shadcn has no stepper, so this mirrors Filament's bespoke chrome with the shadcn
  data-state idiom. Each step carries data-state="complete" | "current" | "upcoming"; a complete
  step shows a check glyph instead of its number, a current step is filled, an upcoming step is
  muted. Steps are an <ol> (ordered, the natural numbering); a separator (the lievit-ui
  separator) sits between consecutive steps. The body is the `content` slot (the current step's
  fields); the footer is the `footer` slot (wizard/footer with the nav buttons). The
  currentStep index drives which step is `current` and which earlier steps are `complete`.

  A11y (WAI-ARIA): the header is an <ol> labelled "Progress"; the current step carries
  aria-current="step" so assistive tech announces the position; each step states its number +
  label as text (never the visual number alone); a complete step's check is aria-hidden (the
  "complete" state is conveyed by aria-label on the step). The body region is labelled by the
  current step's label.

  Params:
    String         id = "lv-wizard"        the wizard root id (labels the body region). Unique/page.
    int            currentStep = 0          the 0-based current step index (drives complete/current).
    gg.jte.Content steps                    the step header items (wizard/step list, in order).
    gg.jte.Content content                  the current step's body (fields).
    gg.jte.Content footer = null            the nav footer (wizard/footer: prev / cancel / next / submit).
    String         label = "Progress"       the step header's accessible name.
    String         cssClass = ""            extra utility classes on the wizard root.

  Usage:
    @@template.lievit.wizard(
      currentStep = wizard.currentStep(),
      steps = @@`
        @@for(int i = 0; i < wizard.steps().size(); i++)
          @@template.lievit.wizard.step(
            index = i,
            label = wizard.steps().get(i).label(),
            state = i < wizard.currentStep() ? "complete" : (i == wizard.currentStep() ? "current" : "upcoming"),
            last = i == wizard.steps().size() - 1)
        @@endfor
      `,
      content = @@`<input type="text" name="subject">`,
      footer = @@`@@template.lievit.wizard.footer(
        showPrevious = wizard.currentStep() > 0,
        showSubmit = wizard.currentStep() == wizard.stepCount() - 1)`)
--%>
@param String id = "lv-wizard"
@param int currentStep = 0
@param gg.jte.Content steps
@param gg.jte.Content content
@param gg.jte.Content footer = null
@param String label = "Progress"
@param String cssClass = ""
!{var bodyLabelId = id + "-current-label";}

<div data-slot="wizard" id="${id}" data-current-step="${currentStep}" class="flex flex-col gap-[var(--lv-space-6)] ${cssClass}" style="font-family:var(--lv-font-sans);">
  <ol data-slot="wizard-steps" aria-label="${label}" class="flex items-center gap-[var(--lv-space-2)]">
    ${steps}
  </ol>
  <div data-slot="wizard-content" role="group" aria-labelledby="${bodyLabelId}" class="text-[length:var(--lv-text-base)] text-[var(--lv-color-fg)]">
    ${content}
  </div>
  @if(footer != null)
    <div data-slot="wizard-footer" class="flex items-center justify-between gap-[var(--lv-space-2)] border-t border-[var(--lv-color-border)] pt-[var(--lv-space-4)]">
      ${footer}
    </div>
  @endif
</div>
