<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui theme-switcher partial -- a light / dark / system segmented control (Filament's
  components/theme-switcher), styled as a joined button-group of three exclusive options.

  TIER: STATIC presentational -> JTE partial with a DATA-* enhancer seam. The control's STRUCTURE
  + STYLE are server-rendered (zero JS, CSP-clean, the strict CSP refuses inline scripts + on*
  handlers); the one piece that is irreducibly client-side -- reading the OS `prefers-color-scheme`, writing the
  choice to localStorage, and toggling the documentElement theme class without a round-trip -- is
  delegated to a tiny enhancer (theme-switcher.enhancer.ts, shipped later) that binds off the
  data-lievit-theme-switcher marker. No inline script ships here.

  WHY a radiogroup (not three toggles): the three options are MUTUALLY EXCLUSIVE single-select, so
  the WAI-ARIA pattern is a radiogroup (role=radiogroup + role=radio + aria-checked), NOT three
  independent aria-pressed toggles. That gives AT the "1 of 3" semantics + arrow-key roving for
  free. The look maps shadcn/Filament: a bordered segmented track whose inner rounding + borders
  collapse between options (the button-group idiom), the active option painted with the accent
  surface (--lv-color-accent fill + --lv-color-accent-fg text), inactive options muted.

  STRUCTURE (scientific decision rule): Filament's theme-switcher is three icon buttons (sun / moon
  / monitor) in a rounded track. We render the same three options, each a real <button type=button>
  carrying its theme value + an icon (+ optional visible label), joined via the same collapsed-inner
  -rounding utilities button-group.jte uses. The CURRENT theme is server-owned (data down) via the
  `current` param so the markup is correct JS-off / on first paint; the enhancer then takes over
  selection + persistence on the client. Roving tabindex: the active radio is tabbable (tabindex 0),
  the rest are not (tabindex -1), the APG radiogroup contract.

  PERSISTENCE: data-storage-key names the localStorage key the enhancer reads/writes (default
  "lievit-theme"); data-theme-value on each option carries its value ("light"|"dark"|"system").
  Nothing here writes storage -- that is the enhancer's job, off the data-* hooks.

  A11y (WAI-ARIA APG radiogroup): role=radiogroup + aria-label on the track; each option
  role=radio + aria-checked + a roving tabindex; the icon is decorative (aria-hidden) and each
  option carries an aria-label (the theme name) so icon-only options stay accessible.

  Params:
    String current     = "system"  the active theme ("light" | "dark" | "system"), data down.
    boolean labels     = false     show the text label beside each icon (else icon-only).
    String storageKey  = "lievit-theme"  localStorage key the enhancer persists the choice under.
    String label       = "Tema"    aria-label for the radiogroup track.
    String lightLabel  = "Chiaro"  the light option's label / aria-label.
    String darkLabel   = "Scuro"   the dark option's label / aria-label.
    String systemLabel = "Sistema" the system option's label / aria-label.
    String cssClass    = ""        extra utility classes on the track.

  Usage:
    @@template.lievit.theme-switcher(current = userTheme)
    @@template.lievit.theme-switcher(current = "dark", labels = true)
    @@template.lievit.theme-switcher(current = userTheme, storageKey = "ht-theme", label = "Tema")
--%>
@param String current = "system"
@param boolean labels = false
@param String storageKey = "lievit-theme"
@param String label = "Tema"
@param String lightLabel = "Chiaro"
@param String darkLabel = "Scuro"
@param String systemLabel = "Sistema"
@param String cssClass = ""

!{var optionClass = "inline-flex items-center justify-center gap-[var(--lv-space-1)] border border-[var(--lv-color-border)] bg-transparent px-[var(--lv-space-2)] py-[var(--lv-space-1)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-muted-fg)] outline-none transition-colors hover:text-[var(--lv-color-fg)] focus-visible:relative focus-visible:z-10 focus-visible:shadow-[var(--lv-ring)] aria-[checked=true]:bg-[var(--lv-color-accent)] aria-[checked=true]:text-[var(--lv-color-accent-fg)] [&:not(:first-child)]:rounded-l-none [&:not(:first-child)]:border-l-0 [&:not(:last-child)]:rounded-r-none rounded-[var(--lv-radius-md)]";}

<div
  data-slot="theme-switcher"
  data-lievit-theme-switcher
  data-storage-key="${storageKey}"
  data-current="${current}"
  role="radiogroup"
  aria-label="${label}"
  class="inline-flex w-fit items-stretch ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  <button
    type="button"
    data-slot="theme-switcher-option"
    data-theme-value="light"
    role="radio"
    aria-checked="${"light".equals(current) ? "true" : "false"}"
    aria-label="${lightLabel}"
    tabindex="${"light".equals(current) ? "0" : "-1"}"
    class="${optionClass}"
  >
    <span aria-hidden="true" class="inline-flex shrink-0 items-center">@template.lievit.icon(name = "sun", size = "1rem")</span>
    @if(labels)<span data-slot="theme-switcher-label">${lightLabel}</span>@endif
  </button>
  <button
    type="button"
    data-slot="theme-switcher-option"
    data-theme-value="dark"
    role="radio"
    aria-checked="${"dark".equals(current) ? "true" : "false"}"
    aria-label="${darkLabel}"
    tabindex="${"dark".equals(current) ? "0" : "-1"}"
    class="${optionClass}"
  >
    <span aria-hidden="true" class="inline-flex shrink-0 items-center">@template.lievit.icon(name = "moon", size = "1rem")</span>
    @if(labels)<span data-slot="theme-switcher-label">${darkLabel}</span>@endif
  </button>
  <button
    type="button"
    data-slot="theme-switcher-option"
    data-theme-value="system"
    role="radio"
    aria-checked="${"system".equals(current) ? "true" : "false"}"
    aria-label="${systemLabel}"
    tabindex="${"system".equals(current) ? "0" : "-1"}"
    class="${optionClass}"
  >
    <span aria-hidden="true" class="inline-flex shrink-0 items-center">@template.lievit.icon(name = "monitor", size = "1rem")</span>
    @if(labels)<span data-slot="theme-switcher-label">${systemLabel}</span>@endif
  </button>
</div>
