<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui wizard/footer partial -- the navigation bar at the bottom of a wizard (the Filament
  Wizard footer actions): a left cluster (PREVIOUS / CANCEL) and a right cluster (NEXT or, on the
  last step, SUBMIT). Server-first, no JS.

  TIER: STATIC presentational -> JTE partial. Which buttons show is server-owned: PREVIOUS shows
  off the first step (showPrevious), SUBMIT replaces NEXT on the last step (showSubmit). Each
  button is a real <button> that drives a wire action (the WizardActionComponent next() /
  previous() / submit()): a non-blank action URL renders it as a form submit (formaction,
  CSP-clean); otherwise the adopter wires an l:click in their copy. NEXT and PREVIOUS carry a
  chevron icon; SUBMIT is the primary, filled affordance.

  STRUCTURE: the buttons follow the lievit-ui button variant idiom by data-variant
  (default / outline / ghost) so a stylesheet / the button partial styling tints them; here they
  are self-styled token-driven so the footer works standalone. PREVIOUS = ghost + left chevron;
  CANCEL = outline; NEXT = default + right chevron; SUBMIT = default (primary).

  A11y: real focusable <button>s with text labels (never icon-only); the chevron icons are
  aria-hidden decoration; a disabled NEXT (current step incomplete) carries the platform disabled
  state + aria-disabled.

  Params:
    boolean showPrevious   = false        render the PREVIOUS button (off the first step).
    boolean showCancel     = true         render the CANCEL button.
    boolean showSubmit     = false        render SUBMIT instead of NEXT (the last step).
    boolean nextDisabled   = false        disable NEXT (the current step's required fields unfilled).
    String  previousLabel  = "Previous"   the previous button label.
    String  cancelLabel    = "Cancel"     the cancel button label.
    String  nextLabel      = "Next"       the next button label.
    String  submitLabel     = "Submit"    the submit button label.
    String  previousAction = ""           non-blank => PREVIOUS posts this URL (formaction).
    String  cancelAction   = ""           non-blank => CANCEL posts this URL (formaction).
    String  nextAction     = ""           non-blank => NEXT posts this URL (formaction).
    String  submitAction   = ""           non-blank => SUBMIT posts this URL (formaction).
    String  formId         = ""           a <form> id the buttons submit.
    String  cssClass       = ""           extra utility classes on the footer.

  Usage:
    @@template.lievit.wizard.footer(
      showPrevious = wizard.currentStep() > 0,
      showSubmit = wizard.currentStep() == wizard.stepCount() - 1,
      previousAction = "/wizard/previous",
      nextAction = "/wizard/next",
      submitAction = "/wizard/submit")
--%>
@param boolean showPrevious = false
@param boolean showCancel = true
@param boolean showSubmit = false
@param boolean nextDisabled = false
@param String previousLabel = "Previous"
@param String cancelLabel = "Cancel"
@param String nextLabel = "Next"
@param String submitLabel = "Submit"
@param String previousAction = ""
@param String cancelAction = ""
@param String nextAction = ""
@param String submitAction = ""
@param String formId = ""
@param String cssClass = ""
!{var base = "inline-flex items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed disabled:opacity-50";}
!{var ghostStyle = "background: transparent; border: 1px solid transparent; color: var(--lv-color-fg); cursor: pointer; font: inherit;";}
!{var outlineStyle = "background: var(--lv-color-bg); border: 1px solid var(--lv-color-border); color: var(--lv-color-fg); cursor: pointer; font: inherit;";}
!{var primaryStyle = "background: var(--lv-color-primary); border: 1px solid transparent; color: var(--lv-color-primary-fg); cursor: pointer; font: inherit;";}
!{var formAttr = formId.isEmpty() ? null : formId;}

<div data-slot="wizard-footer-nav" class="flex w-full items-center justify-between gap-[var(--lv-space-2)] ${cssClass}">
  <span class="flex items-center gap-[var(--lv-space-2)]">
    @if(showPrevious)
      <button type="${previousAction.isEmpty() ? "button" : "submit"}" data-slot="wizard-previous" data-variant="ghost" form="${formAttr}" formaction="${previousAction.isEmpty() ? null : previousAction}" class="${base}" style="${ghostStyle}">@template.lievit.icon(name = "chevron-left", size = "1rem")<span>${previousLabel}</span></button>
    @endif
    @if(showCancel)
      <button type="${cancelAction.isEmpty() ? "button" : "submit"}" data-slot="wizard-cancel" data-variant="outline" form="${formAttr}" formaction="${cancelAction.isEmpty() ? null : cancelAction}" class="${base}" style="${outlineStyle}"><span>${cancelLabel}</span></button>
    @endif
  </span>
  <span class="flex items-center gap-[var(--lv-space-2)]">
    @if(showSubmit)
      <button type="${submitAction.isEmpty() ? "button" : "submit"}" data-slot="wizard-submit" data-variant="default" form="${formAttr}" formaction="${submitAction.isEmpty() ? null : submitAction}" class="${base}" style="${primaryStyle}"><span>${submitLabel}</span></button>
    @else
      <button type="${nextAction.isEmpty() ? "button" : "submit"}" data-slot="wizard-next" data-variant="default" form="${formAttr}" formaction="${nextAction.isEmpty() ? null : nextAction}" disabled="${nextDisabled}" aria-disabled="${nextDisabled ? "true" : null}" class="${base}" style="${primaryStyle}"><span>${nextLabel}</span>@template.lievit.icon(name = "chevron-right", size = "1rem")</button>
    @endif
  </span>
</div>
