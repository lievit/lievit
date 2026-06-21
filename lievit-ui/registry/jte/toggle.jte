@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui toggle partial -- a two-state pressed <button> (aria-pressed), token-styled.

  TIER: STATIC presentational -> JTE partial. A native <button> carrying aria-pressed is the
  WAI-ARIA toggle-button pattern: the button role + Enter/Space activation come from the platform.
  The pressed state is server-owned (data down): the controller renders `pressed`, and the click
  is wired by the consuming wire template via `l:click` (or a plain form POST), not by the button
  itself. No client state ships.

  STRUCTURE (scientific decision rule): shadcn's Toggle is a Radix Toggle (a button with
  data-state, no extra JS for the role). We reproduce its variants (`default` ghost / `outline`)
  and sizes (`sm` / `default` / `lg`) with `--lv-*` tokens; the pressed look is driven by
  `aria-pressed="true"`, which paints the shadcn accent surface (`--lv-color-accent` fill +
  `--lv-color-accent-fg` text), not a flat muted grey. An optional Lucide glyph composes the
  icon partial (never Font Awesome). When `invalid` is set the control carries `aria-invalid`
  and shows the destructive border + ring (shadcn's `aria-invalid:ring-destructive`).

  A11y (Radix / WAI-ARIA): a real <button type=button> with `aria-pressed="true|false"` announces
  the on/off state. For an icon-only toggle pass `ariaLabel` (the button then has an accessible
  name). The icon is decorative (aria-hidden, icon partial).

  Params:
    String pressedAction = null  l:click expression (the wire action that flips the state).
    boolean pressed   = false    current pressed state (server-owned, data down).
    boolean disabled  = false    disables + dims the control.
    boolean invalid   = false    aria-invalid="true" + destructive border/ring (error state).
    String variant    = "default" "default" (ghost) | "outline".
    String size       = "default" "sm" | "default" | "lg".
    String icon       = null     optional Lucide icon name rendered before the content.
    String ariaLabel  = null     accessible name (required for icon-only toggles).
    String value      = null     optional value (e.g. when this toggle is part of a group).
    gg.jte.Content content = null  the toggle's label content.
    String cssClass   = ""        extra utility classes on the button.

  Usage:
    @@template.lievit.toggle(icon = "star", ariaLabel = "Preferito", pressed = item.starred(),
      pressedAction = "toggleStar")
    @@template.lievit.toggle(variant = "outline", pressed = bold, content = @@`Grassetto`)
--%>
@param String pressedAction = null
@param boolean pressed = false
@param boolean disabled = false
@param boolean invalid = false
@param String variant = "default"
@param String size = "default"
@param String icon = null
@param String ariaLabel = null
@param String value = null
@param gg.jte.Content content = null
@param String cssClass = ""

<button
  data-slot="toggle"
  type="button"
  aria-pressed="${pressed ? "true" : "false"}"
  aria-invalid="${invalid ? "true" : null}"
  aria-label="${ariaLabel}"
  data-variant="${variant}"
  data-size="${size}"
  data-value="${value}"
  disabled="${disabled}"
  l:click="${pressedAction}"
  class="inline-flex items-center justify-center gap-[var(--lv-space-2)] rounded-[var(--lv-radius-md)] border border-transparent bg-transparent text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] outline-none transition-[color,box-shadow] hover:bg-[var(--lv-color-surface)] focus-visible:shadow-[var(--lv-ring)] disabled:pointer-events-none disabled:opacity-50 data-[variant=outline]:border-[var(--lv-color-border)] data-[size=sm]:h-[var(--lv-space-8)] data-[size=sm]:min-w-[var(--lv-space-8)] data-[size=sm]:px-[var(--lv-space-2)] data-[size=default]:h-[var(--lv-space-9)] data-[size=default]:min-w-[var(--lv-space-9)] data-[size=default]:px-[var(--lv-space-3)] data-[size=lg]:h-[var(--lv-space-10)] data-[size=lg]:min-w-[var(--lv-space-10)] data-[size=lg]:px-[var(--lv-space-4)] aria-[pressed=true]:bg-[var(--lv-color-accent)] aria-[pressed=true]:text-[var(--lv-color-accent-fg)] aria-[invalid=true]:border-[var(--lv-color-destructive)] aria-[invalid=true]:shadow-[0_0_0_3px_color-mix(in_srgb,var(--lv-color-destructive)_20%,transparent)] ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  @if(icon != null && !icon.isBlank())
    <span aria-hidden="true" class="flex shrink-0 items-center">
      @template.lievit.icon(name = icon, size = "1rem")
    </span>
  @endif
  @if(content != null)${content}@endif
</button>
