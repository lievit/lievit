<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui wizard/step partial -- one item of the wizard step header (the Filament Wizard\Step
  in the progress strip, an io.lievit.kit.schema.Wizard.Step): a numbered marker (or a
  completed-check when done), the step label + optional description, and a separator trailing
  it (except after the last step). Server-first, no JS.

  TIER: STATIC presentational -> JTE partial. The state (complete / current / upcoming) is
  server-owned data the Wizard driver computes from currentStep(); the server renders the marker
  keyed on it. When the step is already passed and the wizard allows jumping back (goToStep), the
  caller can pass a `href` so the step marker is a real <a> the browser navigates -- otherwise an
  inert <li>.

  STRUCTURE (data-state, shadcn idiom): the step carries data-state="complete" | "current" |
  "upcoming". A COMPLETE step's marker shows a "check" glyph (the completed-check) on a primary
  fill; a CURRENT step's marker shows its 1-based number on a primary fill + a ring; an UPCOMING
  step's marker shows its number muted with a border. The label tints with the state (fg for
  current/complete, muted for upcoming). The trailing separator (the lievit-ui separator) is a
  flex-growing hairline between this step and the next; the LAST step (`last=true`) renders no
  separator.

  A11y (WAI-ARIA): the step is an <li> stating "Step N: <label>" + its state as an aria-label so
  the number / completed status is announced, not only seen; the current step adds
  aria-current="step"; the marker glyph (check or number) is aria-hidden decoration (the label
  carries the meaning). The separator is aria-hidden (decorative).

  Params:
    int     index        = 0          the 0-based step index (the marker shows index + 1).
    String  label                     the step label.
    String  description  = ""         an optional muted line under the label.
    String  state        = "upcoming" "complete" | "current" | "upcoming".
    boolean last         = false      the last step => no trailing separator.
    String  href         = ""         non-blank => the marker+label are a real <a> (jump back).
    String  cssClass     = ""         extra utility classes on the step.

  Usage:
    @@template.lievit.wizard.step(index = 0, label = "Details", state = "complete")
    @@template.lievit.wizard.step(index = 1, label = "Review", state = "current", last = true)
--%>
@param int index = 0
@param String label
@param String description = ""
@param String state = "upcoming"
@param boolean last = false
@param String href = ""
@param String cssClass = ""
!{var complete = "complete".equals(state);}
!{var current = "current".equals(state);}
!{var number = index + 1;}
!{var stateWord = complete ? "completed" : (current ? "current" : "upcoming");}
!{var markerBg = (complete || current) ? "var(--lv-color-primary)" : "transparent";}
!{var markerFg = (complete || current) ? "var(--lv-color-primary-fg)" : "var(--lv-color-muted-fg)";}
!{var markerBorder = (complete || current) ? "transparent" : "var(--lv-color-border)";}
!{var markerRing = current ? "box-shadow: var(--lv-ring);" : "";}
!{var labelColor = (complete || current) ? "var(--lv-color-fg)" : "var(--lv-color-muted-fg)";}
!{var markerStyle = "width: 1.75rem; height: 1.75rem; border-radius: 9999px; background: " + markerBg + "; color: " + markerFg + "; border: 1px solid " + markerBorder + "; " + markerRing;}
!{var isLink = !href.isEmpty();}

<li
  data-slot="wizard-step"
  data-state="${state}"
  data-step-index="${index}"
  aria-current="${current ? "step" : null}"
  aria-label="Step ${number}: ${label}, ${stateWord}"
  class="flex items-center gap-[var(--lv-space-2)] ${last ? "" : "flex-1"} ${cssClass}"
>
  <%-- One tag (never a conditional <a>/<span> split: JTE's static checker pushes both opens). An
       <a> with a null href drops the attribute and renders as inert text, so the non-link step is a
       plain anchor with no link semantics. --%>
  <a href="${isLink ? href : null}" data-slot="wizard-step-link" class="flex items-center gap-[var(--lv-space-2)]${isLink ? " focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]" : ""}" style="${isLink ? "text-decoration: none; color: inherit; border-radius: var(--lv-radius-md);" : ""}">
    <span data-slot="wizard-step-marker" aria-hidden="true" class="inline-flex shrink-0 items-center justify-center text-[length:var(--lv-text-sm)] font-[var(--lv-font-semibold)]" style="${markerStyle}">@if(complete)@template.lievit.icon(name = "check", size = "1rem")@else${number}@endif</span>
    <span data-slot="wizard-step-text" class="flex flex-col">
      <span data-slot="wizard-step-label" class="text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)]" style="color: ${labelColor};">${label}</span>
      @if(!description.isEmpty())
        <span data-slot="wizard-step-description" class="text-[length:var(--lv-text-xs)] text-[var(--lv-color-muted-fg)]">${description}</span>
      @endif
    </span>
  </a>
  @if(!last)
    <span aria-hidden="true" class="flex-1">@template.lievit.separator()</span>
  @endif
</li>
