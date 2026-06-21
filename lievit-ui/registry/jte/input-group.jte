@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui input-group partial -- an input wrapped with leading and/or trailing addons
  (icon or text) inside one shared bordered box that focuses as a single control.

  TIER: STATIC presentational -> JTE partial. The control state lives in the native <input>;
  the group is layout + the focus-within border treatment, no client behaviour.

  STRUCTURE (scientific decision rule): shadcn's InputGroup is a `role="group"` flex box with
  a border + shadow that owns the focus ring, while the inner <input> is borderless/ringless
  (border-0, focus-visible:ring-0) so the GROUP shows focus. Addons are ordered start/end. We
  reproduce exactly that: the shared border + focus-within ring on the wrapper, a stripped
  inner input, and leading/trailing Content slots. shadcn wins styling; the addon-click-to-
  focus nicety is JS, omitted here (static tier) -- clicking the input itself focuses, and the
  whole box is visually one field, so no behaviour is lost for the common case.

  A11y (shadcn model): role="group" + an aria-label so the compound field is announced as a
  unit. The inner control is a real <input> with its own id/name/aria-* so a <label for> and
  validation still bind to it directly. Addon icons are decorative (Lucide partial,
  aria-hidden); an addon that conveys meaning (e.g. a unit "kg") is plain text read in flow.
  The wrapper raises a focus ring via focus-within so keyboard users see the active field.

  SIZE (toolbar parity with @template.lievit.button + @template.lievit.native-select). `size` is
  HEIGHT-based on the WRAPPING bordered box; the inner input fills it (h-full). Each size pins the
  SAME --lv-space height token the other form controls use, so a [input-group][button] toolbar row
  lines up. md is the shadcn 36px control baseline (shadcn's h-nine):
    sm -> [var(--lv-space-8)]  (2rem / 32px)    ; compact toolbar (e.g. a search box)
    md -> [var(--lv-space-9)]  (2.25rem / 36px) ; THE default, the shadcn 36px row baseline
    lg -> [var(--lv-space-10)] (2.5rem / 40px)  ; tall

  Params:
    String name                   the input's name attribute.
    String id          = name     the input's id (for a <label for>); defaults to name.
    String type        = "text"   native input type.
    String size        = "md"     "sm" | "md" | "lg" wrapper height (inner input fills it).
    String value       = null     current value.
    String placeholder = null     placeholder text.
    String ariaLabel   = null     aria-label for the group (and the input if no visible label).
    gg.jte.Content leading  = null leading addon slot (icon or text), rendered before the input.
    gg.jte.Content trailing = null trailing addon slot (icon, text, or a small button).
    boolean disabled   = false    disables the input + dims the group.
    String cssClass    = ""       extra utility classes on the wrapper.

  In an adopter project the copied partials are reached as @template.lievit.* (sibling refs below
  use that namespace); the @template.lievit.input-group call itself is shown bare for the in-repo gate.

  Usage:
    @template.lievit.input-group(
      name = "q", type = "search", placeholder = "Cerca contatti...", ariaLabel = "Cerca",
      leading = @`@template.lievit.icon(name = "search")`
    )

    compact search box -- leading search icon + a trailing icon-only clear button, size sm:
    @template.lievit.input-group(
      name = "q", type = "search", size = "sm", placeholder = "Cerca...", ariaLabel = "Cerca",
      leading = @`@template.lievit.icon(name = "search")`,
      trailing = @`@template.lievit.button(iconOnly = true, size = "sm", variant = "ghost",
        ariaLabel = "Pulisci", content = @`@template.lievit.icon(name = "x", size = "1rem")`)`
    )

    @template.lievit.input-group(
      name = "price", type = "number", placeholder = "0",
      leading = @`<span class="text-[var(--lv-color-muted-fg)]">EUR</span>`,
      trailing = @`<span class="text-[var(--lv-color-muted-fg)]">.00</span>`
    )
--%>
@param String name = null
@param String id = null
@param String type = "text"
@param String size = "md"
@param String value = null
@param String placeholder = null
@param String ariaLabel = null
@param gg.jte.Content leading = null
@param gg.jte.Content trailing = null
@param boolean disabled = false
@param String cssClass = ""
@param String model = null
<%-- Trusted, static raw attributes on the inner <input> (l:* wire directives, data-*). Author-typed only ($unsafe); never user data. --%>
@param String attrs = ""

!{var inputId = (id != null && !id.isBlank()) ? id : name;}
<%-- wrapper height per size; md is the shadcn 36px toolbar baseline --%>
!{var sizeClass = switch (size) {
    case "sm" -> "h-[var(--lv-space-8)]";
    case "lg" -> "h-[var(--lv-space-10)]";
    default   -> "h-[var(--lv-space-9)]";
  };}

<div
  role="group"
  aria-label="${ariaLabel}"
  data-slot="input-group"
  data-size="${size}"
  data-disabled="${disabled}"
  class="relative flex ${sizeClass} w-full min-w-0 items-center gap-[var(--lv-space-2)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] shadow-[var(--lv-shadow-xs)] transition-shadow outline-none focus-within:border-[var(--lv-color-ring)] focus-within:shadow-[var(--lv-ring)] data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:text-[var(--lv-color-muted-fg)] ${cssClass}"
>
  @if(leading != null)
    <span data-slot="input-group-addon" data-align="inline-start" class="flex shrink-0 items-center gap-[var(--lv-space-2)] text-[var(--lv-color-muted-fg)] select-none">
      ${leading}
    </span>
  @endif
  <input
    data-slot="input-group-control"
    id="${inputId}"
    name="${name}"
    type="${type}"
    value="${value}"
    placeholder="${placeholder}"
    disabled="${disabled}"
    aria-label="${ariaLabel}"
    class="h-full min-w-0 flex-1 border-0 bg-transparent text-[var(--lv-color-fg)] placeholder:text-[var(--lv-color-muted-fg)] outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed"
    l:model="${model}"
    $unsafe{attrs}
  >
  @if(trailing != null)
    <span data-slot="input-group-addon" data-align="inline-end" class="flex shrink-0 items-center gap-[var(--lv-space-2)] text-[var(--lv-color-muted-fg)] select-none">
      ${trailing}
    </span>
  @endif
</div>
