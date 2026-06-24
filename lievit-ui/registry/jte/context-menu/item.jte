@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui context-menu/item partial -- one actionable row of a context-menu (WAI-ARIA APG Menu,
  server-first, no JS). Renders a real <button> with the correct role override. Items are OWNED
  markup composed into the context-menu content slot; activation drives a wire action (l:click)
  or navigates (href).

  TIER: STATIC presentational -> JTE partial. Platform gives keyboard + click for free.

  STRUCTURE (WAI-ARIA APG Menu, verified 2026-06-24):
    - ACTION items: role="menuitem" on a real <button> (platform: Enter/Space activate).
    - CHECKBOX items: role="menuitemcheckbox" aria-checked; a leading indicator column shows a
      check glyph when checked (inlined SVG, no cross-partial dependency) and reserves space when
      unchecked so items align (the shadcn ItemIndicator discipline).
    - RADIO items: role="menuitemradio" aria-checked; indicator column shows a filled circle dot.
    - Disabled items: aria-disabled="true" on the <button> (item stays in a11y tree; collection-nav
      skips it for roving); native disabled also set so the platform blocks click activation.
    - Danger items: data-danger="true" data-variant="destructive" tints text/icon with the
      --lv-color-destructive token; no ARIA change (visual only per spec).
    - Shortcut hint: aria-hidden decorative text + aria-keyshortcuts on the item (AT knows about
      the binding); shortcut is display-only, actual binding is the adopter's concern.
    - Icon: @template.lievit.icon (name/size/cssClass/label params only; aria-hidden by default).
    - SUBMENU trigger: the caller passes the nested context-menu partial as content and sets
      type="submenu"; the item gains aria-haspopup="menu" + aria-expanded + aria-controls.

  A11y: real <button> per role; aria-disabled on disabled; aria-checked on checkbox/radio;
  aria-keyshortcuts on shortcut; aria-haspopup + aria-expanded + aria-controls on submenu trigger.

  WIRE ACTION -- the SAFE per-row channel (mirrors button.jte and dropdown-menu/item.jte):
    wireClick (SAFE) -- l:click="${wireClick}" on the item when set.
    wireArgs  (SAFE) -- Map of String to String, each value HTML-escaped via Escape.htmlAttribute,
                        emitted as data-key="value". Use for per-row DB-derived arguments.
  For static wire directives use the trusted attrs channel ($unsafe, author-typed strings only).

  Params:
    String  label                the visible item label (required).
    String  type     = "action"  "action" | "checkbox" | "radio" | "submenu"
    String  variant  = "default" "default" | "destructive"
    boolean checked  = false     checked state for checkbox/radio (aria-checked)
    boolean disabled = false     dims + disables; aria-disabled="true"; collection-nav skips it
    String  icon     = ""        optional Lucide icon name (rendered via @template.lievit.icon)
    String  shortcut = ""        optional keyboard shortcut hint (display + aria-keyshortcuts)
    String  href     = ""        when set, renders an <a href> instead of a <button>
    String  submenuId = ""       id of the nested context-menu panel (for type="submenu")
    boolean submenuOpen = false  open state of the nested submenu (for type="submenu")
    String  cssClass = ""        extra utility classes on the item element
    String  attrs    = ""        TRUSTED raw attribute string ($unsafe, static author strings only)
    Map<String,String> wireArgs = {}  SAFE per-row args; each value HTML-escaped, key w/o "data-"
    String  wireClick = null     SAFE wire action name; emitted as l:click="${wireClick}" when set

  Usage:
    @template.lievit.context-menu.item(label = "Rename", icon = "pencil",
        attrs = "l:click=\"rename\"")
    @template.lievit.context-menu.item(label = "Delete", icon = "trash-2", variant = "destructive",
        wireClick = "deleteRow", wireArgs = java.util.Map.of("id", row.id()))
    @template.lievit.context-menu.item(label = "Starred", type = "checkbox", checked = ${starred},
        attrs = "l:click=\"toggleStar\"")
--%>
@param String label
@param String type = "action"
@param String variant = "default"
@param boolean checked = false
@param boolean disabled = false
@param String icon = ""
@param String shortcut = ""
@param String href = ""
@param String submenuId = ""
@param boolean submenuOpen = false
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> wireArgs = java.util.Map.of()
@param String wireClick = null
!{var isCheckbox = "checkbox".equals(type);}
!{var isRadio = "radio".equals(type);}
!{var isSubmenu = "submenu".equals(type);}
!{var isCheckable = isCheckbox || isRadio;}
!{var role = isCheckbox ? "menuitemcheckbox" : (isRadio ? "menuitemradio" : "menuitem");}
!{var isDestructive = "destructive".equals(variant);}
!{var itemColor = isDestructive ? "var(--lv-color-destructive)" : "var(--lv-color-fg)";}
!{var wire = wireClick != null && !wireClick.isBlank() ? wireClick : null;}
<%-- SAFE per-row wire arguments: values escaped via Escape.htmlAttribute, then emitted $unsafe. --%>
!{var wireArgs_ = new StringOutput();}
!{for (var e : wireArgs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      wireArgs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), wireArgs_);
      wireArgs_.writeContent("\"");
    }
  }}
