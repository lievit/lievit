<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui segmented partial -- a single-select segmented control (Ant Design Segmented parity).

  TIER: PARTIAL presentational -> JTE partial (ADR-0012). Zero client state; native radios carry
  the selection, the server renders which one is checked. Zero JS, zero enhancer, CSP-clean.

  STRUCTURE (scientific decision rule):
    Ant treats Segmented as a distinct control: a recessed track with one raised "pill" marking the
    selected option (a single-select switch-of-tabs). lievit's toggle-buttons/toggle-group only
    approximate the look. This is the dedicated primitive, built the CSP-clean native way: one
    radio input per option (sr-only, focusable, form-submitting) + a visible <label> segment;
    `peer-checked` raises the selected segment to the popover surface with a small shadow (the
    shadcn visual language, not Ant's). Single-select only by construction (radio group); for
    multi-select use toggle-buttons. The option set arrives as a typed Map (key=value submitted,
    value=visible label) per the React-first "no data hardcoded in a partial" rule.
    Inventory reference: Ant Design Segmented. Original generation over --lv-* tokens; no Ant code copied.

  A11y (WAI-ARIA radiogroup via native radios): the track is a <fieldset role="radiogroup"> with an
    accessible name (legend or aria-label); each option is a real radio (platform supplies role,
    arrow-key roving, single-selection, Tab). The selected segment is conveyed by the radio's
    checked state, not by colour alone.

  Params:
    String name                         the radio group name (submitted field).
    java.util.Map<String,String> options = null  ordered key->label option set.
    String value     = null             the selected option key.
    String label     = null             optional visible legend above the control.
    String ariaLabel = null             accessible name when no visible legend.
    String size      = "md"             sm|md|lg (segment height + text).
    boolean block    = false            stretch the control to full width (segments share space).
    boolean disabled = false            disable the whole group.
    String cssClass  = ""               extra utility classes on the track.
    String attrs     = ""               TRUSTED raw ($unsafe) -- STATIC author-typed strings only.

  Usage:
    @@template.lievit.segmented(name = "view", value = "list",
        options = java.util.Map.of("list", "List", "grid", "Grid"))
    @@template.lievit.segmented(name = "range", value = "week", block = true,
        options = myOrderedMap, ariaLabel = "Time range")
--%>
@param String name
@param java.util.Map<String, String> options = null
@param String value = null
@param String label = null
@param String ariaLabel = null
@param String size = "md"
@param boolean block = false
@param boolean disabled = false
@param String cssClass = ""
@param String attrs = ""

!{var segHeight = switch (size) {
    case "sm" -> "h-[var(--lv-space-7)] px-[var(--lv-space-2)] text-[length:var(--lv-text-xs)]";
    case "lg" -> "h-[var(--lv-space-10)] px-[var(--lv-space-4)] text-[length:var(--lv-text-base)]";
    default   -> "h-[var(--lv-space-8)] px-[var(--lv-space-3)] text-[length:var(--lv-text-sm)]";
  };}
!{var widthClass = block ? "flex w-full" : "inline-flex w-fit";}
!{var segWidth = block ? "flex-1" : "";}
<%-- The raised-pill selected state: peer-checked lifts the segment to the popover surface with a
     small shadow over the recessed muted track. Focus-visible raises the ring above neighbours. --%>
!{var segLabelClass = "relative inline-flex cursor-pointer select-none items-center justify-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-muted-fg)] transition-[color,background-color,box-shadow] hover:text-[var(--lv-color-fg)] peer-checked:bg-[var(--lv-color-popover)] peer-checked:text-[var(--lv-color-fg)] peer-checked:shadow-[var(--lv-shadow-xs)] peer-focus-visible:z-10 peer-focus-visible:shadow-[var(--lv-ring)] peer-disabled:cursor-not-allowed peer-disabled:opacity-50 " + segWidth + " " + segHeight;}

<fieldset
  data-slot="segmented"
  role="radiogroup"
  aria-label="${ariaLabel}"
  data-size="${size}"
  data-disabled="${disabled ? "true" : null}"
  disabled="${disabled}"
  class="m-0 min-w-0 border-0 p-0 ${cssClass}"
  style="font-family:var(--lv-font-sans);"
  $unsafe{attrs}
>
  @if(label != null && !label.isBlank())
    <legend data-slot="segmented-label" class="mb-[var(--lv-space-2)] p-0 text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)]">${label}</legend>
  @endif
  <div
    data-slot="segmented-track"
    class="${widthClass} items-stretch gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] p-[var(--lv-space-1)]"
    style="background:var(--lv-color-muted-bg);"
  >
    @if(options != null)
      @for(java.util.Map.Entry<String, String> opt : options.entrySet())
        !{var on = opt.getKey().equals(value);}
        !{var segId = name + "-" + opt.getKey();}
        <div data-slot="segmented-item" class="contents">
          <input
            type="radio"
            data-slot="segmented-control"
            id="${segId}"
            name="${name}"
            value="${opt.getKey()}"
            checked="${on}"
            disabled="${disabled}"
            class="peer sr-only"
          >
          <label for="${segId}" data-slot="segmented-segment" class="${segLabelClass}">${opt.getValue()}</label>
        </div>
      @endfor
    @endif
  </div>
</fieldset>
