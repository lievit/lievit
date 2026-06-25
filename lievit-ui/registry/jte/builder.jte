<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui builder partial -- a list of HETEROGENEOUS typed blocks (Filament's Builder): unlike the
  repeater (the SAME schema repeated), a builder mixes DIFFERENT block types in one ordered list
  (e.g. a page builder: "heading" | "paragraph" | "image"), chosen from an add-block menu. Each block
  carries its TYPE + its type-specific fields, POSTing as an indexed form-array the server rebuilds
  into an ordered list of typed records.

  TIER: PARTIAL (+ optional enhancer, ADR-0012 server-first). Each block is a card whose fields name
  themselves `<name>[<i>][...]` PLUS a hidden `<name>[<i>][__type]` carrying the block's type, so the
  server knows which record shape each index is. The block BODIES are RECURSIVE content slots the
  adopter authors -- existing blocks via `blocksContent`, and one blank `<template data-builder-template
  ="<type>">` per type (authored in the `templates` slot) for the JS-on clone. So the list POSTs as a
  clean typed indexed array with ZERO JavaScript.

  JS-OFF: the add-block menu is a row of submit buttons, one per type (name=`<name>__addblock`,
  value=type); per-block remove is a submit (name=`<name>__remove`, value=index). Both round-trip to
  the server, which appends the chosen-type block / drops one and re-renders -- a working no-JS path.
  JS-ON the CSP-clean enhancer clones the matching per-type <template> on an add-menu click and drops
  a block on remove, in place, then RE-INDEXES every field name (including `__type`) + label across
  the surviving blocks so the POSTed indices stay contiguous.

  STRUCTURE (scientific decision rule): a JS-only block editor reimplements the cards + the typed
  array plumbing in script and breaks no-JS submit. The hidden `__type` + indexed inputs give the
  typed array POST for free, so they are the base layer; the in-place block editing is an enhancement,
  never the value itself. The recursive content slot keeps it composable (a block body is just more
  lievit fields, like React children), and the per-type template is what makes the blocks
  heterogeneous where the repeater is homogeneous.

  A11y (WAI-ARIA): the list is a labelled <fieldset>/<legend>; the add-block menu is a labelled
  group of real <button>s naming the type they add; each block card is a labelled region
  ("<type label> N"); per-block remove is a labelled <button>; an aria-live region announces changes.

  Params:
    String name                       the field prefix (block fields POST as `<name>[<i>][...]`).
    int count          = 0            how many existing block cards to render.
    java.util.Map<String,String> blockTypes = null  the add-block menu: type key -> button label.
    gg.jte.Content blocksContent      the existing blocks (the adopter loops its records, each a card
                                      built with @@template.lievit.builder.block; uses real indices).
    gg.jte.Content templates          one `<template data-builder-template="<type>">` per type, each a
                                      COMPLETE blank block card (a @@template.lievit.builder.block with
                                      empty values) using the `__i__` index token (JS-on clone).
    String label       = null         visible <legend> for the list.
    String addLabel    = "Add block"  text before the type buttons.
    boolean disabled   = false        disables the controls.
    String cssClass    = ""           extra utility classes on the wrapper.

  Usage:
    @@template.lievit.builder(name = "blocchi", count = pagina.blocchi().size(), label = "Contenuto",
      blockTypes = java.util.Map.of("heading", "Titolo", "paragraph", "Paragrafo"),
      blocksContent = @`... loop the records, each a @@template.lievit.builder.block ...`,
      templates = @`
        <template data-builder-template="heading">@@template.lievit.builder.block(name="blocchi", index=0, type="heading", typeLabel="Titolo",
          content=@`@@template.lievit.input(name="blocchi[__i__][testo]")`)</template>`)
--%>
@import gg.jte.Content
@param String name
@param int count = 0
@param java.util.Map<String, String> blockTypes = null
@param gg.jte.Content blocksContent = null
@param gg.jte.Content templates = null
@param String label = null
@param String addLabel = "Add block"
@param boolean disabled = false
@param String cssClass = ""

!{var hasTypes = blockTypes != null && !blockTypes.isEmpty();}

<fieldset
  data-slot="builder"
  data-controller="lv-builder"
  data-lievit-builder
  data-name="${name}"
  data-disabled="${disabled ? "true" : null}"
  class="m-0 flex min-w-0 flex-col gap-[var(--lv-space-3)] border-0 p-0 ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  @if(label != null && !label.isBlank())
    <legend data-slot="builder-label" class="p-0 text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)]">${label}</legend>
  @endif

  <div data-slot="builder-blocks" data-builder-blocks data-lv-builder-target="blocks" class="flex flex-col gap-[var(--lv-space-3)]">
    @if(blocksContent != null)
      ${blocksContent}
    @endif
  </div>

  <%-- JS-on the enhancer reads these per-type templates and clones the one matching the add menu. --%>
  <div data-slot="builder-templates" data-builder-templates data-lv-builder-target="templates" hidden>
    @if(templates != null)
      ${templates}
    @endif
  </div>

  @if(hasTypes)
    <div data-slot="builder-add-menu" data-builder-add-menu role="group" aria-label="${addLabel}" class="flex flex-wrap items-center gap-[var(--lv-space-2)]">
      <span class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]">${addLabel}:</span>
      @for(java.util.Map.Entry<String, String> type : blockTypes.entrySet())
        <button
          type="submit"
          data-slot="builder-add"
          data-builder-add="${type.getKey()}"
          data-action="click->lv-builder#add"
          name="${name}__addblock"
          value="${type.getKey()}"
          aria-label="${addLabel}: ${type.getValue()}"
          disabled="${disabled}"
          class="inline-flex h-[var(--lv-space-8)] items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] border border-dashed border-[var(--lv-color-input)] bg-transparent px-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] outline-none transition-colors hover:bg-[var(--lv-color-muted)] focus-visible:border-[var(--lv-color-ring)] focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed disabled:opacity-50"
          style="font-family:var(--lv-font-sans);"
        >@template.lievit.icon(name = "plus", size = "0.875rem")${type.getValue()}</button>
      @endfor
    </div>
  @endif

  <span data-slot="builder-live" data-builder-live data-lv-builder-target="live" aria-live="polite" class="sr-only"></span>
</fieldset>
