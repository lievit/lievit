@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui input-group partial -- a fused-border group wrapper that composes one CORE form
  control (input, native-select, or any element) with optional leading/trailing addons and
  peer elements into one visually cohesive unit. The group is PURELY presentational: all state
  and value management lives in the inner controls; the group provides only the layout shell,
  the shared border frame, and the focus-within ring.

  TIER: PARTIAL -- pure server-rendered presentation. No enhancer, no client state, no
  data-lievit-component. The consuming template places the core control in the `content` slot
  and optional addons/elements in the four flanking slots; the server renders the HTML in one
  pass. This is the simplest non-trivial layout primitive in the library.

  STRUCTURE (scientific decision rule):
    - WAI-ARIA spec role="group" (https://www.w3.org/TR/wai-aria-1.2/#group): a named group is
      emitted ONLY when ariaLabel or ariaLabelledBy is set -- a gratuitous role="group" without
      an accessible name is a WAI-ARIA error. When the inner control has its own label (via the
      surrounding field partial) the root is a plain <div> (no role).
    - APG Grouping + Landmark guidance: the "group" role marks a cluster as a named unit; reserve
      it for compound groups where a shared label genuinely adds information (e.g. "Date range").
    - Inventory reference: Ant Design Input.Group + Input affix model (prefix/suffix text, icon
      prefix/suffix, before/after select addons) -- slot semantics adapted, no code copied.
    - Styling: ORIGINAL generation over --lv-* tokens; visual look inspired by Tailwind UI Input
      with addons (fused borders, shared radius, muted addon background) -- no code copied.

  ELEMENT vs ADDON (the two slot kinds):
    - leadingElement / trailingElement: a full-peer control (select, button) that shares the
      group border. Gets its own --lv-color-input background; separated from the core control by
      a 1px internal divider (border-r / border-l at --lv-color-border). Receives the group's
      outer border-radius on the outer side (rounded-l-* for leading, rounded-r-* for trailing).
    - leadingAddon / trailingAddon: a decoration or lightweight interactive piece (text label,
      icon, small icon-button). Gets --lv-color-muted-bg background, sits inside the group border
      frame, no own border. Purely decorative addons should have aria-hidden="true" on the addon
      container OR on the icon partial (the icon partial already emits aria-hidden by default).
      An addon containing an interactive child (button) must NOT have aria-hidden on the container.

  INNER CONTROL BORDER STRIPPING: inner <input> and <select> elements drop their own border
  inside the group context. This is achieved via a CSS descendant rule in the token stylesheet:
    [data-slot="input-group"] input,
    [data-slot="input-group"] select { border: none; border-radius: 0; box-shadow: none; outline: none; }
  Do NOT add border:none as a prop on the input partial -- the group's CSS context is the owner.

  FOCUS RING: the group root uses CSS :focus-within to show a single ring (--lv-ring) wrapping
  the whole group when any inner control is focused. Individual inner controls must not show their
  own ring inside the group (the CSS descendant rule above strips outline). Exception: a button
  trailingElement that is visually a separate peer keeps its own ring because it is outside the
  fused-border frame.

  A11y (WAI-ARIA Grouping + WCAG 1.3.1, 1.3.5):
    - role="group" + aria-label/aria-labelledby: emitted ONLY when a shared label is provided.
      Reserve for compound groups (date range, phone with country code) where the label adds info.
      A single-field group (URL input with scheme addon) is labelled via the inner input's own
      label; the group wrapper stays a plain <div>.
    - aria-invalid="true": emitted on the group root when invalid=true.
    - aria-describedby: wires the group to a hint/error region rendered by the surrounding field.
    - data-disabled: CSS hook on the group root; inner controls carry their own disabled attr.
    - Decorative addons: aria-hidden on the addon container or on the icon inside (icon partial
      already handles this for decorative icons). Interactive addon children (buttons) are NOT
      aria-hidden -- they carry their own aria-label and are in the platform tab order.
    - No ARIA widget role; no enhancer; no focus trap; no roving tabindex. All keyboard behaviour
      is provided by the native elements inside (Tab, Enter/Space on buttons, arrows in selects).

  SIZE (height-based, toolbar-aligned with button + input + native-select):
    sm -> --lv-space-8  (2rem / 32px)    compact forms, table inline-edit
    md -> --lv-space-9  (2.25rem / 36px) default, shadcn h-9 baseline, aligns with button md
    lg -> --lv-space-10 (2.5rem / 40px)  prominent search bars

  DOM ORDER (left to right, fixed):
    leadingElement -> leadingAddon -> content -> trailingAddon -> trailingElement

  ESCAPING CHANNELS (XSS decision rule, verbatim from button.jte):
    attrs     = TRUSTED raw ($unsafe) -- STATIC author-typed strings ONLY. Never feed DB or
                user-derived values into attrs.
    dataAttrs = SAFE escaped Map of String to String: each value escaped via Escape.htmlAttribute.
                Per-row or request-scoped values go through dataAttrs, never attrs.

  Params:
    String size              = "md"         sm | md | lg -- height of the group + its addons.
    boolean disabled         = false        dims the group (data-disabled); inner controls carry own disabled.
    String ariaLabel         = null         aria-label on the group root; triggers role="group" when set.
    String ariaLabelledBy    = null         aria-labelledby (id list); triggers role="group" when set.
    String ariaDescribedBy   = null         aria-describedby (hint/error region id list).
    boolean invalid          = false        aria-invalid="true" + data-invalid on the root.
    String cssClass          = ""           extra utility classes on the group root.
    String attrs             = ""           TRUSTED raw ($unsafe) -- STATIC author-typed strings only.
    Map of String to String dataAttrs = {}  SAFE dynamic data-* (each value escaped via Escape.htmlAttribute).
    gg.jte.Content leadingElement = null    full-peer control (select/button), left of core; fused border.
    gg.jte.Content leadingAddon  = null     decoration/lightweight control, left of core; muted bg.
    gg.jte.Content content                  CORE control (required): input, native-select, or any form control.
    gg.jte.Content trailingAddon = null     decoration/lightweight control, right of core; muted bg.
    gg.jte.Content trailingElement = null   full-peer control, right of core; fused border.

  Usage:
    URL field with scheme addon (decorative addon -- wrap text in aria-hidden span):
    @@template.lievit.input-group(
      ariaLabel = "Website URL",
      leadingAddon = @@`<span aria-hidden="true">https://</span>`,
      content = @@`@@template.lievit.input(name = "url", type = "url", size = "md")`
    )

    Search with icon prefix + trailing submit button (icon partial is decorative by default;
    the trailing button is an element, not an addon, so it keeps its own focus ring):
    @@template.lievit.input-group(
      leadingAddon = @@`@@template.lievit.icon(name = "search")`,
      content = @@`@@template.lievit.input(name = "q", type = "search", placeholder = "Search...")`,
      trailingElement = @@`<button type="submit" class="...">Go</button>`
    )

    Phone with country-code select (leadingElement = full peer, shares fused border):
    @@template.lievit.input-group(
      ariaLabel = "Phone number",
      leadingElement = @@`@@template.lievit.native-select(name = "cc", size = "md", ...)`,
      content = @@`@@template.lievit.input(name = "phone", type = "tel", size = "md")`
    )
--%>
@param String size = "md"
@param boolean disabled = false
@param String ariaLabel = null
@param String ariaLabelledBy = null
@param String ariaDescribedBy = null
@param boolean invalid = false
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()
@param gg.jte.Content leadingElement = null
@param gg.jte.Content leadingAddon = null
@param gg.jte.Content content
@param gg.jte.Content trailingAddon = null
@param gg.jte.Content trailingElement = null

<%-- role="group" only when a shared label is provided; a plain div otherwise. --%>
!{boolean hasGroupLabel = (ariaLabel != null && !ariaLabel.isBlank())
    || (ariaLabelledBy != null && !ariaLabelledBy.isBlank());}

<%-- Addon height per size: matches the group height token so addons are flush with the core control. --%>
!{var addonHeightClass = switch (size) {
    case "sm" -> "h-[var(--lv-space-8)]";
    case "lg" -> "h-[var(--lv-space-10)]";
    default   -> "h-[var(--lv-space-9)]";
  };}

<%-- Horizontal padding inside addon slots scales with size. --%>
!{var addonPadClass = switch (size) {
    case "sm" -> "px-[var(--lv-space-2)]";
    case "lg" -> "px-[var(--lv-space-4)]";
    default   -> "px-[var(--lv-space-3)]";
  };}

<%-- Text size inside addon slots: sm/md share text-sm; lg promotes to text-base. --%>
!{var addonTextClass = "lg".equals(size)
    ? "text-[length:var(--lv-text-base)]"
    : "text-[length:var(--lv-text-sm)]";}

<%-- SAFE dynamic data-* fragment. JTE forbids raw @for in attribute-NAME position so we build
     the fragment as a pre-escaped string and emit it with $unsafe. Keys are validated as
     [A-Za-z][A-Za-z0-9-]* to prevent key injection; values are escaped via Escape.htmlAttribute. --%>
!{var dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), dataAttrs_);
      dataAttrs_.writeContent("\"");
    }
  }}
