@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui field/title partial -- shadcn's FieldTitle: a small medium-weight title for a field
  block (e.g. the heading of a switch/checkbox row, or a labelled group inside a Field), distinct
  from the <label for> that names a single control.

  TIER: STATIC presentational -> JTE partial. Pure text, no client state.

  STRUCTURE (scientific decision rule): shadcn's FieldTitle is a w-fit, gap-ed, leading-snug,
  medium-weight text node, dimmed when the enclosing field is disabled
  (group-data-[disabled=true]/field:opacity-50). We reproduce that exactly, token-styled. It is
  NOT a <label for> (use @@template.lievit.label for that): a title heads a region/row, the label
  names a control.

  A11y: plain text. When it titles a group, reference it from the group via aria-labelledby on the
  caller side; it carries no implicit role.

  Params:
    String text     = null        the title text (when no content slot is given).
    gg.jte.Content content = null  rich title content (wins over text).
    String cssClass = ""          extra utility classes on the title.

  Usage:
    @@template.lievit.field.title(text = "Notifications")
--%>
@param String text = null
@param gg.jte.Content content = null
@param String cssClass = ""

<div
  data-slot="field-title"
  class="flex w-fit items-center gap-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] leading-snug font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] group-data-[disabled=true]/field:opacity-50 ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  @if(content != null)${content}@else${text}@endif
</div>
