<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui repeater partial -- a repeatable list of NESTED-SCHEMA item cards (Filament's Repeater):
  the same set of fields repeated N times (e.g. "phone numbers", "tenants", "documents"), each in a
  card with add / remove (and optional reorder). The fields inside each item POST as an INDEXED
  form-array so the server rebuilds an ordered list of records.

  TIER: PARTIAL (+ optional enhancer, ADR-0012 server-first). The item BODY is a recursive content
  slot the adopter authors (`itemContent`), so a repeater item can itself contain any field -- inputs,
  a select, even another repeater. The adopter names the fields inside with the `__i__` index token
  (`<name>[__i__][campo]`), which the server stamps to the real index per existing item and the
  enhancer re-stamps on add. So the rows POST as a clean indexed array with ZERO JavaScript.

  JS-OFF: add is an explicit "Add" submit (name=`<name>__add`) and per-item remove is a submit
  (name=`<name>__remove`, value=index) that round-trip to the server, which re-renders with one more /
  fewer card -- a working no-JS path. JS-ON the CSP-clean `lv-repeater` Stimulus controller clones
  the hidden <template> item to add and drops a card to remove, in place, then RE-INDEXES every field
  name + label inside the surviving cards so the POSTed indices stay contiguous. Reorder is a deliberate FOLLOW-UP (the grip
  handle + data-slot are rendered now so it can be wired without re-templating).

  STRUCTURE (scientific decision rule): a JS-only repeater reimplements the cards + the array
  plumbing in script and breaks no-JS submit. Native indexed inputs give the array POST for free, so
  they are the base layer; the card editing is an enhancement, never the value itself. The recursive
  content slot keeps the layer composable (an item is just more lievit fields), the same shape as a
  React component taking `children`.

  A11y (WAI-ARIA): the list is a labelled <fieldset>/<legend>; each item card is a labelled region
  (aria-label "Item N") so AT can navigate items; add + per-item remove are real <button>s with
  clear labels; an aria-live region announces add/remove. `disabled` disables the controls.

  Params:
    String name                       the field prefix (item fields POST as `<name>[<i>][...]`).
    int count          = 0            how many existing item cards to render.
    gg.jte.Content itemContent        the recursive item BODY, repeated per index (uses `__i__` for
                                      the index token in the field names the adopter writes).
    gg.jte.Content itemTemplate = null  the BLANK item body for the JS-on clone; defaults to
                                      itemContent if not given (same fields, empty values).
    String label       = null         visible <legend> for the list.
    String itemLabel   = "Item"       per-card aria-label stem ("Item 1", "Item 2", ...).
    String addLabel    = "Add"        the add button text.
    boolean reorderable = false       render the drag grip handle (reorder wiring is a follow-up).
    boolean disabled   = false        disables the controls.
    String cssClass    = ""           extra utility classes on the wrapper.

  Usage:
    @@template.lievit.repeater(name = "telefoni", count = contatto.telefoni().size(), label = "Telefoni",
      itemContent = @`
        @@for(var t : contatto.telefoni())
          @@template.lievit.input(name = "telefoni[" + t.index() + "][numero]", value = t.numero())
        @@endfor`,
      itemTemplate = @`@@template.lievit.input(name = "telefoni[__i__][numero]")`)
--%>
@import gg.jte.Content
@param String name
@param int count = 0
@param gg.jte.Content itemContent = null
@param gg.jte.Content itemTemplate = null
@param String label = null
@param String itemLabel = "Item"
@param String addLabel = "Add"
@param boolean reorderable = false
@param boolean disabled = false
@param String cssClass = ""

!{var cardClass = "relative flex flex-col gap-[var(--lv-space-3)] rounded-[var(--lv-radius-lg)] border border-[var(--lv-color-border)] bg-[var(--lv-color-surface)] p-[var(--lv-space-4)] shadow-[var(--lv-shadow-xs)]";}
!{var iconBtnClass = "inline-flex size-[var(--lv-space-8)] shrink-0 items-center justify-center rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] text-[var(--lv-color-muted-fg)] shadow-[var(--lv-shadow-xs)] outline-none transition-colors focus-visible:border-[var(--lv-color-ring)] focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed disabled:opacity-50";}

<fieldset
  data-slot="repeater"
  data-controller="lv-repeater"
  data-lievit-repeater
  data-name="${name}"
  data-reorderable="${reorderable ? "true" : null}"
  data-disabled="${disabled ? "true" : null}"
  class="m-0 flex min-w-0 flex-col gap-[var(--lv-space-3)] border-0 p-0 ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  @if(label != null && !label.isBlank())
    <legend data-slot="repeater-label" class="p-0 text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)]">${label}</legend>
  @endif

  <div data-slot="repeater-items" data-repeater-items data-lv-repeater-target="items" class="flex flex-col gap-[var(--lv-space-3)]">
    @for(int i = 0; i < count; i++)
      <div data-slot="repeater-item" data-repeater-item data-index="${i}" role="group" aria-label="${itemLabel} ${i + 1}" class="${cardClass}">
        <div data-slot="repeater-item-header" class="flex items-center justify-between gap-[var(--lv-space-2)]">
          @if(reorderable)
            <button type="button" data-slot="repeater-reorder" data-repeater-reorder aria-label="Reorder ${itemLabel} ${i + 1}" disabled="${disabled}" class="${iconBtnClass} cursor-grab">@template.lievit.icon(name = "grip-vertical", size = "1rem")</button>
          @else
            <span></span>
          @endif
          <button type="submit" data-slot="repeater-remove" data-repeater-remove data-action="click->lv-repeater#remove" name="${name}__remove" value="${i}" aria-label="Remove ${itemLabel} ${i + 1}" disabled="${disabled}" class="${iconBtnClass} hover:text-[var(--lv-color-destructive)]">@template.lievit.icon(name = "trash-2", size = "1rem")</button>
        </div>
        <div data-slot="repeater-item-body">
          ${itemContent}
        </div>
      </div>
    @endfor
  </div>

  <%-- JS-on the controller clones this hidden template item (the `__i__` token is re-stamped on add). --%>
  <template data-repeater-template data-lv-repeater-target="template">
    <div data-slot="repeater-item" data-repeater-item data-index="__i__" role="group" aria-label="${itemLabel} __label__" class="${cardClass}">
      <div data-slot="repeater-item-header" class="flex items-center justify-between gap-[var(--lv-space-2)]">
        @if(reorderable)
          <button type="button" data-slot="repeater-reorder" data-repeater-reorder aria-label="Reorder ${itemLabel} __label__" class="${iconBtnClass} cursor-grab">@template.lievit.icon(name = "grip-vertical", size = "1rem")</button>
        @else
          <span></span>
        @endif
        <button type="button" data-slot="repeater-remove" data-repeater-remove data-action="click->lv-repeater#remove" aria-label="Remove ${itemLabel} __label__" class="${iconBtnClass} hover:text-[var(--lv-color-destructive)]">@template.lievit.icon(name = "trash-2", size = "1rem")</button>
      </div>
      <div data-slot="repeater-item-body">
        @if(itemTemplate != null)${itemTemplate}@else${itemContent}@endif
      </div>
    </div>
  </template>

  <div>
    <button
      type="submit"
      data-slot="repeater-add"
      data-repeater-add
      data-action="click->lv-repeater#add"
      name="${name}__add"
      value="1"
      disabled="${disabled}"
      class="inline-flex h-[var(--lv-space-9)] items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] border border-dashed border-[var(--lv-color-input)] bg-transparent px-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] outline-none transition-colors hover:bg-[var(--lv-color-muted)] focus-visible:border-[var(--lv-color-ring)] focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed disabled:opacity-50"
      style="font-family:var(--lv-font-sans);"
    >@template.lievit.icon(name = "plus", size = "1rem")${addLabel}</button>
  </div>

  <span data-slot="repeater-live" data-repeater-live data-lv-repeater-target="live" aria-live="polite" class="sr-only"></span>
</fieldset>
