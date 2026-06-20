@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui field/group partial -- shadcn's FieldGroup: the vertical stack that holds a set of
  @@template.field calls (and FieldSeparators), and establishes the container-query context that
  drives a field's "responsive" orientation.

  TIER: STATIC presentational -> JTE partial. Pure layout, no client state. It is the
  `@container/field-group` parent shadcn uses so an inner Field with orientation="responsive"
  flips from stacked to side-by-side at the `@md` breakpoint of THIS group's width (not the
  viewport), so a field group in a narrow column stays stacked.

  STRUCTURE: shadcn's FieldGroup is a `gap`-ed flex column marked `@container/field-group`; the
  responsive Field reads it via `@md/field-group:`. We reproduce that exactly with tokens.

  A11y: a plain grouping wrapper; the grouped controls carry their own labels. For a semantic
  group with a single legend, use @@template.field.set instead.

  Params:
    gg.jte.Content content      the fields (and separators) in this group.
    String cssClass = ""        extra utility classes on the group.

  Usage:
    @@template.field.group(content = @@`
      @@template.field(forId = "first", label = "First name", control = @@`...`)
      @@template.field.separator()
      @@template.field(forId = "last", label = "Last name", control = @@`...`)
    `)
--%>
@param gg.jte.Content content
@param String cssClass = ""

<div
  data-slot="field-group"
  class="@container/field-group flex w-full flex-col gap-[var(--lv-space-6)] ${cssClass}"
>
  ${content}
</div>
