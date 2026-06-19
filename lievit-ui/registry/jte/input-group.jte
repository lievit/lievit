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

  Params:
    String name                   the input's name attribute.
    String id          = name     the input's id (for a <label for>); defaults to name.
    String type        = "text"   native input type.
    String value       = null     current value.
    String placeholder = null     placeholder text.
    String ariaLabel   = null     aria-label for the group (and the input if no visible label).
    gg.jte.Content leading  = null leading addon slot (icon or text), rendered before the input.
    gg.jte.Content trailing = null trailing addon slot (icon, text, or a small button).
    boolean disabled   = false    disables the input + dims the group.
    String cssClass    = ""       extra utility classes on the wrapper.

  Usage:
    @template.input-group(
      name = "q", type = "search", placeholder = "Cerca contatti...", ariaLabel = "Cerca",
      leading = @`@template.icon(name = "search")`
    )

    @template.input-group(
      name = "price", type = "number", placeholder = "0",
      leading = @`<span class="text-[var(--lv-color-muted-fg)]">EUR</span>`,
      trailing = @`<span class="text-[var(--lv-color-muted-fg)]">.00</span>`
    )
--%>
@param String name
@param String id = null
@param String type = "text"
@param String value = null
@param String placeholder = null
@param String ariaLabel = null
@param gg.jte.Content leading = null
@param gg.jte.Content trailing = null
@param boolean disabled = false
@param String cssClass = ""

!{var inputId = (id != null && !id.isBlank()) ? id : name;}

<div
  role="group"
  aria-label="${ariaLabel}"
  data-slot="input-group"
  data-disabled="${disabled}"
  class="relative flex h-[var(--lv-space-10)] w-full min-w-0 items-center gap-[var(--lv-space-2)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] shadow-[var(--lv-shadow-xs)] transition-shadow outline-none focus-within:border-[var(--lv-color-ring)] focus-within:shadow-[var(--lv-ring)] data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:text-[var(--lv-color-muted-fg)] ${cssClass}"
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
    class="min-w-0 flex-1 border-0 bg-transparent text-[var(--lv-color-fg)] placeholder:text-[var(--lv-color-muted-fg)] outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed"
  >
  @if(trailing != null)
    <span data-slot="input-group-addon" data-align="inline-end" class="flex shrink-0 items-center gap-[var(--lv-space-2)] text-[var(--lv-color-muted-fg)] select-none">
      ${trailing}
    </span>
  @endif
</div>