!{var dataAttrsMarkup = dataAttrs_.toString();}

<%-- Group root: flex row, shared border + border-radius, overflow:hidden clips inner borders.
     role="group" only when a shared label exists (WAI-ARIA grouping rule).
     :focus-within raises a single ring around the whole group (not per-control).
     data-[invalid=true] and data-[disabled=true] drive CSS modifiers without JS.
     SURFACE TOKENS: the group bg + border read from --lv-group-bg / --lv-group-border with the
     standard --lv-color-input / --lv-color-border as fallbacks, so a host context (e.g. the topbar
     global-search field on a coloured brand band) can swap the surface to a veiled translucent one by
     setting those two vars on the call, WITHOUT a second conflicting bg- utility. Default unchanged. --%>
<div
  data-slot="input-group"
  data-size="${size}"
  role="${hasGroupLabel ? "group" : null}"
  aria-label="${ariaLabel}"
  aria-labelledby="${ariaLabelledBy}"
  aria-describedby="${ariaDescribedBy}"
  aria-invalid="${invalid ? "true" : null}"
  data-invalid="${invalid ? "true" : null}"
  data-disabled="${disabled ? "true" : null}"
  class="relative flex w-full min-w-0 items-stretch overflow-hidden rounded-[var(--lv-radius-md)] border border-[var(--lv-group-border,var(--lv-color-border))] bg-[var(--lv-group-bg,var(--lv-color-input))] shadow-[var(--lv-shadow-xs)] transition-[border-color,box-shadow] outline-none hover:not-[data-disabled]:border-[var(--lv-color-border-hover)] focus-within:border-[var(--lv-color-ring)] focus-within:shadow-[var(--lv-ring)] data-[invalid=true]:border-[var(--lv-color-destructive)] data-[invalid=true]:focus-within:shadow-[var(--lv-ring-destructive)] data-[disabled=true]:opacity-[var(--lv-opacity-disabled)] ${cssClass}"
  style="font-family:var(--lv-font-sans);"
  $unsafe{dataAttrsMarkup}
  $unsafe{attrs}
