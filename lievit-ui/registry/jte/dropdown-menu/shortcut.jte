<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui dropdown-menu/shortcut partial -- the right-aligned keyboard hint of a menu item
  (Wave 2/3, server-first, no JS). The shadcn DropdownMenuShortcut: ml-auto text-xs
  tracking-widest text-muted-foreground -- decorative text pinned to the item's end showing the
  accelerator (e.g. "Cmd+S"). It is announced as decoration, not as an action.

  TIER: STATIC presentational -> JTE partial. Pure token-styled text.

  Back-compat: dropdown-menu/item still accepts a `shortcut` String and renders the same visual
  inline; this partial is the standalone shadcn-faithful data-slot for callers composing an
  item's trailing region by hand (e.g. inside a custom item body).

  A11y: aria-hidden="true" -- the glyph is a visual hint, the real binding lives in the platform.

  Params:
    String  shortcut            the accelerator text (e.g. "Cmd+S", "Del").
    String  cssClass = ""       extra utility classes on the shortcut.

  Usage:
    @@template.lievit.dropdown-menu.shortcut(shortcut = "Cmd+S")
--%>
@param String shortcut
@param String cssClass = ""
<span
    aria-hidden="true"
    data-slot="dropdown-menu-shortcut"
    class="${cssClass}"
    style="margin-left: auto; flex-shrink: 0; padding-left: var(--lv-space-3); color: var(--lv-color-muted); font-size: var(--lv-text-xs); letter-spacing: 0.1em;"
>${shortcut}</span>
