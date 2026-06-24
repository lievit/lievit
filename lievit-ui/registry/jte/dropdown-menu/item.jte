@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui dropdown-menu/item (v-next) -- one menu entry inside a dropdown-menu panel.

  TIER: PARTIAL. A real <a href> (navigation) or <button> (action); activation is the platform's.
  The item is OWNED markup, composed inside the dropdown-menu `content` slot.

  STRUCTURE (WAI-ARIA APG menu-button item): role="menuitem" (plain) / "menuitemcheckbox" /
  "menuitemradio" (checkable). A disabled item carries aria-disabled + dimming. A checkable
  item (type=checkbox/radio) reserves a leading indicator column and renders the indicator glyph
  when `checked` (a Lucide "check" for checkbox, a filled dot for radio; shadcn ItemIndicator
  pattern). The indicator column stays reserved when unchecked so labels align. The optional
  leading icon comes from the Lucide icon partial; the optional trailing shortcut is decorative
  (aria-hidden). A form-POST button sets form + formaction so it posts the adopter's form
  without inline JS.

  KEYBOARD: the collection-nav enhancer in roving-tabindex mode navigates between items via
  ArrowUp/Down/Home/End. Each item carries data-lievit-item (the enhancer's item selector) and
  tabindex="-1" (the enhancer sets tabindex="0" on the active item during navigation). Disabled
  items (aria-disabled="true") are skipped by the enhancer.

  NOTE on disabled: items use aria-disabled (not native disabled alone) so the item remains
  focusable under the APG menu model; in roving-tabindex mode the enhancer itself skips
  aria-disabled items. Native `disabled` is also set on buttons for pointer-event suppression,
  but aria-disabled is the a11y signal.

  WIRE channel (safe per-row): wireClick + wireArgs are the escaped-by-construction path for
  per-row wire actions (identical contract to button.jte). wireArgs values run through
  Escape.htmlAttribute; keys are allowlisted to simple identifiers (attribute-NAME position).

  data-danger is the CSS hook for the destructive color token; it avoids baking the color into
  inline style when the adopter's token set overrides --lv-color-destructive.

  Params:
    String  label                the visible item text.
    String  href = ""            renders a real <a href> (navigation item) when non-empty.
    String  icon = ""            optional leading Lucide icon name.
    String  shortcut = ""        optional right-aligned keyboard hint (display only, aria-hidden).
    String  type = "item"        "item" | "checkbox" | "radio": the menuitem role variant.
    String  variant = "default"  "default" | "destructive": destructive uses --lv-color-destructive.
    boolean checked = false      checked state for checkbox/radio (aria-checked).
    boolean disabled = false     dims + marks the item disabled (aria-disabled + native disabled).
    String  formId = ""          a form id this button submits (button items only).
    String  formAction = ""      a formaction URL this button posts to (button items only).
    String  wireClick = null     SAFE wire action name; emitted as l:click="${wireClick}" when set.
    Map<String,String> wireArgs = {}  SAFE per-row args; emitted as HTML-escaped data-<key>="<value>".
    String  cssClass = ""        extra utility classes on the item element.

  Usage:
    @@template.lievit.dropdown-menu.item(href = "/profile", label = "Profile", icon = "user")
    @@template.lievit.dropdown-menu.item(label = "Log out", icon = "log-out", formId = "logout-form")
    @@template.lievit.dropdown-menu.item(label = "Delete", variant = "destructive",
        wireClick = "deleteRow", wireArgs = java.util.Map.of("id", row.id()))
--%>
@param String label
@param String href = ""
@param String icon = ""
@param String shortcut = ""
@param String type = "item"
@param String variant = "default"
@param boolean checked = false
@param boolean disabled = false
@param String formId = ""
@param String formAction = ""
@param String wireClick = null
@param java.util.Map<String, String> wireArgs = java.util.Map.of()
@param String cssClass = ""

!{var role = "checkbox".equals(type) ? "menuitemcheckbox" : ("radio".equals(type) ? "menuitemradio" : "menuitem");}
!{var checkable = "checkbox".equals(type) || "radio".equals(type);}
!{var destructive = "destructive".equals(variant);}
!{var itemColor = destructive ? "var(--lv-color-destructive)" : "var(--lv-color-fg)";}
!{var itemStyle = "gap:var(--lv-space-2);width:100%;color:" + itemColor + ";background:transparent;border:0;padding:0 var(--lv-space-3);height:var(--lv-space-9);text-align:left;text-decoration:none;box-sizing:border-box;cursor:" + (disabled ? "not-allowed" : "pointer") + ";opacity:" + (disabled ? "0.5" : "1") + ";font:inherit;";}
!{var wire = wireClick != null && !wireClick.isBlank() ? wireClick : null;}
<%-- SAFE per-row wire arguments: each VALUE is escaped through Escape.htmlAttribute, emitted
     with $unsafe (safe because already escaped). Keys are allowlisted to simple identifiers
     (attribute-NAME position is not escaped by JTE). Mirrors button.jte exactly. --%>
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
  data-slot="dropdown-menu-item"
  data-variant="${destructive ? "destructive" : null}"
  data-danger="${destructive ? "true" : null}"
  data-lievit-item
  tabindex="-1"
  aria-disabled="${disabled ? "true" : null}"
  aria-checked="${checkable ? (checked ? "true" : "false") : null}"
  l:click="${wire}"
  $unsafe{wireArgsMarkup}
  class="flex items-center ${cssClass}"
  style="${itemStyle}"
>
  @if(checkable)
    <span aria-hidden="true" data-slot="dropdown-menu-item-indicator" style="flex-shrink:0;width:0.875rem;height:0.875rem;display:inline-flex;align-items:center;justify-content:center;">@if(checked)@if("radio".equals(type))<span style="width:0.5rem;height:0.5rem;border-radius:9999px;background:currentColor;display:inline-block;"></span>@else@template.lievit.icon(name = "check", size = "0.875rem")@endif@endif</span>
  @endif
  @if(!icon.isEmpty())
    <span aria-hidden="true" style="flex-shrink:0;display:inline-flex;align-items:center;">@template.lievit.icon(name = icon, size = "1rem")</span>
  @endif
  <span style="flex:1 1 auto;">${label}</span>
  @if(!shortcut.isEmpty())
    <span aria-hidden="true" data-slot="dropdown-menu-shortcut" style="flex-shrink:0;margin-left:auto;padding-left:var(--lv-space-3);color:var(--lv-color-muted);font-size:var(--lv-text-xs);letter-spacing:0.1em;">${shortcut}</span>
  @endif
</a>
@else
<button
  type="${formId.isEmpty() && formAction.isEmpty() ? "button" : "submit"}"
  role="${role}"
  data-slot="dropdown-menu-item"
  data-variant="${destructive ? "destructive" : null}"
  data-danger="${destructive ? "true" : null}"
  data-lievit-item
  tabindex="-1"
  form="${formId.isEmpty() ? null : formId}"
  formaction="${formAction.isEmpty() ? null : formAction}"
  aria-disabled="${disabled ? "true" : null}"
  aria-checked="${checkable ? (checked ? "true" : "false") : null}"
  disabled="${disabled}"
  l:click="${wire}"
  $unsafe{wireArgsMarkup}
  class="flex items-center ${cssClass}"
  style="${itemStyle}"
>
  @if(checkable)
    <span aria-hidden="true" data-slot="dropdown-menu-item-indicator" style="flex-shrink:0;width:0.875rem;height:0.875rem;display:inline-flex;align-items:center;justify-content:center;">@if(checked)@if("radio".equals(type))<span style="width:0.5rem;height:0.5rem;border-radius:9999px;background:currentColor;display:inline-block;"></span>@else@template.lievit.icon(name = "check", size = "0.875rem")@endif@endif</span>
  @endif
  @if(!icon.isEmpty())
    <span aria-hidden="true" style="flex-shrink:0;display:inline-flex;align-items:center;">@template.lievit.icon(name = icon, size = "1rem")</span>
  @endif
  <span style="flex:1 1 auto;">${label}</span>
  @if(!shortcut.isEmpty())
    <span aria-hidden="true" data-slot="dropdown-menu-shortcut" style="flex-shrink:0;margin-left:auto;padding-left:var(--lv-space-3);color:var(--lv-color-muted);font-size:var(--lv-text-xs);letter-spacing:0.1em;">${shortcut}</span>
  @endif
</button>
@endif
