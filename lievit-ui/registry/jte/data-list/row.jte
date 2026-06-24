@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
@import java.util.Map
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui data-list/row partial -- one <li> row of a data-list: an optional leading media slot,
  a left content column, and an optional right actions cluster, vertically centred and wrapping
  gracefully on narrow widths. The row the divided list (data-list.jte) stacks and rules between.

  TIER: STATIC presentational -> JTE partial. Layout + styling only.

  STRUCTURE (scientific decision rule): shadcn's divided-list <li> is a flex row, content growing,
  trailing actions pinned to the end (justify-between); Filament's list rows are the same. We expose
  leading / content / trailing slots like item.jte (the same composability) but as a real <li> with
  role="listitem", since data-list is a true <ul role="list"> (item.jte is a div-based row).

  When href is set the whole tile becomes clickable via a block <a> nested inside the <li>: the <li>
  owns the listitem semantics; the <a> owns the link + focus ring. hoverHighlight adds a subtle
  bg tint on hover so sighted users see the affordance; disable it for non-interactive rows.
  dataAttrs attaches SAFE escaped data-* attributes to the <li> root (key/value pairs from DB,
  each value passed through Escape.htmlAttribute -- never $unsafe with dynamic data).

  A11y: role="listitem" (the parent <ul> is role="list"); hover tint signals an actionable row but
  the affordance is the <a> in the slot or a whole-tile href, not the <li>. Decorative leading icons
  come from the Lucide partial (aria-hidden in their own template); media images carry their own alt.
  The linked <a> gets focus-visible:shadow-[var(--lv-ring)] so the focus ring is visible.

  Params:
    gg.jte.Content content               the main column (name + meta, or any markup).
    gg.jte.Content leading = null        leading media slot (icon, avatar, image, index).
    gg.jte.Content actions = null        trailing actions cluster (badge, buttons, chevron, meta).
    String role            = "listitem"  the row role; override for a non-list context.
    String href            = null        when set, wraps all slots in a block <a> making the tile
                                         a whole-row link; the <a> sits inside the <li>.
    boolean hoverHighlight = true        add a muted-bg hover tint + transition. Disable for purely
                                         static, non-interactive rows.
    String cssClass        = ""          extra utility classes on the <li> root.
    Map<String,String> dataAttrs = {}   SAFE dynamic data-* on the <li> root; each value is HTML-
                                         escaped via Escape.htmlAttribute (never use for static attrs).

  Usage:
    @@template.lievit.data-list.row(
      leading = @@`@@template.lievit.avatar(name = "Mario Rossi")`,
      content = @@`
        <span class="font-[var(--lv-font-medium)]">Mario Rossi</span>
        <span class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]">mario@@example.com</span>
      `,
      actions = @@`@@template.lievit.badge(label = "Attivo", variant = "success")`)

    @@template.lievit.data-list.row(
      href = "/contacts/42",
      content = @@`<span class="font-[var(--lv-font-medium)]">Mario Rossi</span>`,
      dataAttrs = java.util.Map.of("contact-id", contact.id()))
--%>
@param gg.jte.Content content
@param gg.jte.Content leading = null
@param gg.jte.Content actions = null
@param String role = "listitem"
@param String href = null
@param boolean hoverHighlight = true
@param String cssClass = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()

<%-- SAFE dynamic data-* attributes: each value escaped via Escape.htmlAttribute. --%>
!{var _dataAttrs = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    _dataAttrs.writeContent(" data-" + e.getKey() + "=\"");
    Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), _dataAttrs);
    _dataAttrs.writeContent("\"");
}}
!{var _dataAttrsMarkup = _dataAttrs.toString();}

!{var hoverClass = hoverHighlight ? "hover:bg-[var(--lv-color-muted-bg)] transition-colors" : "";}
!{var isLink = href != null;}

@if(isLink)
<li
  data-slot="data-list-row"
  role="${role}"
  class="group/data-list-row flex flex-col p-0 text-[length:var(--lv-text-sm)] ${hoverClass} ${cssClass}"
  $unsafe{_dataAttrsMarkup}
><a href="${href}"
  class="block no-underline flex flex-wrap items-center gap-[var(--lv-space-3)] px-[var(--lv-space-4)] py-[var(--lv-space-3)] text-[var(--lv-color-fg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
>
  @if(leading != null)
    <div data-slot="data-list-row-media" class="flex shrink-0 items-center justify-center gap-[var(--lv-space-2)] [&_svg]:pointer-events-none">
      ${leading}
    </div>
  @endif
  <div data-slot="data-list-row-content" class="flex min-w-0 flex-1 flex-col gap-[var(--lv-space-1)]">
    ${content}
  </div>
  @if(actions != null)
    <div data-slot="data-list-row-actions" class="flex shrink-0 items-center gap-[var(--lv-space-2)]">
      ${actions}
    </div>
  @endif
</a></li>
@else
<li
  data-slot="data-list-row"
  role="${role}"
  class="group/data-list-row flex flex-wrap items-center gap-[var(--lv-space-3)] px-[var(--lv-space-4)] py-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] ${hoverClass} ${cssClass}"
  $unsafe{_dataAttrsMarkup}
>
  @if(leading != null)
    <div data-slot="data-list-row-media" class="flex shrink-0 items-center justify-center gap-[var(--lv-space-2)] [&_svg]:pointer-events-none">
      ${leading}
    </div>
  @endif
  <div data-slot="data-list-row-content" class="flex min-w-0 flex-1 flex-col gap-[var(--lv-space-1)]">
    ${content}
  </div>
  @if(actions != null)
    <div data-slot="data-list-row-actions" class="flex shrink-0 items-center gap-[var(--lv-space-2)]">
      ${actions}
    </div>
  @endif
</li>
@endif
