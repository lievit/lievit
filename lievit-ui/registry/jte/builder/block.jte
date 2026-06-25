<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui builder.block sub-partial -- ONE typed block card inside @@template.lievit.builder. The
  adopter calls this per existing record, passing the field prefix, the block's index + type, and
  the block's body (the recursive content slot of that type's fields). It renders the card chrome
  (the type label + a remove submit) and the hidden `<name>[<i>][__type]` field that tells the server
  which record shape this index is, then drops in the adopter's body.

  TIER: PARTIAL fragment (no JS of its own; the builder enhancer wires add/remove + re-indexing).

  A11y: the card is a labelled region ("<typeLabel> N"); remove is a real <button type=submit> with
  a clear aria-label. The hidden `__type` is form-only (not announced).

  Params:
    String name              the builder field prefix.
    int index                this block's 0-based index (the adopter's real index).
    String type              the block's type key (POSTs as `<name>[<index>][__type]`).
    String typeLabel = null  human label for the card's aria-label / heading; defaults to type.
    gg.jte.Content content   the block body: this type's fields, named `<name>[<index>][...]`.
    boolean disabled = false disables the remove control.

  Usage:
    @@template.lievit.builder.block(name = "blocchi", index = 0, type = "heading", typeLabel = "Titolo",
      content = @`@@template.lievit.input(name = "blocchi[0][testo]", value = b.testo())`)
--%>
@import gg.jte.Content
@param String name
@param int index
@param String type
@param String typeLabel = null
@param gg.jte.Content content = null
@param boolean disabled = false

!{var heading = (typeLabel != null && !typeLabel.isBlank()) ? typeLabel : type;}

<div
  data-slot="builder-block"
  data-builder-block
  data-index="${index}"
  data-type="${type}"
  role="group"
  aria-label="${heading} ${index + 1}"
  class="relative flex flex-col gap-[var(--lv-space-3)] rounded-[var(--lv-radius-lg)] border border-[var(--lv-color-border)] bg-[var(--lv-color-surface)] p-[var(--lv-space-4)] shadow-[var(--lv-shadow-xs)]"
>
  <input type="hidden" data-slot="builder-block-type" data-builder-block-type name="${name}[${index}][__type]" value="${type}">
  <div data-slot="builder-block-header" class="flex items-center justify-between gap-[var(--lv-space-2)]">
    <span data-slot="builder-block-heading" class="text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-muted-fg)]">${heading}</span>
    <button
      type="submit"
      data-slot="builder-remove"
      data-builder-remove
      data-action="click->lv-builder#remove"
      name="${name}__remove"
      value="${index}"
      aria-label="Remove ${heading} ${index + 1}"
      disabled="${disabled}"
      class="inline-flex size-[var(--lv-space-8)] shrink-0 items-center justify-center rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] text-[var(--lv-color-muted-fg)] shadow-[var(--lv-shadow-xs)] outline-none transition-colors hover:text-[var(--lv-color-destructive)] focus-visible:border-[var(--lv-color-ring)] focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed disabled:opacity-50"
    >@template.lievit.icon(name = "trash-2", size = "1rem")</button>
  </div>
  <div data-slot="builder-block-body">
    ${content}
  </div>
</div>
