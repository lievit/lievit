@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui description-list/item partial -- one label->value row of a description-list: a <dt>
  term + a <dd> definition, stacked. The unit the kit's AdminViewView.Section entries
  (label -> display string) and Filament's infolist entry-wrapper map onto.

  TIER: STATIC presentational -> JTE partial. Pure layout; `term` is plain text (a humanized
  attribute label), `content` is the already-projected value markup (a string, a badge, a swatch).

  STRUCTURE (scientific decision rule): the semantic pair is <dt> (term) + <dd> (definition); both
  must be direct children of the <dl> for the native association, so this partial emits them as a
  sibling pair (NO wrapping element between the <dl> and its dt/dd). The term sits above the value
  (Filament's stacked entry-wrapper); use the parent description-list `columns` for the multi-column
  grid. An entry may span more columns via columnSpan (the kit Entry.columnSpan), applied to BOTH
  the dt and dd so the pair stays a grid cell-pair.

  A11y: native <dt>/<dd> association; the term labels the value with no extra ARIA. `content` may be
  an infolist-entry (a badge / swatch / icon), which carries its own semantics.

  Params:
    String term                   the label (a humanized attribute name).
    gg.jte.Content content        the value markup (string, badge, infolist-entry...).
    int columnSpan  = 1           parent grid columns this pair spans (the kit Entry.columnSpan).
    String cssClass = ""          extra utility classes on the <dd> value.

  Usage:
    @@template.lievit.description-list.item(term = "Email", content = @@`mario@@example.com`)
    @@template.lievit.description-list.item(term = "Stato", content = @@`@@template.lievit.badge(label = "Attivo", variant = "success")`)
    @@template.lievit.description-list.item(term = "Note", columnSpan = 2, content = @@`Cliente storico.`)
--%>
@param String term
@param gg.jte.Content content
@param int columnSpan = 1
@param String cssClass = ""

!{var span = Math.max(1, columnSpan);}
!{var spanStyle = span > 1 ? "grid-column:span " + span + " / span " + span + ";" : "";}

<dt
  data-slot="description-list-term"
  class="text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-muted-fg)]"
  style="${spanStyle}"
>${term}</dt>
<dd
  data-slot="description-list-value"
  class="m-0 mb-[var(--lv-space-1)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] ${cssClass}"
  style="${spanStyle}"
>${content}</dd>