>
  @if(leadingElement != null)
    <%-- Full-peer element: own bg, internal divider on the right, outer radius on the left. --%>
    <div
      data-slot="leading-element"
      class="flex shrink-0 items-center ${addonHeightClass} border-r border-[var(--lv-color-border)] bg-[var(--lv-color-input)]"
    >${leadingElement}</div>
  @endif

  @if(leadingAddon != null)
    <%-- Decoration or lightweight-interactive addon: muted bg, no own border. --%>
    <%-- Purely decorative content (icon, static text) should carry aria-hidden on the content --%>
    <%-- itself (icon partial already does this). If this addon holds an interactive child --%>
    <%-- (button), do NOT add aria-hidden here -- the child carries its own aria-label. --%>
    <div
      data-slot="leading-addon"
      class="flex shrink-0 items-center ${addonHeightClass} ${addonPadClass} ${addonTextClass} bg-[var(--lv-color-muted-bg)] font-[var(--lv-font-medium)] text-[var(--lv-color-muted-fg)] select-none"
    >${leadingAddon}</div>
  @endif

  <%-- Core control slot: flex-1 so it fills the remaining width. --%>
  <div
    data-slot="content"
    class="flex min-w-0 flex-1 items-stretch"
  >${content}</div>

  @if(trailingAddon != null)
    <div
      data-slot="trailing-addon"
      class="flex shrink-0 items-center ${addonHeightClass} ${addonPadClass} ${addonTextClass} bg-[var(--lv-color-muted-bg)] font-[var(--lv-font-medium)] text-[var(--lv-color-muted-fg)] select-none"
    >${trailingAddon}</div>
  @endif

  @if(trailingElement != null)
    <%-- Full-peer element: own bg, internal divider on the left, outer radius on the right. --%>
    <div
      data-slot="trailing-element"
      class="flex shrink-0 items-center ${addonHeightClass} border-l border-[var(--lv-color-border)] bg-[var(--lv-color-input)]"
    >${trailingElement}</div>
  @endif
</div>
