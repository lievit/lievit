@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui field/set partial -- shadcn's FieldSet + FieldLegend: a semantic <fieldset> grouping
  several related fields (or radio/checkbox options) under one <legend>, with an optional muted
  description.

  TIER: STATIC presentational -> JTE partial. Pure layout, no client state.

  STRUCTURE (scientific decision rule): a real native <fieldset> + <legend> is the platform group
  primitive (the same call radio-group makes). shadcn renders FieldSet as a <fieldset> with a
  FieldLegend and a FieldGroup of inner fields; we reproduce that with the native elements so the
  group name is announced for free and the disabled attribute cascades to every nested control.

  A11y (WAI-ARIA grouping): native <fieldset> with a <legend> names the group; assistive tech
  announces the legend with each contained control. The optional description sits below the
  legend and is referenced by the controls' own descriptions, not the fieldset.

  Params:
    String legend   = null      visible <legend> text naming the group.
    String description = null   muted helper text below the legend.
    boolean disabled = false    native fieldset disable: cascades to every nested control.
    gg.jte.Content content      the grouped fields (usually wrapped in @@template.field.group).
    String cssClass = ""        extra utility classes on the fieldset.

  Usage:
    @@template.field.set(legend = "Address", description = "Where do we ship?", content = @@`
      @@template.field.group(content = @@`
        @@template.field(forId = "street", label = "Street", control = @@`...`)
        @@template.field(forId = "city", label = "City", control = @@`...`)
      `)
    `)
--%>
@param String legend = null
@param String description = null
@param boolean disabled = false
@param gg.jte.Content content
@param String cssClass = ""

!{var hasDesc = description != null && !description.isBlank();}

<fieldset
  data-slot="field-set"
  disabled="${disabled}"
  class="m-0 flex min-w-0 flex-col gap-[var(--lv-space-4)] border-0 p-0 ${cssClass}"
>
  @if(legend != null && !legend.isBlank())
    <legend data-slot="field-legend" class="float-left mb-[var(--lv-space-1)] w-full p-0 text-[length:var(--lv-text-base)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)]" style="font-family:var(--lv-font-sans);">${legend}</legend>
  @endif
  @if(hasDesc)
    <p data-slot="field-set-description" class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]" style="font-family:var(--lv-font-sans);">${description}</p>
  @endif
  ${content}
</fieldset>
