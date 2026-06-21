@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui :: data-table.selection-cell - the leading checkbox column of the server-first data table.

  shadcn's Data Table prepends a checkbox column (id="select"): a select-all checkbox in the header
  (checked when the whole page is selected, indeterminate when some are), and a per-row checkbox that
  toggles row.getIsSelected() -- the same boolean the row's data-state="selected" tint already reads.
  This partial renders THAT column's one cell: a header cell (<th scope="col">) for the select-all box,
  or a body cell (<td>) for a per-row box. The checkbox itself is the lievit checkbox partial (native
  <input type=checkbox>, JS-off submit, indeterminate via aria-checked="mixed").

  SERVER-FIRST wiring: selection is a SERVER fact the kit holds (which row ids are selected this page),
  exactly like sort and page. The partial renders the STRUCTURE + a wire hook; the adopter / lievit-kit
  wires the toggle. Pass `model` for an l:model binding (the checkbox partial binds it to the native
  change event, the documented checkbox wire idiom). With JS off the checkbox still POSTs its `value`
  under `name`, so a plain form-based bulk action (a surrounding <form> + submit) works unchanged.

  The checkbox-column spacing rule (shadcn table.tsx): a cell that HOLDS a [role=checkbox] drops its
  right padding (`[&:has([role=checkbox])]:pr-0`) so the box sits flush; this partial bakes pr-0 in.

  A11y: the select-all box gets aria-label "Select all" (no visible label fits a header checkbox);
  a row box gets aria-label "Select row". `indeterminate` renders the tri-state "mixed" glyph for the
  "some rows selected" header state. A real <th scope="col"> / <td> keeps table semantics intact.

  Params:
    boolean header        = false  true => the select-all header cell (<th scope=col>); else a row cell (<td>).
    String  name          = null   the checkbox name (POSTs `value` when checked); e.g. "selectAll" / "selected".
    String  value         = "on"   the submitted value when checked (a row box usually passes the row id).
    boolean checked       = false  initial checked state (select-all: whole page selected; row: this row selected).
    boolean indeterminate = false  header-only: "some but not all" rows selected (tri-state "mixed").
    String  ariaLabel     = null   accessible name; defaults to "Select all" (header) / "Select row" (row).
    String  model         = null   l:model expression binding the checkbox to a wire field.
    String  klass         = ""     extra classes on the cell.

  Usage (header):
    @@template.lievit.data-table.selection-cell(header = true, name = "selectAll",
      checked = view.allSelected(), indeterminate = view.someSelected(), model = "selectAll")
  Usage (row):
    @@template.lievit.data-table.selection-cell(name = "selected", value = row.id(),
      checked = view.isSelected(row.id()), model = "selected")
--%>
@param boolean header = false
@param String name = null
@param String value = "on"
@param boolean checked = false
@param boolean indeterminate = false
@param String ariaLabel = null
@param String model = null
@param String klass = ""
!{var label = (ariaLabel != null && !ariaLabel.isBlank()) ? ariaLabel : (header ? "Select all" : "Select row");}
@if(header)
  <th
    scope="col"
    data-slot="data-table-selection-head"
    class="lv-table-head h-[var(--lv-space-9)] w-[var(--lv-space-9)] px-[var(--lv-space-2)] pr-0 text-left align-middle [&:has([role=checkbox])]:pr-0 ${klass}"
    style="color:var(--lv-color-fg);background-color:color-mix(in srgb, var(--lv-color-surface) 70%, var(--lv-color-bg));"
  >
    @template.lievit.checkbox(name = name, value = value, checked = checked, indeterminate = indeterminate, ariaLabel = label, model = model)
  </th>
@else
  <td
    data-slot="data-table-selection-cell"
    class="lv-table-cell w-[var(--lv-space-9)] px-[var(--lv-space-2)] pr-0 py-[var(--lv-space-3)] align-middle [&:has([role=checkbox])]:pr-0 ${klass}"
    style="border-bottom:1px solid var(--lv-color-border);"
  >
    @template.lievit.checkbox(name = name, value = value, checked = checked, ariaLabel = label, model = model)
  </td>
@endif
