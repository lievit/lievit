@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui loading-section partial -- a centred loading placeholder for a whole region while its
  real content is fetched: a spinner with an optional label below it, framed in a token-styled box.
  The Filament `loading-section` equivalent: where the spinner is the bare busy glyph and the
  skeleton mimics the shape of incoming content, this is the COMPOSITION that fills a section /
  panel / card body with "loading ..." (a centred spinner + caption), the piece lievit-ui was
  missing (it shipped a spinner but no section-loading composition).

  TIER (planning two-tier model): STATIC presentational -> JTE partial. Pure layout that COMPOSES
  the lievit-ui spinner primitive; no client state, no lifecycle => not a Lit island, not a wire
  component. A host swaps it for the real content once loaded (htmx target / wire morph): this is
  the placeholder, not the loader logic.

  STRUCTURE (scientific decision rule): a flex column, centred both axes, min-height so the box
  reserves space (no layout jump when the content lands). The spinner carries role=status +
  aria-label, so assistive tech already announces the busy state; the optional caption is a muted
  line under it. The whole box is aria-busy so a screen reader knows the region is loading.

  TOKEN FIDELITY: padding + gap read the space scale, the caption reads --lv-color-muted-fg, the
  optional border reads --lv-color-border / --lv-radius-lg; a retheme respaces + retints with the
  tokens, no markup edit.

  A11y (WAI-ARIA): the container is aria-busy="true" + aria-live="polite" so the loading state is
  announced; the composed spinner owns role="status". The caption is plain muted text.

  Params:
    String label    = "Loading"   the accessible spinner label AND the visible caption when shown.
    boolean caption = true         render the visible caption line under the spinner.
    String size     = "md"         the spinner size ("sm" | "md").
    boolean bordered = false       frame the box with a token border + radius (a card-like region).
    String minHeight = "12rem"     the reserved height so the box does not collapse / jump.
    String cssClass = ""           extra utility classes on the box root.

  Usage:
    @@template.lievit.loading-section()
    @@template.lievit.loading-section(label = "Loading contacts", bordered = true)
    @@template.lievit.loading-section(caption = false, size = "sm", minHeight = "6rem")
--%>
@param String label = "Loading"
@param boolean caption = true
@param String size = "md"
@param boolean bordered = false
@param String minHeight = "12rem"
@param String cssClass = ""

!{var frame = bordered ? "border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-lg);" : "";}

<div
  data-slot="loading-section"
  role="status"
  aria-busy="true"
  aria-live="polite"
  aria-label="${label}"
  class="flex flex-col items-center justify-center text-center ${cssClass}"
  style="gap: var(--lv-space-3); padding: var(--lv-space-6); min-height: ${minHeight}; font-family: var(--lv-font-sans); ${frame}"
>
  @template.lievit.spinner(size = size, label = label)
  @if(caption)
    <span data-slot="loading-section-caption" style="font-size: var(--lv-text-sm); color: var(--lv-color-muted-fg);">${label}</span>
  @endif
</div>
