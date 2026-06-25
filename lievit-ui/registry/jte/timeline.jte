@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui timeline partial -- a vertical event timeline (Ant Design Timeline parity).

  TIER: PARTIAL presentational -> JTE partial (ADR-0012). Zero client state; the server renders an
  ordered list of events. Zero JS, zero enhancer, CSP-clean.

  STRUCTURE (scientific decision rule):
    Ant's Timeline is a vertical sequence of dated events with coloured nodes. The semantic shape
    is an ordered list (<ol>) -- the events have a sequence -- with each timeline.item a list item
    carrying a dot, the connector line, and the event content. The wrapper is a thin <ol>; the
    caller composes timeline.item children into the content slot (same composition model as
    accordion). The connector line is drawn by each item (suppressed on the last) so the wrapper
    stays a pure container.
    Inventory reference: Ant Design Timeline. Original generation over --lv-* tokens; no Ant code copied.

  A11y: a native <ol> conveys the ordered-sequence semantics; each item is an <li>. No ARIA needed;
    no focus management (a timeline is read-only content).

  Params:
    gg.jte.Content content              the timeline.item children.
    boolean reverse = false             render newest-first (CSS column-reverse); the markup order
                                        is unchanged so AT still reads source order.
    String cssClass = ""                extra utility classes on the root.
    String attrs    = ""                TRUSTED raw ($unsafe) -- STATIC author-typed strings only.

  Usage:
    @@template.lievit.timeline(content = @@`
      @@template.lievit.timeline.item(color = "success", label = "10:00",
          content = @@`Order created`)
      @@template.lievit.timeline.item(color = "info", label = "10:05",
          content = @@`Payment received`)
      @@template.lievit.timeline.item(last = true, content = @@`Shipped`)
    `)
--%>
@param gg.jte.Content content
@param boolean reverse = false
@param String cssClass = ""
@param String attrs = ""

<ol
  data-slot="timeline"
  data-reverse="${reverse ? "true" : null}"
  class="m-0 list-none p-0 ${reverse ? "flex flex-col-reverse" : "flex flex-col"} ${cssClass}"
  style="font-family:var(--lv-font-sans);"
  $unsafe{attrs}
>${content}</ol>
