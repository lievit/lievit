@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
@import java.util.List
@import java.util.Set
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui wizard partial -- a multi-step form stepper (CONTROLLED headless).

  TIER: PARTIAL + ENH (collection-nav.enhancer.ts, skippable mode only).
  No Java component, no @Wire field, no _component/_instance params.
  The active step is server truth owned by the CALLER's @Wire int activeStep field;
  this partial is the pure presentational chrome. Each step change is a wire round-trip
  (form submit or l:click="next"/"prev"/"goTo") that the CALLER's component handles before
  re-rendering with the updated activeStep index.

  CONTROLLED/UNCONTROLLED doctrine (architecture contract "Overlay & stateful primitives"):
  The wizard step is genuinely a server fact (each step submits a form; the server validates
  and decides which step is shown next). Uncontrolled (client-JS-toggled) is not meaningful
  here -- there is no "native element" that owns multi-step state the way a popover owns
  open/close. CONTROLLED is the only mode: pass activeStep="${myForm.activeStep()}" and
  wire next()/prev()/goTo() to the caller's component actions. The partial renders the chrome;
  the CALLER owns the state machine.

  STRUCTURE (scientific decision rule):
    a11y: WAI-ARIA 1.2 aria-current="step" (https://www.w3.org/TR/wai-aria-1.2/#aria-current)
          + W3C WAI Tutorial Multi-page Forms
          (https://www.w3.org/WAI/tutorials/forms/multi-page/) for the ordered-list + aria-current
          model. NOT role="tablist"/"tab" (those imply aria-selected, which conflicts with
          aria-current="step" -- the WAI Tutorial explicitly uses the list model).
    inventory: Ant Design Steps as feature inventory reference (linear/skippable modes, status
               variants, horizontal/vertical, number/icon/dot indicator, description line).
    keyboard (skippable mode): APG Tabs roving-tabindex model via collection-nav.enhancer.ts.
    styling: ORIGINAL over --lv-* OKLCH tokens; look inspired by Tailwind UI step examples.
    CSP-safe: no inline script, no on* handlers; skippable navigation via l:click on step buttons.

  A11y (WAI-ARIA aria-current="step" + W3C WAI Multi-page Forms tutorial):
    - wizard root: data-slot="wizard" + aria-label or aria-labelledby (caller supplies label).
    - step-list: role="list" on the ol (preserves list semantics in Safari when list-style removed).
    - each step item: role="listitem" (natural from li).
    - active step: aria-current="step" on the li (linear) or the button (skippable).
    - skippable step buttons: real button elements with accessible name = step title;
      aria-disabled="true" for steps not in allowedSteps (NOT native disabled -- disabled
      tabs/steps must stay focusable in roving order per APG).
    - connectors: aria-hidden="true" (decorative lines between nodes).
    - step status: visually-hidden text "Completed"/"Error"/"Pending" beside the icon for SR;
      the icon itself is aria-hidden.
    - content panel: role="group" aria-labelledby pointing to the active step's title id.
    - live region: role="status" aria-live="polite" updated on each navigation (screen-reader
      progress announcement: "Step N of M: Title").
    - action bar: real button elements; Prev carries native disabled when activeStep=0; Next
      absent on last step, Submit present instead.

  collection-nav.enhancer.ts composition (skippable mode):
    The step-list ol carries:
      data-lievit-collection               -- activates the enhancer
      data-lievit-collection-orientation   -- "horizontal" or "vertical" (matches orientation param)
      data-lievit-collection-wrap="true"   -- wraps at first/last step
      data-lievit-collection-select-action="goTo"  -- fires goTo action on Enter/Space
      data-lievit-collection-roving-tabindex="true" -- APG roving-tabindex model (DOM focus moves)
      data-manual-activation="true"        -- Arrow = focus only; Enter/Space = fire goTo
    Each reachable step button carries:
      data-lievit-item                     -- marks it as a collection item for the enhancer
    Unreachable steps (not in allowedSteps): aria-disabled="true"; no data-lievit-item
    (enhancer skips aria-disabled items in navigation, and data-lievit-item is withheld).
    In LINEAR mode: data-lievit-collection is omitted entirely (no enhancer activation).

  Params:
    int activeStep                        the 0-based index of the currently displayed step.
    List of String stepIds                stable ids for each step (same order as stepTitles);
                                          used for aria-labelledby on the content panel.
    List of String stepTitles             the step label for each step (required; accessible name).
    List of String stepDescriptions = {} optional per-step description (empty string = none).
    List of String stepIcons = {}         optional Lucide icon name per step (indicatorVariant=icon).
    Set of Integer allowedSteps = {}      reachable step indexes in skippable mode (controls
                                          aria-disabled on step buttons).
    Set of Integer completedSteps = {}    steps marked done by the server (status=finish).
    Set of Integer errorSteps = {}        steps with validation errors (status=error).
    boolean skippable = false             when true, completed/allowed steps are clickable buttons;
                                          when false, step indicators are inert (linear mode).
    String size = "md"                    "sm" | "md" | "lg" -- scales the indicator node + text.
    String orientation = "horizontal"     "horizontal" | "vertical" -- layout of the step strip.
    String labelPlacement = "bottom"      "bottom" | "inline" (horizontal only).
    String indicatorVariant = "number"    "number" | "icon" | "dot".
    String wizardAriaLabel = "Wizard"     accessible label for the wizard root (or pass
                                          wizardAriaLabelledBy pointing to a visible heading).
    String wizardAriaLabelledBy = null    alternative to wizardAriaLabel via heading id.
    String prevLabel = "Previous"         Previous button label.
    String nextLabel = "Next"             Next button label.
    String submitLabel = "Submit"         Submit button label on the last step.
    String prevAction = "prev"            wire action name for the Prev button.
    String nextAction = "next"            wire action name for the Next/Submit button.
    String goToAction = "goTo"            wire action name for skippable step buttons.
    gg.jte.Content content = null         the active step's owned body markup (form fields).
    String cssClass = ""                  extra utility classes on the wizard root.
    String attrs = ""                     TRUSTED raw ($unsafe) -- STATIC author-typed strings only.

  Usage:
    @@template.lievit.wizard(
      activeStep = myForm.activeStep(),
      stepIds = java.util.List.of("account", "profile", "confirm"),
      stepTitles = java.util.List.of("Account", "Profile", "Confirm"),
      completedSteps = myForm.completedSteps(),
      allowedSteps = myForm.allowedSteps(),
      content = @@`
        @@if(myForm.activeStep() == 0)
          (... account fields ...)
        @@elseif(myForm.activeStep() == 1)
          (... profile fields ...)
        @@else
          (... confirmation ...)
        @@endif
      `
    )
--%>
@param int activeStep
@param List<String> stepIds
@param List<String> stepTitles
@param List<String> stepDescriptions = java.util.Collections.emptyList()
@param List<String> stepIcons = java.util.Collections.emptyList()
@param Set<Integer> allowedSteps = java.util.Collections.emptySet()
@param Set<Integer> completedSteps = java.util.Collections.emptySet()
@param Set<Integer> errorSteps = java.util.Collections.emptySet()
@param boolean skippable = false
@param String size = "md"
@param String orientation = "horizontal"
@param String labelPlacement = "bottom"
@param String indicatorVariant = "number"
@param String wizardAriaLabel = "Wizard"
@param String wizardAriaLabelledBy = null
@param String prevLabel = "Previous"
@param String nextLabel = "Next"
@param String submitLabel = "Submit"
@param String prevAction = "prev"
@param String nextAction = "next"
@param String goToAction = "goTo"
@param Content content = null
@param String cssClass = ""
@param String attrs = ""

!{int stepCount = stepIds.size();}
!{boolean isFirst = activeStep == 0;}
!{boolean isLast = activeStep == stepCount - 1;}

<%-- Active step title id for aria-labelledby on the content panel.
     Built as a safe string: step id goes through the JTE expression channel (auto-escaped). --%>
!{String activeTitleId = "lv-wiz-title-" + (activeStep < stepIds.size() ? stepIds.get(activeStep) : String.valueOf(activeStep));}

<%-- Live-region announcement text: "Step N of M: Title". --%>
!{String liveText = "Step " + (activeStep + 1) + " of " + stepCount + ": " + (activeStep < stepTitles.size() ? stepTitles.get(activeStep) : "");}

<%-- Node diameter class by size (not toolbar-height-based: wizard nodes are circles, a diameter
     axis, not a control-height axis -- architecture contract §5.b display component exception). --%>
!{var nodeClass = switch (size) {
    case "sm" -> "size-[var(--lv-space-6)]";
    case "lg" -> "size-[var(--lv-space-10)]";
    default   -> "size-[var(--lv-space-8)]";
  };}

<%-- Title text size per size. --%>
!{var titleTextClass = switch (size) {
    case "sm" -> "text-[length:var(--lv-text-xs)]";
    case "lg" -> "text-[length:var(--lv-text-base)]";
    default   -> "text-[length:var(--lv-text-sm)]";
  };}

<%-- Description text is always xs. --%>
!{var descTextClass = "text-[length:var(--lv-text-xs)]";}

<%-- Root flex direction: horizontal strip over content vs vertical sidebar.
     vertical orientation: strip on the left, content on the right (row layout). --%>
!{var rootFlexClass = "vertical".equals(orientation) ? "flex flex-row gap-[var(--lv-space-6)]" : "flex flex-col gap-[var(--lv-space-6)]";}

<%-- Step-list flex direction. --%>
!{var stepListFlexClass = "vertical".equals(orientation) ? "flex flex-col gap-[var(--lv-space-4)]" : "flex flex-row items-start gap-[var(--lv-space-4)]";}

<%-- Label placement: inline puts text to the right of the node on the same baseline.
     Only applies in horizontal mode; vertical always stacks text below the node. --%>
!{var stepItemFlexClass = ("horizontal".equals(orientation) && "inline".equals(labelPlacement))
    ? "flex flex-row items-center gap-[var(--lv-space-3)]"
    : "flex flex-col items-center gap-[var(--lv-space-2)]";}

<%-- connector orientation class --%>
!{var connectorClass = "vertical".equals(orientation)
    ? "w-[2px] flex-1 min-h-[var(--lv-space-6)] bg-[var(--lv-color-border)] self-start ml-[calc(var(--lv-space-8)/2-1px)]"
    : "h-[2px] flex-1 min-w-[var(--lv-space-6)] bg-[var(--lv-color-border)] self-center mt-[calc(var(--lv-space-8)/2)]";}

<%-- Step-list is either a plain ordered-list (linear) or carries data-lievit-collection
     (skippable + collection-nav enhancer). In both cases it is an <ol role="list"> so Safari
     preserves the list semantics when list-style is removed via CSS. --%>

<div
  data-slot="wizard"
  data-size="${size}"
  data-orientation="${orientation}"
  class="${rootFlexClass} font-[family-name:var(--lv-font-sans)] ${cssClass}"
  aria-label="${wizardAriaLabelledBy == null ? wizardAriaLabel : null}"
  aria-labelledby="${wizardAriaLabelledBy}"
  $unsafe{attrs}
>

  <%-- ═══════════════════════════════════════════════════ STEP STRIP ═══ --%>
  <ol
    data-slot="wizard-step-list"
    role="list"
    class="${stepListFlexClass} list-none p-0 m-0"
    data-lievit-collection="${skippable ? "" : null}"
    data-lievit-collection-orientation="${skippable ? ("vertical".equals(orientation) ? "vertical" : "horizontal") : null}"
    data-lievit-collection-wrap="${skippable ? "true" : null}"
    data-lievit-collection-select-action="${skippable ? goToAction : null}"
    data-lievit-collection-roving-tabindex="${skippable ? "true" : null}"
    data-manual-activation="${skippable ? "true" : null}"
  >
    @for(int i = 0; i < stepCount; i++)
      !{String stepId = i < stepIds.size() ? stepIds.get(i) : String.valueOf(i);}
      !{String stepTitle = i < stepTitles.size() ? stepTitles.get(i) : "";}
      !{String stepDesc = i < stepDescriptions.size() ? stepDescriptions.get(i) : "";}
      !{String stepIcon = i < stepIcons.size() ? stepIcons.get(i) : null;}
      !{boolean isCurrent = i == activeStep;}
      !{boolean isCompleted = completedSteps.contains(i);}
      !{boolean isError = errorSteps.contains(i);}
      !{boolean isAllowed = allowedSteps.contains(i);}
      !{boolean isLast_ = i == stepCount - 1;}

      <%-- Step status: process=current, finish=completed, error=error, wait=not-yet. --%>
      !{String stepStatus = isCurrent ? "process" : (isCompleted ? "finish" : (isError ? "error" : "wait"));}

      <%-- Node background, foreground, border per status. --%>
      !{String nodeBg = switch (stepStatus) {
          case "process" -> "var(--lv-color-primary)";
          case "finish"  -> "var(--lv-color-success)";
          case "error"   -> "var(--lv-color-destructive)";
          default        -> "var(--lv-color-muted-bg)";
        };}
      !{String nodeFg = switch (stepStatus) {
          case "process" -> "var(--lv-color-primary-fg)";
          case "finish"  -> "var(--lv-color-success-fg)";
          case "error"   -> "var(--lv-color-destructive-fg)";
          default        -> "var(--lv-color-muted-fg)";
        };}
      !{String nodeBorder = "process".equals(stepStatus) ? "box-shadow: var(--lv-ring);" : "";}

      <%-- Title colour per status. --%>
      !{String titleColor = switch (stepStatus) {
          case "process" -> "var(--lv-color-fg)";
          case "finish"  -> "var(--lv-color-fg)";
          case "error"   -> "var(--lv-color-destructive)";
          default        -> "var(--lv-color-muted-fg)";
        };}
      !{boolean titleBold = isCurrent;}

      <%-- Stable title id for aria-labelledby on the content panel. --%>
      !{String titleId = "lv-wiz-title-" + stepId;}

      <%-- Skippable: this step is interactive if we're in skippable mode. --%>
      !{boolean isInteractive = skippable;}
      <%-- A step button is "reachable" (not aria-disabled) when it is in allowedSteps or is current. --%>
      !{boolean isReachable = isInteractive && (isAllowed || isCurrent);}

      <%-- Build the escaped data-step value for the goTo wire action.
           i is a plain int (not user-influenced); toString() is safe, but we still
           emit through the JTE expression channel for consistency. --%>
      !{var stepIndexOut = new StringOutput();}
      !{Escape.htmlAttribute(String.valueOf(i), stepIndexOut);}
      !{var safeStepIndex = stepIndexOut.toString();}

      <li
        data-slot="wizard-step"
        data-status="${stepStatus}"
        data-index="${i}"
        aria-current="${isCurrent && !skippable ? "step" : null}"
        class="${stepItemFlexClass}"
      >
        <%-- Indicator node: the circle containing the number / icon / dot.
             In skippable mode each step is a real button; in linear mode the node
             is a non-interactive span. ONE element per branch (no split-tag across @if/@else). --%>
        @if(isInteractive)
          <%-- Skippable: the node is wrapped in a real button.
               Reachable steps: full click affordance, aria-current="step" when active,
               data-lievit-item marks it for collection-nav.
               Unreachable steps: aria-disabled="true", no l:click, no data-lievit-item
               (the enhancer skips aria-disabled items; withholding data-lievit-item is defence-in-depth). --%>
          <button
            type="button"
            data-slot="wizard-step-button"
            aria-current="${isCurrent ? "step" : null}"
            aria-disabled="${!isReachable ? "true" : null}"
            aria-label="${stepTitle}"
            tabindex="${isCurrent ? "0" : "-1"}"
            data-step="$unsafe{safeStepIndex}"
            data-lievit-item="${isReachable ? "" : null}"
            l:click="${isReachable ? goToAction : null}"
            class="${nodeClass} relative inline-flex shrink-0 items-center justify-center rounded-[var(--lv-radius-full)] border-0 cursor-pointer outline-none focus-visible:shadow-[var(--lv-ring)] aria-disabled:cursor-not-allowed aria-disabled:opacity-[var(--lv-opacity-disabled)] transition-colors duration-[var(--lv-duration-fast)]"
            style="background:${nodeBg};color:${nodeFg};${nodeBorder}"
          >
            @if("dot".equals(indicatorVariant))
              <span aria-hidden="true" class="size-[0.5em] rounded-[var(--lv-radius-full)] bg-current"></span>
            @elseif("icon".equals(indicatorVariant) && stepIcon != null && !stepIcon.isBlank())
              @if("finish".equals(stepStatus))
                <span aria-hidden="true" class="inline-flex items-center justify-center">@template.lievit.icon(name = "check", size = "1em")</span>
              @elseif("error".equals(stepStatus))
                <span aria-hidden="true" class="inline-flex items-center justify-center">@template.lievit.icon(name = "x", size = "1em")</span>
              @else
                <span aria-hidden="true" class="inline-flex items-center justify-center">@template.lievit.icon(name = stepIcon, size = "1em")</span>
              @endif
            @else
              <%-- number variant (default) OR icon variant with no icon set (falls back to number).
                   Complete = check; error = x; otherwise = 1-based number. --%>
              @if("finish".equals(stepStatus))
                <span aria-hidden="true" class="inline-flex items-center justify-center">@template.lievit.icon(name = "check", size = "1em")</span>
              @elseif("error".equals(stepStatus))
                <span aria-hidden="true" class="inline-flex items-center justify-center">@template.lievit.icon(name = "x", size = "1em")</span>
              @else
                <span aria-hidden="true" class="${titleTextClass} font-[var(--lv-font-medium)]">${i + 1}</span>
              @endif
            @endif
            <%-- Visually-hidden SR status text: "Completed" / "Error" / "Pending" (WAI Tutorial). --%>
            <span class="sr-only">@if("finish".equals(stepStatus))Completed@elseif("error".equals(stepStatus))Error@elseif("process".equals(stepStatus))Current@else Pending@endif</span>
          </button>
        @else
          <%-- Linear mode: the node is a non-interactive span.
               aria-current="step" lives on the parent <li> (linear mode, WAI Tutorial). --%>
          <span
            data-slot="wizard-step-node"
            aria-hidden="true"
            class="${nodeClass} inline-flex shrink-0 items-center justify-center rounded-[var(--lv-radius-full)] transition-colors duration-[var(--lv-duration-fast)]"
            style="background:${nodeBg};color:${nodeFg};${nodeBorder}"
          >
            @if("dot".equals(indicatorVariant))
              <span class="size-[0.5em] rounded-[var(--lv-radius-full)] bg-current"></span>
            @elseif("icon".equals(indicatorVariant) && stepIcon != null && !stepIcon.isBlank())
              @if("finish".equals(stepStatus))
                <span class="inline-flex items-center justify-center">@template.lievit.icon(name = "check", size = "1em")</span>
              @elseif("error".equals(stepStatus))
                <span class="inline-flex items-center justify-center">@template.lievit.icon(name = "x", size = "1em")</span>
              @else
                <span class="inline-flex items-center justify-center">@template.lievit.icon(name = stepIcon, size = "1em")</span>
              @endif
            @else
              @if("finish".equals(stepStatus))
                <span class="inline-flex items-center justify-center">@template.lievit.icon(name = "check", size = "1em")</span>
              @elseif("error".equals(stepStatus))
                <span class="inline-flex items-center justify-center">@template.lievit.icon(name = "x", size = "1em")</span>
              @else
                <span class="${titleTextClass} font-[var(--lv-font-medium)]">${i + 1}</span>
              @endif
            @endif
          </span>
        @endif

        <%-- Step label + description text block.
             The title carries a stable id so the content panel can reference it via aria-labelledby. --%>
        @if(!"dot".equals(indicatorVariant) || !stepTitle.isBlank())
          <span data-slot="wizard-step-text" class="flex flex-col items-center">
            <span
              id="${titleId}"
              data-slot="wizard-step-title"
              class="${titleTextClass} font-[var(--lv-font-medium)]"
              style="color:${titleColor};"
            >${stepTitle}</span>
            @if(!stepDesc.isBlank())
              <span
                data-slot="wizard-step-description"
                class="${descTextClass} text-[var(--lv-color-muted-fg)]"
              >${stepDesc}</span>
            @endif
          </span>
        @endif

        <%-- Connector: a decorative line between this step and the next.
             Omitted after the last step. aria-hidden (purely decorative). --%>
        @if(!isLast_)
          <span aria-hidden="true" data-slot="wizard-connector" class="${connectorClass}"></span>
        @endif
      </li>
    @endfor
  </ol>

  <%-- ════════════════════════════════════════════════ CONTENT PANEL ═══ --%>
  <%-- The content panel is labelled by the active step's title element (aria-labelledby).
       role="group" groups the active step's fields under that accessible name. --%>
  <div
    data-slot="wizard-content"
    role="group"
    aria-labelledby="${activeTitleId}"
    class="flex-1"
  >
    @if(content != null)
      ${content}
    @endif
  </div>

  <%-- ═══════════════════════════════════════════════════ ACTION BAR ═══ --%>
  <div data-slot="wizard-actions" class="flex items-center justify-between gap-[var(--lv-space-2)] border-t border-[var(--lv-color-border)] pt-[var(--lv-space-4)]">
    <%-- Prev button: disabled on the first step (native disabled; not aria-disabled because
         a real button with native disabled is the correct pattern for buttons, per architecture
         contract §5.c and WAI-ARIA: aria-disabled is for anchors/roles that do not support
         the disabled IDL attribute). --%>
    <button
      type="button"
      data-slot="wizard-prev"
      data-action="prev"
      l:click="${prevAction}"
      disabled="${isFirst}"
      class="inline-flex items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] px-[var(--lv-space-4)] h-[var(--lv-space-9)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] border border-[var(--lv-color-border)] bg-transparent text-[var(--lv-color-fg)] cursor-pointer outline-none focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed disabled:opacity-[var(--lv-opacity-disabled)] transition-colors duration-[var(--lv-duration-fast)] hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)]"
      style="font-family:var(--lv-font-sans);"
    >
      @template.lievit.icon(name = "chevron-left", size = "1em")
      <span>${prevLabel}</span>
    </button>

    <%-- Next / Submit: Next on all steps except the last; Submit replaces it on the last step.
         Both rendered as ONE button (no element split across @if/@else). --%>
    <button
      type="${isLast ? "submit" : "button"}"
      data-slot="${isLast ? "wizard-submit" : "wizard-next"}"
      data-action="${isLast ? "submit" : "next"}"
      l:click="${nextAction}"
      class="inline-flex items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] px-[var(--lv-space-4)] h-[var(--lv-space-9)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] border border-transparent cursor-pointer outline-none focus-visible:shadow-[var(--lv-ring)] transition-colors duration-[var(--lv-duration-fast)]"
      style="background:var(--lv-color-primary);color:var(--lv-color-primary-fg);font-family:var(--lv-font-sans);"
    >
      @if(isLast)
        <span>${submitLabel}</span>
      @else
        <span>${nextLabel}</span>
        @template.lievit.icon(name = "chevron-right", size = "1em")
      @endif
    </button>
  </div>

  <%-- ══════════════════════════════════════════════════ LIVE REGION ═══ --%>
  <%-- Visually-hidden aria-live="polite" element: after each navigation the server
       re-renders this with the updated step announcement, giving screen-reader users
       an audible progress confirmation even when the morph is visually quiet.
       role="status" implies aria-live="polite" + aria-atomic="true" per the ARIA spec. --%>
  <div
    data-slot="wizard-live"
    role="status"
    aria-live="polite"
    class="sr-only"
  >${liveText}</div>

</div>
