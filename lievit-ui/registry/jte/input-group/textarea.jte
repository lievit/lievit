@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui input-group/textarea partial -- shadcn's InputGroupTextarea: the same bordered group
  box as @template.lievit.input-group, but wrapping a native <textarea> instead of an <input>.
  Typically paired with block-start / block-end addons (a toolbar row above the textarea).

  TIER: STATIC presentational -> JTE partial. The control state lives in the native <textarea>;
  the group is layout + the focus-within border treatment, no client behaviour.

  STRUCTURE (scientific decision rule): shadcn's InputGroupTextarea is a borderless, resize-none
  <textarea> (rounded-none, border-0, shadow-none, focus-visible:ring-0) that fills the group, so
  the GROUP owns the border + focus ring (same as the input variant). We reproduce that with the
  same wrapper as input-group and a stripped textarea. The wrapper auto-switches to a column when
  a block addon is present (the `has-[>[data-align=block-*]]` selectors), exactly like shadcn.

  A11y (shadcn model): role="group" + an aria-label names the compound field; the inner <textarea>
  keeps its own id/name/aria-* so a <label for> and validation bind to it directly. Addons follow
  the input-group rules (decorative icons aria-hidden, meaningful text read in flow).

  INVALID: the `invalid` flag puts the group into the error state (destructive border + ring on the
  wrapper) and sets aria-invalid on the textarea, matching the input-group variant.

  Params:
    String name                   the textarea's name attribute.
    String id          = name     the textarea's id (for a <label for>); defaults to name.
    int rows           = 3        visible rows of the textarea.
    String value       = null     current value (rendered as the element's text content).
    String placeholder = null     placeholder text.
    String ariaLabel   = null     aria-label for the group (and the textarea if no visible label).
    gg.jte.Content leading  = null leading addon slot (icon or text).
    gg.jte.Content trailing = null trailing addon slot (icon, text, or a small button).
    String leadingAlign = "block-start"  leading addon alignment: "inline-start" | "block-start" (ABOVE, the default for a textarea).
    String trailingAlign = "block-end"   trailing addon alignment: "inline-end" | "block-end" (BELOW, the default for a textarea).
    boolean invalid    = false    error state: destructive border + ring on the group + aria-invalid.
    boolean disabled   = false    disables the textarea + dims the group.
    String cssClass    = ""       extra utility classes on the wrapper.
    String model       = null     l:model expression to bind this textarea to a wire field.
    String attrs       = ""       trusted, static raw attributes on the inner <textarea> (author-typed only).

  Usage:
    @@template.lievit.input-group.textarea(
      name = "note", ariaLabel = "Note", placeholder = "Write a note...",
      trailing = @@`@@template.lievit.button(size = "sm", content = @@`Send`)`
    )
--%>
@param String name = null
@param String id = null
@param int rows = 3
@param String value = null
@param String placeholder = null
@param String ariaLabel = null
@param gg.jte.Content leading = null
@param gg.jte.Content trailing = null
@param String leadingAlign = "block-start"
@param String trailingAlign = "block-end"
@param boolean invalid = false
@param boolean disabled = false
@param String cssClass = ""
@param String model = null
<%-- Trusted, static raw attributes on the inner <textarea> (l:* wire directives, data-*). Author-typed only ($unsafe); never user data. --%>
@param String attrs = ""

!{var areaId = (id != null && !id.isBlank()) ? id : name;}

<div
  role="group"
  aria-label="${ariaLabel}"
  data-slot="input-group"
  data-invalid="${invalid ? "true" : null}"
  data-disabled="${disabled}"
  class="relative flex h-auto w-full min-w-0 flex-col gap-[var(--lv-space-2)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] shadow-[var(--lv-shadow-xs)] transition-shadow outline-none focus-within:border-[var(--lv-color-ring)] focus-within:shadow-[var(--lv-ring)] data-[invalid=true]:border-[var(--lv-color-destructive)] data-[invalid=true]:shadow-[0_0_0_3px_color-mix(in_srgb,var(--lv-color-destructive)_20%,transparent)] data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:text-[var(--lv-color-muted-fg)] ${cssClass}"
>
  @if(leading != null)
    <span data-slot="input-group-addon" data-align="${leadingAlign}" class="flex shrink-0 items-center gap-[var(--lv-space-2)] text-[var(--lv-color-muted-fg)] select-none data-[align=block-start]:order-first data-[align=block-start]:w-full data-[align=block-start]:justify-start">
      ${leading}
    </span>
  @endif
  <textarea
    data-slot="input-group-control"
    id="${areaId}"
    name="${name}"
    rows="${rows}"
    placeholder="${placeholder}"
    disabled="${disabled}"
    aria-label="${ariaLabel}"
    aria-invalid="${invalid ? "true" : null}"
    class="min-w-0 flex-1 resize-none border-0 bg-transparent text-[var(--lv-color-fg)] placeholder:text-[var(--lv-color-muted-fg)] outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed"
    l:model="${model}"
    $unsafe{attrs}
  >${value}</textarea>
  @if(trailing != null)
    <span data-slot="input-group-addon" data-align="${trailingAlign}" class="flex shrink-0 items-center gap-[var(--lv-space-2)] text-[var(--lv-color-muted-fg)] select-none data-[align=block-end]:order-last data-[align=block-end]:w-full data-[align=block-end]:justify-start">
      ${trailing}
    </span>
  @endif
</div>
