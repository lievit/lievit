@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui accordion partial -- a vertically stacked set of disclosure items, the server-first,
  zero-JS counterpart of shadcn's Accordion (Radix Accordion a11y) and Filament's accordion layout.

  TIER (planning two-tier model): STATIC presentational -> JTE partial. Each item is a native
  <details>/<summary> that opens + closes itself with ZERO JS, ZERO inline <script>, ZERO inline
  on* handler (strict CSP refuses those) and NO <style> block. The initial open set is a SERVER fact
  (each item's `open` flag, rendered as <details open>); no client state, no lifecycle => no Lit
  island, no wire component. (The INTERACTIVE accordion whose open set is live server state lives in
  registry/wire/accordion as a wire component; this is the presentational layout primitive the
  static schema/infolist render path uses.)

  STRUCTURE (scientific decision rule -- shadcn Accordion + Radix, native <details>): the parent is
  a single bordered surface (data-slot="accordion"); each item is a <details data-slot="accordion-item">
  whose <summary data-slot="accordion-trigger"> carries the label + a chevron, and whose body is a
  <div data-slot="accordion-content"> filled from a Content slot the CALLER owns (the slot-based
  composition, unlike the wire form which owns the markup). Native <button>-equivalent <summary>
  beats a JS height-measure: zero client logic, CSP-clean, cannot fail to project.

  "single" (only one open) is the one behaviour a pure <details> set cannot express without JS; the
  zero-JS escape hatch is the platform's own: give every item the SAME `name` (the HTML `name`
  attribute on <details> makes the browser enforce one-open-at-a-time, no script). Pass `name` on the
  item to opt into single-mode; omit it for multiple (independent) items.

  Chevron rotate-on-open: the strict CSP forbids a <style> block, so the open-state chevron rotation
  is opt-in via ONE adopter stylesheet rule keyed off the platform [open] state (the same opt-in
  pattern scroll-area uses for :hover):
      [data-slot="accordion-item"][open] .lv-accordion-chevron { transform: rotate(180deg); }
  Without it each item still opens + closes; only the glyph stays put.

  A11y (Radix/WAI-ARIA APG accordion): each <summary> is a real disclosure control the platform
  exposes with aria-expanded for free; Enter/Space toggle it; a closed <details> hides its body from
  the a11y tree natively. Native <details> are Tab-reachable, so no key handler is needed.

  Params (parent):
    gg.jte.Content content        the accordion items (compose with @template.lievit.accordion-item).
    String cssClass = ""          extra utility classes on the parent surface.

  Usage:
    @@template.lievit.accordion(content = @@`
      @@template.lievit.accordion-item(label = "Anagrafica", open = true, name = "info",
        content = @@`<p>...</p>`)
      @@template.lievit.accordion-item(label = "Documenti", name = "info", content = @@`<p>...</p>`)
    `)
--%>
@param gg.jte.Content content
@param String cssClass = ""

<div
  data-slot="accordion"
  class="${cssClass}"
  style="overflow: hidden; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); background: var(--lv-color-card); color: var(--lv-color-card-fg); font-family: var(--lv-font-sans);"
>
  ${content}
</div>
