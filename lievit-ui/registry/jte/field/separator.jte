<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui field/separator partial -- shadcn's FieldSeparator: a divider between fields in a
  FieldGroup, optionally with a centred inline label ("or", "and").

  TIER: STATIC presentational -> JTE partial. Pure layout, no client state.

  STRUCTURE: shadcn's FieldSeparator is a Separator with optional centred children. We render the
  same role="separator" rule (token-coloured) and, when a label is given, overlay it centred on a
  background chip so the line reads as broken by the word.

  A11y (WAI-ARIA separator): role="separator" + aria-orientation="horizontal"; when a label is
  shown it is decorative text, the separator role still carries the grouping semantics.

  Params:
    String label   = null       optional centred inline text (e.g. "or").
    String cssClass = ""        extra utility classes on the wrapper.

  Usage:
    @@template.lievit.field.separator()
    @@template.lievit.field.separator(label = "or")
--%>
@param String label = null
@param String cssClass = ""

!{var hasLabel = label != null && !label.isBlank();}

<div
  data-slot="field-separator"
  role="separator"
  aria-orientation="horizontal"
  class="relative flex h-[var(--lv-space-2)] items-center ${cssClass}"
>
  <span aria-hidden="true" class="h-px w-full bg-[var(--lv-color-border)]"></span>
  @if(hasLabel)
    <span data-slot="field-separator-content" class="absolute left-1/2 -translate-x-1/2 bg-[var(--lv-color-bg)] px-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]" style="font-family:var(--lv-font-sans);">${label}</span>
  @endif
</div>
