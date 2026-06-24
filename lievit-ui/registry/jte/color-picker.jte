@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui color-picker partial -- a composite color-selection form control: a trigger button
  (colored preview swatch + current value label) opens a popover containing hex/RGB/HSL channel
  spinbuttons, an optional alpha slider, a preset swatch grid, and an optional eyedropper button.
  The committed color is a single hex string in a hidden native input, submitted with the form.

  TIER: PARTIAL (shell) + ENH (color-picker.enhancer.ts). The shell is pure server-rendered JTE;
  the enhancer owns exactly two irreducible client responsibilities:
    (a) keeping the channel spinbuttons, hex input, alpha slider, and native input in sync during
        editing (pure-client derived-state: hex <-> RGB <-> HSL, sub-keystroke latency required);
    (b) swatch-grid roving-tabindex keyboard navigation (APG Toolbar).
  Everything else -- form submission, the value in the hidden input, popover open/close lifecycle
  -- is handled by the platform (popover API) or the enhancer closing the popover on confirm.
  Server-first works because the VALUE is a single String (the committed hex color) that the server
  holds, validates, and reflects into the template on submit. Only the in-picker ephemeral edit
  state earns a typed-TS enhancer (it cannot be expressed as a server round-trip per keystroke).

  STRUCTURE (scientific decision rule):
    A11y sub-patterns (assembled per the BUILT case; no single APG pattern covers a composite picker):
      1. APG Button (https://www.w3.org/WAI/ARIA/apg/patterns/button/) -- the trigger <button>.
      2. APG Spinbutton (https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/) -- R/G/B/H/S/L/A inputs.
      3. APG Toolbar (https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) -- roving-tabindex swatch grid.
    Inventory reference: Ant Design ColorPicker (hex/rgb/hsl tabs, swatch presets, alpha, eyedropper;
      the full-canvas gradient picker is deliberately NOT in scope -- see spec §8).
    Styling: ORIGINAL generation over --lv-* (OKLCH) tokens; look inspired by Tailwind UI (NO code copied).

  A11y (composite widget, BUILT against raw APG sub-patterns):
    - The composite is wrapped in role="group" with an accessible name identifying it as one field.
    - The trigger is a real <button> (platform: role="button", Enter/Space, focus).
    - aria-expanded + aria-haspopup="dialog" + aria-controls on the trigger announce the popover.
    - The popover panel has role="dialog" aria-modal="false" (non-modal; Tab moves through and exits).
    - Channel inputs: <input type="number"> carries role="spinbutton" (platform). Each has aria-label,
      aria-valuemin, aria-valuemax, aria-valuenow so AT reads both label and current value.
    - The alpha range input carries role="slider" (platform) + aria-valuetext="{n}%" so AT reads units.
    - The swatch grid: role="toolbar" + roving-tabindex (APG Toolbar horizontal), managed by the
      enhancer composing the collection-nav roving-tabindex sub-behavior (data-lievit-collection +
      data-lievit-collection-roving-tabindex="true" + data-manual-activation="true").
    - Each swatch button: aria-label="{hex}", aria-pressed="true|false" for the currently-selected.
    - A role="status" aria-live="polite" live region announces swatch-color applications.
    - The native <input type="color"> is aria-hidden + tabindex="-1": it is the form sync target,
      not a UI element.
    - No focus trap: the popover is non-modal. The enhancer closes on Tab-out (focusout) and on Esc.
    - All keyboard: Home/End/PageUp/PageDown on spinbuttons, ArrowLeft/Right wrap in swatch toolbar --
      implemented by the enhancer (the platform does not supply these consistently).
    - The eyedropper button degrades gracefully when EyeDropper API is absent.

  CSP NOTE on inline style: the style="background-color: ..." attributes on the swatch buttons and
  the color-preview div are the ONE permitted inline-style use: a CSS property VALUE (a color string),
  not a handler. The CSP allows style= for property values; it forbids on*= handlers and <script>.
  If your CSP also forbids all style= attributes, set CSS custom properties on the element instead:
  style="--cp-c: {color}" and target var(--cp-c) in a class selector.

  SAFE vs TRUSTED escaping (the XSS decision rule):
    attrs (TRUSTED, raw $unsafe) -- STATIC author-typed strings only (wire directives, data-testid).
      NEVER put a per-row DB-derived value into attrs.
    dataAttrs (SAFE, escaped) -- Map of String to String; each value via Escape.htmlAttribute.
      Per-row DB values go through dataAttrs, not attrs.
    Swatch color strings from the List param go through the standard JTE ${...} escaping in
    attribute-value position; they never pass through the raw attrs channel.

  Params:
    String name                        the input name submitted with the form (required).
    String value              = "#000000"  current hex string (#rrggbb); populates all channel inputs.
    boolean alpha             = false   renders the alpha channel slider; emits rgba(...) on confirm.
    int alphaValue            = 100     alpha percentage 0-100, used when alpha=true.
    String format             = "hex"   initial display format: hex | rgb | hsl.
    java.util.List<String> swatches = java.util.List.of()  preset hex values as swatch chips.
    int swatchColumns         = 8       grid columns for the swatch row (CSS grid-cols-N).
    boolean eyedropper        = false   renders the eyedropper button.
    boolean disabled          = false   dims and blocks all interaction.
    String size               = "md"    sm | md | lg -- trigger height, toolbar-aligned.
    String ariaLabel          = "Color picker"  accessible name for the composite group.
    String ariaLabelledby     = null    overrides ariaLabel when a visible label element exists.
    String id                 = null    base id (required for full a11y wiring; auto-derived from name if null).
    String cssClass           = ""      extra utility classes on the root wrapper.
    String attrs              = ""      TRUSTED raw ($unsafe) -- STATIC author-typed strings only.
    Map of String to String dataAttrs = java.util.Map.of()  SAFE dynamic data-* on the root.

  Usage:
    @@template.lievit.color-picker(name = "label_color", value = "#2563eb")
    @@template.lievit.color-picker(name = "bg_color", value = "#ff8000", size = "sm",
        swatches = java.util.List.of("#ff0000", "#00ff00", "#0000ff"),
        alpha = true, eyedropper = true, ariaLabel = "Background color")
--%>
@param String name
@param String value = "#000000"
@param boolean alpha = false
@param int alphaValue = 100
@param String format = "hex"
@param java.util.List<String> swatches = java.util.List.of()
@param int swatchColumns = 8
@param boolean eyedropper = false
@param boolean disabled = false
@param String size = "md"
@param String ariaLabel = "Color picker"
@param String ariaLabelledby = null
@param String id = null
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()

<%-- Derive the base id from name if not supplied. --%>
!{var baseId = (id != null && !id.isBlank()) ? id : name;}

<%-- Size-dependent trigger height token class and text size (toolbar-aligned per architecture contract §5.b). --%>
!{var triggerHeightClass = switch (size) {
    case "sm" -> "h-[var(--lv-space-8)] min-w-[var(--lv-space-16)] text-[length:var(--lv-text-xs)]";
    case "lg" -> "h-[var(--lv-space-10)] min-w-[var(--lv-space-20)] text-[length:var(--lv-text-base)]";
    default   -> "h-[var(--lv-space-9)] min-w-[var(--lv-space-16)] text-[length:var(--lv-text-sm)]";
  };}

<%-- Swatch chip grid-cols class (static max columns; the swatch chip count may be less). --%>
!{var swatchGridClass = "grid gap-[var(--lv-space-1)]"
    + " grid-cols-" + Math.min(swatchColumns, 12);}

<%-- Format-group visibility: inactive groups get hidden so AT skips them; enhancer toggles this. --%>
!{var hexHidden = "hex".equals(format) ? "" : " hidden";}
!{var rgbHidden = "rgb".equals(format) ? "" : " hidden";}
!{var hslHidden = "hsl".equals(format) ? "" : " hidden";}

<%-- Derive initial R/G/B from the hex value string (7-char #rrggbb or 4-char #rgb). Falls back to 0 on parse errors. --%>
!{int initR = 0, initG = 0, initB = 0;}
!{try {
    String v = value != null ? value.trim() : "#000000";
    if (v.startsWith("#") && v.length() == 7) {
      initR = Integer.parseInt(v.substring(1, 3), 16);
      initG = Integer.parseInt(v.substring(3, 5), 16);
      initB = Integer.parseInt(v.substring(5, 7), 16);
    }
  } catch (NumberFormatException ignored) {}}

<%-- Derive initial H/S/L from R/G/B (enhancer will own live sync; this is only the server render seed). --%>
!{float fR = initR / 255.0f, fG = initG / 255.0f, fB = initB / 255.0f;}
!{float cMax = Math.max(fR, Math.max(fG, fB)), cMin = Math.min(fR, Math.min(fG, fB));}
!{float delta = cMax - cMin;}
!{float initL = (cMax + cMin) / 2.0f;}
!{float initS = delta < 0.0001f ? 0 : delta / (1 - Math.abs(2 * initL - 1));}
!{float initH = 0;}
!{if (delta > 0.0001f) {
    if (cMax == fR)      initH = 60 * (((fG - fB) / delta) % 6);
    else if (cMax == fG) initH = 60 * (((fB - fR) / delta) + 2);
    else                 initH = 60 * (((fR - fG) / delta) + 4);
  }}
!{if (initH < 0) initH += 360;}
!{int initHi = Math.round(initH), initSi = Math.round(initS * 100), initLi = Math.round(initL * 100);}

<%-- Format label for the format-toggle button aria-label. --%>
!{var formatLabel = "hex".equals(format) ? "Hex" : "rgb".equals(format) ? "RGB" : "HSL";}

<%-- Current value display string on the trigger (the committed hex). --%>
!{var displayValue = (value != null && !value.isBlank()) ? value : "#000000";}

<%-- SAFE dynamic data-* fragment (values via Escape.htmlAttribute; pattern from button.jte). --%>
!{var dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), dataAttrs_);
      dataAttrs_.writeContent("\"");
    }
  }}
