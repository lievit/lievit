@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui :: data-table.column-visibility - the "Columns" show/hide toggle of the data table.

  shadcn's Data Table renders a <DropdownMenu> with a "Columns" trigger and one DropdownMenuCheckboxItem
  per hideable column (checked = column visible, toggles column.toggleVisibility). This partial is that
  dropdown: it composes the sibling dropdown-menu partial with a "Columns" trigger + a trailing
  chevron-down (the lievit dropdown idiom; shadcn uses a plain outline "Columns" button), and the caller
  fills the `content` slot with one @template.lievit.dropdown-menu.item(type = "checkbox", ...) per column.

  SERVER-FIRST: which columns are visible is a SERVER fact the kit holds (a set of hidden column ids),
  like sort/page/selection. The partial renders the STRUCTURE; each checkbox item carries its checked
  state from the server and a wire hook (a form action / l:click the adopter wires) to toggle it. The
  menu itself is the native-popover dropdown (zero JS, CSP-clean); with JS off the toggles are real
  <button> form actions, so column visibility survives a reload as URL/server state.

  Params:
    String  id      = "lv-data-table-columns"  the dropdown panel id (unique per page).
    String  label   = "Columns"                the trigger text.
    Content content                            the checkbox items: one @template.lievit.dropdown-menu.item
                                               (type = "checkbox", checked = view.isColumnVisible(col),
                                               formAction = ".../toggle-column?col=...") per hideable column.
    String  cssClass = ""                      extra classes on the dropdown wrapper.

  Usage:
    @@template.lievit.data-table.column-visibility(content = @@`
      @@for(var col : view.hideableColumns())
        @@template.lievit.dropdown-menu.item(type = "checkbox", label = col.label(),
          checked = col.visible(), formAction = "/admin/listings/columns/" + col.id())
      @@endfor
    `)
--%>
@param String id = "lv-data-table-columns"
@param String label = "Columns"
@param gg.jte.Content content
@param String cssClass = ""
<div data-slot="data-table-column-visibility" class="${cssClass}" style="font-family:var(--lv-font-sans);">
  @template.lievit.dropdown-menu(
    id = id,
    placement = "bottom",
    trigger = @`<span>${label}</span><span aria-hidden="true" class="text-[var(--lv-color-muted-fg)]">@template.lievit.icon(name = "chevron-down", size = "1rem")</span>`,
    content = content
  )
</div>