!{var wireArgsMarkup = wireArgs_.toString();}
@if(!href.isEmpty())
<a
  href="${href}"
  role="${role}"
  data-slot="context-menu-item"
  data-lievit-item
  data-variant="${isDestructive ? "destructive" : null}"
  data-danger="${isDestructive ? "true" : null}"
  aria-disabled="${disabled ? "true" : null}"
  aria-checked="${isCheckable ? (checked ? "true" : "false") : null}"
  aria-haspopup="${isSubmenu ? "menu" : null}"
  aria-expanded="${isSubmenu ? (submenuOpen ? "true" : "false") : null}"
  aria-controls="${(isSubmenu && !submenuId.isEmpty()) ? submenuId : null}"
  aria-keyshortcuts="${!shortcut.isEmpty() ? shortcut : null}"
  l:click="${wire}"
  $unsafe{wireArgsMarkup}
  class="flex w-full items-center gap-[var(--lv-space-2)] px-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] no-underline outline-none hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)] focus:bg-[var(--lv-color-accent)] focus:text-[var(--lv-color-accent-fg)] aria-disabled:pointer-events-none aria-disabled:opacity-50 ${cssClass}"
  style="min-height:var(--lv-item-height,var(--lv-space-9)); color:${itemColor}; background:transparent; text-decoration:none; box-sizing:border-box; cursor:pointer;"
  $unsafe{attrs}
>
  @if(isCheckable)
    <span aria-hidden="true" data-slot="context-menu-item-indicator" style="flex-shrink:0; width:0.875rem; height:0.875rem; display:inline-flex; align-items:center; justify-content:center;">
      @if(checked)
        @if(isRadio)
          <span style="width:0.5rem; height:0.5rem; border-radius:var(--lv-radius-full,50%); background:currentColor;"></span>
        @else
          @template.lievit.icon(name = "check", size = "0.875rem")
        @endif
      @endif
    </span>
  @endif
  @if(!icon.isEmpty())
    <span aria-hidden="true" style="flex-shrink:0; display:inline-flex;">@template.lievit.icon(name = icon, size = "1rem")</span>
  @endif
  <span style="flex:1 1 auto;">${label}</span>
  @if(!shortcut.isEmpty())
    <span aria-hidden="true" data-slot="context-menu-shortcut" style="flex-shrink:0; margin-left:auto; padding-left:var(--lv-space-3); color:var(--lv-color-muted); font-size:var(--lv-text-xs); letter-spacing:0.1em;">${shortcut}</span>
  @endif
  @if(isSubmenu)
    <span aria-hidden="true" style="flex-shrink:0; display:inline-flex; margin-left:auto;">@template.lievit.icon(name = "chevron-right", size = "0.875rem", cssClass = "text-[var(--lv-color-muted)]")</span>
  @endif
</a>
@else
<button
  type="button"
  role="${role}"
  data-slot="context-menu-item"
  data-lievit-item
  data-variant="${isDestructive ? "destructive" : null}"
  data-danger="${isDestructive ? "true" : null}"
  disabled="${disabled}"
  aria-disabled="${disabled ? "true" : null}"
  aria-checked="${isCheckable ? (checked ? "true" : "false") : null}"
  aria-haspopup="${isSubmenu ? "menu" : null}"
  aria-expanded="${isSubmenu ? (submenuOpen ? "true" : "false") : null}"
  aria-controls="${(isSubmenu && !submenuId.isEmpty()) ? submenuId : null}"
  aria-keyshortcuts="${!shortcut.isEmpty() ? shortcut : null}"
  l:click="${wire}"
  $unsafe{wireArgsMarkup}
  class="flex w-full items-center gap-[var(--lv-space-2)] px-[var(--lv-space-3)] text-left text-[length:var(--lv-text-sm)] outline-none hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)] focus:bg-[var(--lv-color-accent)] focus:text-[var(--lv-color-accent-fg)] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 ${cssClass}"
  style="min-height:var(--lv-item-height,var(--lv-space-9)); color:${itemColor}; background:transparent; border:0; font:inherit; cursor:pointer; box-sizing:border-box;"
  $unsafe{attrs}
>
  @if(isCheckable)
    <span aria-hidden="true" data-slot="context-menu-item-indicator" style="flex-shrink:0; width:0.875rem; height:0.875rem; display:inline-flex; align-items:center; justify-content:center;">
      @if(checked)
        @if(isRadio)
          <span style="width:0.5rem; height:0.5rem; border-radius:var(--lv-radius-full,50%); background:currentColor;"></span>
        @else
          @template.lievit.icon(name = "check", size = "0.875rem")
        @endif
      @endif
    </span>
  @endif
  @if(!icon.isEmpty())
    <span aria-hidden="true" style="flex-shrink:0; display:inline-flex;">@template.lievit.icon(name = icon, size = "1rem")</span>
  @endif
  <span style="flex:1 1 auto;">${label}</span>
  @if(!shortcut.isEmpty())
    <span aria-hidden="true" data-slot="context-menu-shortcut" style="flex-shrink:0; margin-left:auto; padding-left:var(--lv-space-3); color:var(--lv-color-muted); font-size:var(--lv-text-xs); letter-spacing:0.1em;">${shortcut}</span>
  @endif
  @if(isSubmenu)
    <span aria-hidden="true" style="flex-shrink:0; display:inline-flex; margin-left:auto;">@template.lievit.icon(name = "chevron-right", size = "0.875rem", cssClass = "text-[var(--lv-color-muted)]")</span>
  @endif
</button>
@endif