!{var dataAttrsMarkup = dataAttrs_.toString();}

<%-- Root composite wrapper: role="group" identifies this as one logical control. --%>
<div
  role="group"
  aria-label="${ariaLabelledby != null ? null : ariaLabel}"
  aria-labelledby="${ariaLabelledby}"
  aria-disabled="${disabled ? "true" : null}"
  data-slot="color-picker"
  data-size="${size}"
  data-lv-color-picker
  data-lv-cp-alpha="${alpha ? "true" : null}"
  data-lv-cp-format="${format}"
  data-lv-cp-eyedropper="${eyedropper ? "true" : null}"
  data-lv-cp-swatch-count="${swatches.size()}"
  class="relative inline-flex w-fit flex-col gap-0 font-[var(--lv-font-sans)] ${cssClass}"
  $unsafe{dataAttrsMarkup}
  $unsafe{attrs}
>
  <%-- Trigger button: opens the popover, shows a colored preview swatch + committed hex label.
       aria-expanded is "false" on render; the enhancer sets it to "true" on open.
       aria-label carries the current value so AT reads the selection without opening the picker. --%>
  <button
    type="button"
    id="${baseId}-trigger"
    data-slot="trigger"
    aria-expanded="false"
    aria-haspopup="dialog"
    aria-controls="${baseId}-popover"
    aria-label="Pick color: ${displayValue}"
    disabled="${disabled}"
    class="lv-cp-trigger inline-flex cursor-pointer items-center gap-[var(--lv-space-2)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] shadow-[var(--lv-shadow-xs)] outline-none transition-[color,box-shadow] hover:border-[var(--lv-color-border-hover)] focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed disabled:opacity-[var(--lv-opacity-disabled)] ${triggerHeightClass}"
  >
    <%-- Color preview swatch in the trigger: aria-hidden (decorative; the trigger aria-label carries the value). --%>
    <span
      aria-hidden="true"
      class="shrink-0 rounded-[var(--lv-radius-sm)] border border-[var(--lv-color-border)] shadow-[var(--lv-shadow-xs)]"
      style="width:var(--lv-cp-preview-size,calc(var(--lv-space-9) - 4px));height:var(--lv-cp-preview-size,calc(var(--lv-space-9) - 4px));background-color:${displayValue};"
    ></span>
    <%-- Current committed value as text; font-mono for the hex string. --%>
    <span class="font-[var(--lv-font-mono)] text-[var(--lv-color-fg)]">${displayValue}</span>
  </button>

  <%-- Hidden native input: the form submission sink. Synced by the enhancer on confirm.
       aria-hidden + tabindex=-1: not in the user's tab order or a11y tree.
       The name attribute carries the field value to the server. --%>
  <input
    type="color"
    id="${baseId}-native"
    name="${name}"
    value="${displayValue}"
    aria-hidden="true"
    tabindex="-1"
    data-slot="native-input"
    class="sr-only"
  >

  <%-- Popover panel. The native popover attribute + CSS anchor positioning handles
       positioning + click-outside light-dismiss (the popover seam, architecture contract §2.b).
       role="dialog" aria-modal="false": non-modal picker, Tab moves through and exits.
       Closed by default; the enhancer calls panel.showPopover() on trigger click. --%>
  <div
    id="${baseId}-popover"
    role="dialog"
    aria-label="Color picker"
    aria-modal="false"
    popover
    data-slot="popover"
    class="lv-cp-popover m-0 flex w-64 flex-col gap-[var(--lv-space-3)] rounded-[var(--lv-radius-lg)] border border-[var(--lv-color-border)] bg-[var(--lv-color-popover)] p-[var(--lv-space-3)] shadow-[var(--lv-shadow-md)] outline-none z-[var(--lv-z-popover)]"
  >
    <%-- Color preview square: live background set by the enhancer; decorative (aria-hidden). --%>
    <div
      data-slot="color-preview"
      aria-hidden="true"
      class="h-[var(--lv-space-9)] w-full rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)]"
      style="background-color:${displayValue};"
    ></div>

    <%-- HEX format group: visible when format=hex, hidden otherwise. --%>
    <div
      data-slot="hex-group"
      class="flex flex-col gap-[var(--lv-space-1)]${hexHidden}"
    >
      <label
        for="${baseId}-hex"
        class="text-[length:var(--lv-text-xs)] font-[var(--lv-font-medium)] text-[var(--lv-color-muted-fg)]"
      >Hex</label>
      <input
        type="text"
        id="${baseId}-hex"
        data-slot="hex-input"
        value="${displayValue}"
        maxlength="7"
        aria-label="Hex color"
        aria-describedby="${baseId}-hex-hint"
        class="h-[var(--lv-space-8)] w-full rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-input)] px-[var(--lv-space-2)] font-[var(--lv-font-mono)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] outline-none focus-visible:shadow-[var(--lv-ring)] focus-visible:border-[var(--lv-color-ring)]"
      >
      <span id="${baseId}-hex-hint" class="sr-only">#rrggbb</span>
    </div>

    <%-- RGB format group: visible when format=rgb, hidden otherwise. --%>
    <div
      data-slot="rgb-group"
      class="flex gap-[var(--lv-space-2)]${rgbHidden}"
    >
      <div class="flex flex-1 flex-col gap-[var(--lv-space-1)]">
        <label for="${baseId}-r" class="text-[length:var(--lv-text-xs)] font-[var(--lv-font-medium)] text-[var(--lv-color-muted-fg)]">R</label>
        <input
          type="number"
          id="${baseId}-r"
          data-slot="channel-r"
          value="${initR}"
          min="0"
          max="255"
          step="1"
          aria-label="Red"
          aria-valuemin="0"
          aria-valuemax="255"
          aria-valuenow="${initR}"
          class="h-[var(--lv-space-8)] w-full rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-input)] px-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] outline-none focus-visible:shadow-[var(--lv-ring)] focus-visible:border-[var(--lv-color-ring)]"
        >
      </div>
      <div class="flex flex-1 flex-col gap-[var(--lv-space-1)]">
        <label for="${baseId}-g" class="text-[length:var(--lv-text-xs)] font-[var(--lv-font-medium)] text-[var(--lv-color-muted-fg)]">G</label>
        <input
          type="number"
          id="${baseId}-g"
          data-slot="channel-g"
          value="${initG}"
          min="0"
          max="255"
          step="1"
          aria-label="Green"
          aria-valuemin="0"
          aria-valuemax="255"
          aria-valuenow="${initG}"
          class="h-[var(--lv-space-8)] w-full rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-input)] px-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] outline-none focus-visible:shadow-[var(--lv-ring)] focus-visible:border-[var(--lv-color-ring)]"
        >
      </div>
      <div class="flex flex-1 flex-col gap-[var(--lv-space-1)]">
        <label for="${baseId}-b" class="text-[length:var(--lv-text-xs)] font-[var(--lv-font-medium)] text-[var(--lv-color-muted-fg)]">B</label>
        <input
          type="number"
          id="${baseId}-b"
          data-slot="channel-b"
          value="${initB}"
          min="0"
          max="255"
          step="1"
          aria-label="Blue"
          aria-valuemin="0"
          aria-valuemax="255"
          aria-valuenow="${initB}"
          class="h-[var(--lv-space-8)] w-full rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-input)] px-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] outline-none focus-visible:shadow-[var(--lv-ring)] focus-visible:border-[var(--lv-color-ring)]"
        >
      </div>
    </div>

    <%-- HSL format group: visible when format=hsl, hidden otherwise. --%>
    <div
      data-slot="hsl-group"
      class="flex gap-[var(--lv-space-2)]${hslHidden}"
    >
      <div class="flex flex-1 flex-col gap-[var(--lv-space-1)]">
        <label for="${baseId}-h" class="text-[length:var(--lv-text-xs)] font-[var(--lv-font-medium)] text-[var(--lv-color-muted-fg)]">H</label>
        <input
          type="number"
          id="${baseId}-h"
          data-slot="channel-h"
          value="${initHi}"
          min="0"
          max="360"
          step="1"
          aria-label="Hue"
          aria-valuemin="0"
          aria-valuemax="360"
          aria-valuenow="${initHi}"
          aria-valuetext="Hue: ${initHi} degrees"
          class="h-[var(--lv-space-8)] w-full rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-input)] px-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] outline-none focus-visible:shadow-[var(--lv-ring)] focus-visible:border-[var(--lv-color-ring)]"
        >
      </div>
      <div class="flex flex-1 flex-col gap-[var(--lv-space-1)]">
        <label for="${baseId}-s" class="text-[length:var(--lv-text-xs)] font-[var(--lv-font-medium)] text-[var(--lv-color-muted-fg)]">S</label>
        <input
          type="number"
          id="${baseId}-s"
          data-slot="channel-s"
          value="${initSi}"
          min="0"
          max="100"
          step="1"
          aria-label="Saturation"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="${initSi}"
          aria-valuetext="Saturation: ${initSi}%"
          class="h-[var(--lv-space-8)] w-full rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-input)] px-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] outline-none focus-visible:shadow-[var(--lv-ring)] focus-visible:border-[var(--lv-color-ring)]"
        >
      </div>
      <div class="flex flex-1 flex-col gap-[var(--lv-space-1)]">
        <label for="${baseId}-l" class="text-[length:var(--lv-text-xs)] font-[var(--lv-font-medium)] text-[var(--lv-color-muted-fg)]">L</label>
        <input
          type="number"
          id="${baseId}-l"
          data-slot="channel-l"
          value="${initLi}"
          min="0"
          max="100"
          step="1"
          aria-label="Lightness"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="${initLi}"
          aria-valuetext="Lightness: ${initLi}%"
          class="h-[var(--lv-space-8)] w-full rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-input)] px-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] outline-none focus-visible:shadow-[var(--lv-ring)] focus-visible:border-[var(--lv-color-ring)]"
        >
      </div>
    </div>

    <%-- Alpha slider: only when alpha=true. --%>
    @if(alpha)
      <div data-slot="alpha-group" class="flex flex-col gap-[var(--lv-space-1)]">
        <label for="${baseId}-a" class="text-[length:var(--lv-text-xs)] font-[var(--lv-font-medium)] text-[var(--lv-color-muted-fg)]">Alpha</label>
        <input
          type="range"
          id="${baseId}-a"
          data-slot="alpha-input"
          min="0"
          max="100"
          step="1"
          value="${alphaValue}"
          aria-label="Alpha"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="${alphaValue}"
          aria-valuetext="${alphaValue}%"
          class="w-full accent-[var(--lv-color-primary)] outline-none focus-visible:shadow-[var(--lv-ring)]"
        >
      </div>
    @endif

    <%-- Format toggle + eyedropper row. --%>
    <div data-slot="format-row" class="flex items-center gap-[var(--lv-space-2)]">
      <%-- Format-toggle button: cycles hex -> rgb -> hsl -> hex. aria-label updates dynamically. --%>
      <button
        type="button"
        data-slot="format-toggle"
        aria-label="Format: ${formatLabel}"
        class="inline-flex h-[var(--lv-space-7)] items-center rounded-[var(--lv-radius-sm)] border border-[var(--lv-color-border)] bg-[var(--lv-color-secondary)] px-[var(--lv-space-2)] text-[length:var(--lv-text-xs)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] outline-none transition-colors hover:bg-[var(--lv-color-accent)] focus-visible:shadow-[var(--lv-ring)]"
      >${formatLabel}</button>

      <%-- Eyedropper button: rendered only when eyedropper=true. Hidden by template when false;
           the enhancer may hide it at runtime if EyeDropper API is absent.
           NO @template.lievit.icon() call: icon.jte imports io.lievit.* which is forbidden in partials.
           Inline SVG (eyedropper glyph) keeps this partial self-contained. --%>
      @if(eyedropper)
        <button
          type="button"
          data-slot="eyedropper-btn"
          aria-label="Pick color from screen"
          class="inline-flex h-[var(--lv-space-7)] w-[var(--lv-space-7)] items-center justify-center rounded-[var(--lv-radius-sm)] border border-[var(--lv-color-border)] bg-[var(--lv-color-secondary)] text-[var(--lv-color-fg)] outline-none transition-colors hover:bg-[var(--lv-color-accent)] focus-visible:shadow-[var(--lv-ring)]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="var(--lv-icon-size)" height="var(--lv-icon-size)" fill="none" stroke="currentColor" stroke-width="var(--lv-icon-stroke)" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8z"/></svg>
        </button>
      @endif
    </div>

    <%-- Swatch grid: only when swatches is non-empty.
         role="toolbar" + data-lievit-collection + roving-tabindex=true: the collection-nav
         shared enhancer manages the roving-tabindex model (APG Toolbar horizontal).
         data-manual-activation="true": Arrow keys move focus without auto-selecting; Enter/Space select.
         data-lievit-collection-orientation="horizontal": Left/Right arrow keys navigate. --%>
    @if(!swatches.isEmpty())
      <div
        role="toolbar"
        aria-label="Color presets"
        data-slot="swatches"
        data-lv-cp-swatch-count="${swatches.size()}"
        data-lievit-collection
        data-lievit-collection-roving-tabindex="true"
        data-lievit-collection-orientation="horizontal"
        data-lievit-collection-wrap="true"
        data-manual-activation="true"
        class="${swatchGridClass}"
      >
        @for(String swatch : swatches)
          <button
            type="button"
            data-slot="swatch"
            data-color="${swatch}"
            data-lievit-item
            aria-label="${swatch}"
            aria-pressed="${swatch.equalsIgnoreCase(displayValue) ? "true" : "false"}"
            tabindex="${swatch.equalsIgnoreCase(displayValue) ? "0" : "-1"}"
            class="size-[var(--lv-cp-swatch-size,var(--lv-space-5))] shrink-0 rounded-[var(--lv-radius-sm)] border border-[var(--lv-color-border)] outline-none ring-offset-1 transition-shadow focus-visible:shadow-[var(--lv-ring)] aria-pressed:ring-2 aria-pressed:ring-[var(--lv-color-accent)]"
            style="background-color:${swatch};"
          ></button>
        @endfor
      </div>
    @endif

    <%-- Live region: always in the DOM (not injected by JS to respect CSP).
         The enhancer writes "Color set to #rrggbb" on swatch application. Visually hidden. --%>
    <span
      role="status"
      aria-live="polite"
      aria-atomic="true"
      class="sr-only"
      data-slot="live-region"
    ></span>

    <%-- Confirm / Cancel row. --%>
    <div data-slot="actions" class="flex justify-end gap-[var(--lv-space-2)]">
      <button
        type="button"
        data-slot="cancel-btn"
        aria-label="Cancel"
        class="inline-flex h-[var(--lv-space-8)] items-center rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-secondary)] px-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] outline-none transition-colors hover:bg-[var(--lv-color-accent)] focus-visible:shadow-[var(--lv-ring)]"
      >Cancel</button>
      <button
        type="button"
        data-slot="confirm-btn"
        aria-label="Confirm color"
        class="inline-flex h-[var(--lv-space-8)] items-center rounded-[var(--lv-radius-md)] bg-[var(--lv-color-primary)] px-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-primary-fg)] outline-none transition-colors hover:opacity-90 focus-visible:shadow-[var(--lv-ring)]"
      >OK</button>
    </div>

  </div><%-- /popover --%>
</div><%-- /group --%>
