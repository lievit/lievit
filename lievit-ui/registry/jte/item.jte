@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui item partial (v-next) -- a generic list/menu row with a leading media slot,
  a primary content column, and a trailing actions slot.

  TIER: STATIC presentational -> JTE partial. The row is layout + styling; any interactivity
  (a clickable row, a menu item with keyboard nav) is the adopter's <a>/<button> or a Lit
  menu island. This is shadcn's Item (the composable row), not a stateful control.

  STRUCTURE: three slot regions exposed as Content params (leading / content / trailing).
  The root element is selectable via the `element` param (li | dd | dt | div). Classes are
  computed once into local vars; all element branches reuse the same class string.

  VARIANT (v-next vocabulary -- BREAKING from v0.x):
    default   text-fg, transparent bg, hover to accent fill
    active    accent fill, accent-fg text (the currently selected row)
    danger    destructive text, hover to destructive fill
    muted     muted-fg text, transparent bg (no hover tint)
  Old `outline` variant removed; `active` added; `danger` replaces nothing (was caller's job).

  SIZE (v-next vocabulary -- BREAKING from v0.x):
    sm   min-h-space-8,  text-xs
    md   min-h-space-9,  text-sm  (default)
    lg   min-h-space-10, text-base
  Old `default` / `sm` vocab replaced with sm/md/lg to match the control height scale.

  DISABLED: dims via opacity-50 + pointer-events-none. No aria-disabled on a
  non-interactive element (the adopter's inner <a>/<button> owns its own disabled state).

  EXTRA ATTRIBUTES -- two channels, by trust (same XSS contract as button.jte):
    attrs     (TRUSTED, raw $unsafe) -- STATIC author-typed strings only.
    dataAttrs (SAFE, escaped)        -- Map<String,String> of dynamic data-* attributes,
                                       each value escaped via Escape.htmlAttribute.

  A11y: the row itself is not interactive; focus-visible ring fires only if the element
  can receive focus (e.g. div[tabindex=0]). The leading/trailing slots carry aria-hidden
  so decorative icons are invisible to AT; the content slot owns the accessible label.

  Params:
    gg.jte.Content content              REQUIRED: the item's primary label text or richer markup.
    gg.jte.Content leading = null       optional slot: leading icon/avatar (aria-hidden wrapper).
    gg.jte.Content trailing = null      optional slot: badge/count/chevron (aria-hidden wrapper).
    String element  = "li"             root element: "li" | "dd" | "dt" | "div".
    String variant  = "default"        "default" | "active" | "danger" | "muted".
    String size     = "md"             "sm" | "md" | "lg".
    boolean disabled = false           dims + disables pointer events.
    String cssClass = ""               extra utility classes on the root.
    String attrs    = ""               TRUSTED raw ($unsafe) -- STATIC strings only.
    Map<String,String> dataAttrs = {}  SAFE dynamic data-* (Escape.htmlAttribute on each value).

  Usage:
    @@template.lievit.item(content = @@`Contratti`)
    @@template.lievit.item(variant = "active", content = @@`Selezionato`)
    @@template.lievit.item(
      element = "li",
      variant = "default",
      size = "md",
      leading = @@`@@template.lievit.icon(name = "folder", size = "1rem")`,
      content = @@`<span>Contratti</span>`,
      trailing = @@`@@template.lievit.icon(name = "chevron-right", size = "1rem")`
    )
    @@template.lievit.item(variant = "danger", content = @@`Elimina`)
    @@template.lievit.item(disabled = true, content = @@`Non disponibile`)
--%>
@param gg.jte.Content content
@param gg.jte.Content leading = null
@param gg.jte.Content trailing = null
@param String element = "li"
@param String variant = "default"
@param String size = "md"
@param boolean disabled = false
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()

!{var variantClass = switch (variant) {
    case "active"  -> "bg-[var(--lv-color-accent)] text-[var(--lv-color-accent-fg)]";
    case "danger"  -> "text-[var(--lv-color-destructive)] hover:bg-[var(--lv-color-destructive)] hover:text-[var(--lv-color-destructive-fg)]";
    case "muted"   -> "text-[var(--lv-color-muted-fg)] bg-transparent";
    default        -> "text-[var(--lv-color-fg)] bg-transparent hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)]";
  };}
!{var sizeClass = switch (size) {
    case "sm" -> "min-h-[var(--lv-space-8)] text-[length:var(--lv-text-xs)] px-[var(--lv-space-3)] gap-[var(--lv-space-2)]";
    case "lg" -> "min-h-[var(--lv-space-10)] text-[length:var(--lv-text-base)] px-[var(--lv-space-3)] gap-[var(--lv-space-2)]";
    default   -> "min-h-[var(--lv-space-9)] text-[length:var(--lv-text-sm)] px-[var(--lv-space-3)] gap-[var(--lv-space-2)]";
  };}
!{var disabledClass = disabled ? " opacity-50 pointer-events-none" : "";}
!{var base = "flex items-center w-full rounded-[var(--lv-radius-md)] font-[var(--lv-font-sans)] transition-colors outline-none focus-visible:shadow-[var(--lv-ring)]";}
!{var fullClass = base + " " + sizeClass + " " + variantClass + disabledClass + " " + cssClass;}

<%-- SAFE dynamic data-* attributes: each value escaped via Escape.htmlAttribute. --%>
!{var dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), dataAttrs_);
      dataAttrs_.writeContent("\"");
    }
  }}
!{var dataAttrsMarkup = dataAttrs_.toString();}

@if("li".equals(element))
<li
  data-slot="item"
  data-variant="${variant}"
  data-size="${size}"
  class="${fullClass}"
  $unsafe{dataAttrsMarkup}
  $unsafe{attrs}
>@if(leading != null)<span data-slot="item-leading" aria-hidden="true">${leading}</span>@endif<span data-slot="item-content" class="flex-1 min-w-0 truncate">${content}</span>@if(trailing != null)<span data-slot="item-trailing" aria-hidden="true">${trailing}</span>@endif</li>
@elseif("dd".equals(element))
<dd
  data-slot="item"
  data-variant="${variant}"
  data-size="${size}"
  class="${fullClass}"
  $unsafe{dataAttrsMarkup}
  $unsafe{attrs}
>@if(leading != null)<span data-slot="item-leading" aria-hidden="true">${leading}</span>@endif<span data-slot="item-content" class="flex-1 min-w-0 truncate">${content}</span>@if(trailing != null)<span data-slot="item-trailing" aria-hidden="true">${trailing}</span>@endif</dd>
@elseif("dt".equals(element))
<dt
  data-slot="item"
  data-variant="${variant}"
  data-size="${size}"
  class="${fullClass}"
  $unsafe{dataAttrsMarkup}
  $unsafe{attrs}
>@if(leading != null)<span data-slot="item-leading" aria-hidden="true">${leading}</span>@endif<span data-slot="item-content" class="flex-1 min-w-0 truncate">${content}</span>@if(trailing != null)<span data-slot="item-trailing" aria-hidden="true">${trailing}</span>@endif</dt>
@else
<div
  data-slot="item"
  data-variant="${variant}"
  data-size="${size}"
  class="${fullClass}"
  $unsafe{dataAttrsMarkup}
  $unsafe{attrs}
>@if(leading != null)<span data-slot="item-leading" aria-hidden="true">${leading}</span>@endif<span data-slot="item-content" class="flex-1 min-w-0 truncate">${content}</span>@if(trailing != null)<span data-slot="item-trailing" aria-hidden="true">${trailing}</span>@endif</div>
@endif
