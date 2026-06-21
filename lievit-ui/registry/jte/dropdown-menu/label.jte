<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui dropdown-menu/label partial -- a non-interactive caption for a group of menu items
  (Wave 2/3, server-first, no JS). The shadcn DropdownMenuLabel: a small medium-weight heading
  that titles a DropdownMenuGroup; it is NOT a menuitem (no role, not focusable), so assistive
  tech reads it as static text within the menu, not as a selectable entry.

  TIER: STATIC presentational -> JTE partial. Pure token-styled text.

  STRUCTURE (shadcn DropdownMenuLabel, new-york-v4): px-2 py-1.5 text-sm font-medium, with an
  `inset` variant (data-[inset]:pl-8) that aligns the label text under the items' icon column
  when the group has checkable/icon items.

  A11y: a plain text caption (no role). Paired with dropdown-menu/group it can name the group
  via aria-labelledby (pass a matching `id`).

  Params:
    String  label              the caption text.
    String  id = ""            optional id, so a dropdown-menu/group can aria-labelledby it.
    boolean inset = false       indents the label under the items' leading-icon column (shadcn inset).
    String  cssClass = ""       extra utility classes on the label.

  Usage:
    @@template.lievit.dropdown-menu.label(label = "My account")
--%>
@param String label
@param String id = ""
@param boolean inset = false
@param String cssClass = ""
<div
    data-slot="dropdown-menu-label"
    data-inset="${inset ? "true" : null}"
    id="${id.isEmpty() ? null : id}"
    class="${cssClass}"
    style="padding: var(--lv-space-2) var(--lv-space-3); padding-left: ${inset ? "var(--lv-space-8)" : "var(--lv-space-3)"}; font-size: var(--lv-text-sm); font-weight: var(--lv-font-medium); color: var(--lv-color-fg);"
>${label}</div>
