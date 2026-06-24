@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui hover-card-trigger partial -- the trigger wrapper for a hover-card panel.

  TIER: PARTIAL + ENH (hover-card.enhancer.ts). This wrapper emits the trigger element plus
  the ARIA and data-attribute wiring the enhancer needs to show/hide the matching hover-card
  panel. The trigger wrapper is a separate partial from hover-card.jte because the two may
  appear in different parts of the page template (e.g. a table row trigger + a card panel
  rendered once per row), so they cannot be co-located in one template call.

  STRUCTURE (scientific decision rule): WAI-ARIA APG Tooltip pattern
  (https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/). The trigger wrapper carries
  aria-describedby pointing at the card panel id -- emitted unconditionally by the server so
  keyboard/SR users receive the description on focus without requiring JS. The wrapper itself
  has no role or tabindex; the semantic interaction affordances belong to the trigger content
  the adopter supplies (an <a>, <button>, or <span tabindex="0">). CSS Anchor Positioning
  (anchor-name on the wrapper style) is the shared popover seam that the card panel's
  position-anchor references for placement.

  A11y (WAI-ARIA APG Tooltip):
  - aria-describedby="${cardId}" on the wrapper span is server-rendered and unconditional.
  - The trigger content (supplied via the content slot) is the focusable element; the wrapper
    adds no tabindex or role.
  - data-lv-hover-card-trigger is the enhancer mount hook.
  - openOnFocus stamped as data-open-on-focus="true|false" (string, not a presence attribute)
    so it survives morph identity (the enhancer reads it as a string check).
  - The anchor-name CSS custom property is set inline on the wrapper style; it is a server-
    authored string derived from cardId, not user-supplied data, so it is safe in style.

  EXTRA ATTRIBUTES -- two channels, by trust (the XSS decision rule):
    * attrs (TRUSTED, raw) -- $unsafe, STATIC author-typed strings only (analytics data-*,
      extra aria attributes). NEVER interpolate a per-row DB-derived value into attrs.
    * dataAttrs (SAFE, escaped) -- Map<String,String> of dynamic data-* attributes. Each entry
      renders as data-<key>="<escaped-value>". Per-row entity ids or context values go here.

  Params:
    String             cardId        REQUIRED. The id of the matching hover-card panel.
                                     Applied as aria-describedby and data-card-id.
    int                delay         = 300  Hover open-delay in ms (prevents flickering).
    int                closeDelay    = 150  Hover close-delay in ms (grace while cursor travels).
    boolean            openOnFocus   = true When true, keyboard focus also opens the card.
    String             cssClass      = ""   Extra utility classes on the trigger wrapper span.
    String             attrs         = ""   TRUSTED raw ($unsafe) -- STATIC strings only.
    Map<String,String> dataAttrs     = {}   SAFE dynamic data-* (value via Escape.htmlAttribute).
    gg.jte.Content     content       REQUIRED. The trigger element (a link, avatar, button...).

  Usage:
    @@template.lievit.hover-card-trigger(
        cardId = "u-ada-card",
        content = @@`<a href="/u/ada">Ada Lovelace</a>`
    )
    @@template.lievit.hover-card-trigger(
        cardId = "u-ada-card",
        delay = 200,
        closeDelay = 100,
        openOnFocus = true,
        dataAttrs = java.util.Map.of("entity-id", user.id()),
        content = @@`<button type="button" aria-label="${user.name()}">@@template.lievit.avatar(name = user.name())</button>`
    )
--%>
@param String cardId
@param int delay = 300
@param int closeDelay = 150
@param boolean openOnFocus = true
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()
@param gg.jte.Content content

<%-- CSS Anchor Positioning: anchor-name links this wrapper to the card panel's position-anchor.
     The ident is derived from cardId (server-authored, not user-supplied). --%>
!{var anchorName = "--hc-" + cardId;}

<%-- SAFE dynamic data-* attributes: each value escaped via Escape.htmlAttribute. JTE's HTML
     parser forbids a raw @for in attribute-NAME position, so we build the fragment once here.
     Keys must be simple identifiers ([A-Za-z][A-Za-z0-9-]*); a non-identifier key is dropped. --%>
!{var dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), dataAttrs_);
      dataAttrs_.writeContent("\"");
    }
  }}
!{var dataAttrsMarkup = dataAttrs_.toString();}

<span
  data-slot="hover-card-trigger"
  data-lv-hover-card-trigger
  data-card-id="${cardId}"
  data-delay="${delay}"
  data-close-delay="${closeDelay}"
  data-open-on-focus="${openOnFocus}"
  aria-describedby="${cardId}"
  class="relative inline-flex ${cssClass}"
  style="anchor-name:${anchorName};"
  $unsafe{dataAttrsMarkup}
  $unsafe{attrs}
>${content}</span>
