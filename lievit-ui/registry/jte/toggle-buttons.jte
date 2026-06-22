<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui toggle-buttons partial -- a segmented control used as a FORM control: a joined row of
  options where one (single) or several (multiple) can be pressed, and the selection POSTs
  natively (Filament's ToggleButtons field; shadcn's ToggleGroup, but form-bound and JS-off-safe).

  TIER: STATIC presentational -> JTE partial (zero JS). The trick that buys "no JS, no dead
  control, full a11y, native POST": the segments are REAL native form inputs with their label
  styled to LOOK like a button, not <button>s.
    - single   = native <input type="radio"> sharing one `name` inside a <fieldset> (the platform
                 gives single-selection, roving arrow-key focus and the radiogroup role for free;
                 POSTs the one chosen value under `name`).
    - multiple = native <input type="checkbox"> sharing one `name` (each toggles independently;
                 POSTs every pressed value under the repeated `name`; unchecked are absent).
  The input itself is visually hidden (sr-only, NOT display:none, so it stays focusable + in the
  tab order + form-submitted); its sibling <label> is the visible segment and the `peer-checked:`
  utilities paint the pressed state. So the control is fully keyboard- and screen-reader-operable
  and POSTs with zero JavaScript.

  STRUCTURE (scientific decision rule): shadcn's ToggleGroup is a Radix component reimplementing
  pressed-state, roving focus and selection in JS, and it does not submit in a plain form. Native
  radios/checkboxes give the SAME selection semantics + keyboard + a11y from the platform AND POST
  natively, so they win outright on a11y, bundle and no-JS. We reuse the button-group's joined-look
  CSS (collapsed inner rounding + shared borders) over the labels so the row reads as one segmented
  control, exactly shadcn's visual, without its JS.

  A11y (WAI-ARIA): single = a native <fieldset>/<legend> radiogroup (the platform announces the
  group + single selection + roving focus); multiple = a <fieldset> whose legend names the set and
  whose checkboxes each toggle independently. `ariaLabel` names the fieldset when there is no
  visible legend. The selected segment is the native :checked input, never colour alone; disabled
  segments are real disabled inputs. `invalid` sets aria-invalid on the group + a danger ring.

  OPTIONS: an ordered Map<String,String> via `options` (value -> label), OR a `content` slot of
  hand-authored segment markup. `content` wins.

  Params:
    String name                       the shared control name (radio: one value; checkbox: repeated).
    java.util.Map<String,String> options = null  ordered value->label segment map.
    gg.jte.Content content = null     hand-authored segment markup (wins over options).
    boolean multiple  = false         checkbox segments (multi) vs radio segments (single).
    String value      = null          the selected value (single mode).
    java.util.List<String> values = null  the selected values (multiple mode).
    String label      = null          visible <legend> text.
    String ariaLabel  = null          aria-label on the fieldset when no visible legend.
    String describedBy = null         id of an external hint/error element (aria-describedby).
    String size       = "md"          "sm" | "md" | "lg" segment height (toolbar parity).
    String orientation = "horizontal" "horizontal" | "vertical" segment layout.
    boolean disabled  = false         disables the whole group.
    boolean required  = false         marks the group required (single mode).
    boolean invalid   = false         aria-invalid + danger ring (error state).
    String cssClass   = ""            extra utility classes on the fieldset.

  Usage:
    @@template.lievit.toggle-buttons(
      name = "stato", label = "Stato", value = contatto.stato(),
      options = java.util.Map.of("attivo", "Attivo", "sospeso", "Sospeso", "chiuso", "Chiuso"))
    @@template.lievit.toggle-buttons(
      name = "giorni", label = "Giorni", multiple = true, values = scelti,
      options = java.util.Map.of("lun", "Lun", "mar", "Mar", "mer", "Mer"))
--%>
@import gg.jte.Content
@param String name
@param java.util.Map<String, String> options = null
@param gg.jte.Content content = null
@param boolean multiple = false
@param String value = null
@param java.util.List<String> values = null
@param String label = null
@param String ariaLabel = null
@param String describedBy = null
@param String size = "md"
@param String orientation = "horizontal"
@param boolean disabled = false
@param boolean required = false
@param boolean invalid = false
@param String cssClass = ""

!{var selectedSet = values != null ? values : java.util.List.<String>of();}
!{var inputType = multiple ? "checkbox" : "radio";}
!{var horizontal = !"vertical".equals(orientation);}
!{var axis = horizontal ? "flex-row" : "flex-col";}
!{var joinReset = horizontal
    ? "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none"
    : "[&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none";}
!{var segHeight = switch (size) {
    case "sm" -> "h-[var(--lv-space-8)] px-[var(--lv-space-2)] text-[length:var(--lv-text-xs)]";
    case "lg" -> "h-[var(--lv-space-10)] px-[var(--lv-space-4)] text-[length:var(--lv-text-base)]";
    default   -> "h-[var(--lv-space-9)] px-[var(--lv-space-3)] text-[length:var(--lv-text-sm)]";
  };}
<%-- the input is sr-only (focusable, submitted), the <label> is the visible segment; peer-checked
     paints the pressed state, peer-focus-visible raises the ring above the joined neighbours. --%>
!{var segLabelClass = "relative inline-flex cursor-pointer select-none items-center justify-center gap-[var(--lv-space-1)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] rounded-[var(--lv-radius-md)] transition-[color,box-shadow] hover:bg-[var(--lv-color-muted)] peer-checked:border-[var(--lv-color-primary)] peer-checked:bg-[var(--lv-color-primary)] peer-checked:text-[var(--lv-color-primary-fg)] peer-checked:hover:bg-[var(--lv-color-primary)] peer-focus-visible:z-10 peer-focus-visible:border-[var(--lv-color-ring)] peer-focus-visible:shadow-[var(--lv-ring)] peer-disabled:cursor-not-allowed peer-disabled:opacity-50 " + segHeight;}

<fieldset
  data-slot="toggle-buttons"
  data-multiple="${multiple ? "true" : null}"
  data-orientation="${orientation}"
  aria-label="${ariaLabel}"
  aria-describedby="${describedBy}"
  aria-invalid="${invalid ? "true" : null}"
  data-invalid="${invalid ? "true" : null}"
  data-disabled="${disabled ? "true" : null}"
  disabled="${disabled}"
  class="m-0 min-w-0 border-0 p-0 ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  @if(label != null && !label.isBlank())
    <legend data-slot="toggle-buttons-label" class="mb-[var(--lv-space-2)] p-0 text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)]">${label}</legend>
  @endif
  <div role="group" data-slot="toggle-buttons-group" class="inline-flex w-fit items-stretch ${axis} ${joinReset}">
    @if(content != null)
      ${content}
    @elseif(options != null)
      @for(java.util.Map.Entry<String, String> opt : options.entrySet())
        !{var on = multiple ? selectedSet.contains(opt.getKey()) : opt.getKey().equals(value);}
        !{var segId = name + "-" + opt.getKey();}
        <div data-slot="toggle-button" class="contents">
          <input
            type="${inputType}"
            data-slot="toggle-button-control"
            id="${segId}"
            name="${name}"
            value="${opt.getKey()}"
            checked="${on}"
            disabled="${disabled}"
            required="${required && !multiple}"
            aria-invalid="${invalid ? "true" : null}"
            class="peer sr-only"
          >
          <label
            for="${segId}"
            data-slot="toggle-button-label"
            class="${segLabelClass}"
          >${opt.getValue()}</label>
        </div>
      @endfor
    @endif
  </div>
</fieldset>
