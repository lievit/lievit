@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui dropdown-menu/item partial -- one REAL menu entry of a dropdown-menu (Wave 2/3,
  server-first, no JS). Renders a real <a href> when `href` is given (navigation: the browser
  navigates, middle-click / open-in-new-tab work), otherwise a real <button> (an action: a form
  submit via `formAction`, or an l:click the adopter wires in their copy).

  TIER: STATIC presentational -> JTE partial. A real anchor / button; activation is the platform's.
  The item is OWNED markup, never projected through a <slot>.

  STRUCTURE (WAI-ARIA APG menu-button item, Radix DropdownMenu.Item model): role="menuitem"
  (or menuitemcheckbox / menuitemradio for a checkable item). A disabled item carries aria-disabled
  and is dimmed. A checkable item (type=checkbox/radio) reserves a leading indicator column and
  renders the shadcn ItemIndicator glyph when `checked` (a Lucide "check" for a checkbox, a filled
  "dot" for a radio, data-slot="dropdown-menu-item-indicator"); the column stays reserved when
  unchecked so the items align (shadcn pads pl-8). The optional leading icon comes from the Lucide
  icon partial; the optional trailing shortcut hint is decorative (aria-hidden) and carries
  data-slot="dropdown-menu-shortcut" (the standalone dropdown-menu/shortcut partial inlined). A
  button that submits a form sets `form` + `formaction` so it posts the adopter's logout/delete
  form without inline JS (CSP-clean).

  A11y: a real <a> / <button> so focus + activation are the platform's; aria-disabled on a disabled
  item; aria-checked on a checkbox/radio item; the icon + shortcut are aria-hidden decoration.

  WIRE ACTION -- the SAFE per-row channel (the reactive-list decision rule, mirrored from the button
  partial). A menu item in a reactive list (a per-row "..." action menu: rename/delete/revoke THIS
  row) must fire a wire action that carries a per-row, DB-derived argument (a row id, a legacy
  username). Today the item routes to the server only via `href` (a GET) or `formAction` (a form
  POST); a wire-driven menu item with a per-row id therefore forced a hand-rolled <button> with a
  raw l:click + data-id outside this partial (the gest pain + the kit action-group case). This
  channel is the ergonomic, escaped-by-construction path, identical to button.jte:
    * wireClick (SAFE) -- the wire action NAME, emitted as l:click="${wireClick}". JTE escapes the
      ${} in attribute-value position, so even an unusual value stays inert; rendered only when
      non-blank. Pairs with wireArgs for the argument(s).
    * wireArgs / wireArg (SAFE) -- the per-row argument(s) the wire handler reads, as
      Map<String,String> (or the single-entry wireArg key+value), each emitted as an HTML-ESCAPED
      data-<key>="<value>" attribute (the values run through gg.jte.html.escape.Escape.htmlAttribute,
      the exact routine ContentType.Html applies to a ${} in attribute-value position). So the
      consumer writes wireClick = "revokeDevice", wireArgs = java.util.Map.of("id", row.id()) and the
      item emits l:click="revokeDevice" data-id="<escaped row id>" with NO XSS surface -- the
      hand-rolled <button> the reactive-list case used to need is gone. Keys must be simple
      identifiers ([A-Za-z][A-Za-z0-9-]*); a non-identifier key is dropped (it sits in
      attribute-NAME position, which JTE does not escape).
  wireClick is independent of href/formAction (full back-compat): give `href` for a navigation item,
  `formId`/`formAction` for a form POST, or `wireClick` (+ optional `wireArgs`) for a per-row wire
  action. With no href + no formId/formAction the item is still a real <button type=button> and the
  l:click drives it; wireClick is rendered on the <a> branch too for parity (an l:click can decorate
  a link), but a per-row wire action is the <button> case.

  Params:
    String  label                the visible item text.
    String  href = ""            destination => renders a real <a href> (navigation item).
    String  icon = ""            an optional leading Lucide icon name.
    String  shortcut = ""        an optional right-aligned keyboard hint (display only).
    String  type = "item"        "item" | "checkbox" | "radio": the menuitem role variant.
    String  variant = "default"  "default" | "destructive": destructive tints the text/icon with
                                 --lv-color-destructive + sets data-variant="destructive" (shadcn).
    boolean checked = false      checked state for a checkbox/radio item (aria-checked).
    boolean disabled = false     dims + disables the item (aria-disabled / button disabled).
    String  formId = ""          a <form> id this button submits (button items only).
    String  formAction = ""      a formaction URL this button posts to (button items only).
    String  wireClick = null     SAFE wire action name; emitted as l:click="${wireClick}" when set.
    Map<String,String> wireArgs = {}  SAFE per-row args for the wire action; each emitted as an
                                      HTML-escaped data-<key>="<value>" (key w/o "data-", simple id).
    String  cssClass = ""        extra utility classes on the item.

  Usage:
    @@template.lievit.dropdown-menu.item(href = "/profile", label = "Profile", icon = "user")
    @@template.lievit.dropdown-menu.item(label = "Log out", icon = "log-out", formId = "logout-form")
    (PER-ROW wire action -- action name + escaped row arg, NO hand-rolled button):
    @@template.lievit.dropdown-menu.item(label = "Revoke", icon = "x", variant = "destructive",
        wireClick = "revokeDevice", wireArgs = java.util.Map.of("id", row.id()))
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
!{var itemStyle = "gap: var(--lv-space-2); width: 100%; color: " + itemColor + "; background: transparent; border: 0; padding: var(--lv-space-2) var(--lv-space-3); text-align: left; text-decoration: none; box-sizing: border-box; cursor: " + (disabled ? "not-allowed" : "pointer") + "; opacity: " + (disabled ? "0.5" : "1") + "; font: inherit;";}
!{var wire = wireClick != null && !wireClick.isBlank() ? wireClick : null;}
<%-- SAFE per-row wire arguments: build the data-* fragment once with every VALUE escaped through
     JTE's OWN attribute escaper (Escape.htmlAttribute), then emit with $unsafe -- safe because the
     dynamic values are already escaped. Keys must be simple identifiers (attribute-NAME position is
     NOT escaped), so a non-identifier key is dropped. Mirrors the button partial exactly. --%>
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
        aria-disabled="${disabled ? "true" : null}"
        aria-checked="${checkable ? (checked ? "true" : "false") : null}"
        l:click="${wire}"
        $unsafe{wireArgsMarkup}
        class="flex items-center ${cssClass}"
        style="${itemStyle}"
    >
        @if(checkable)
            <span aria-hidden="true" data-slot="dropdown-menu-item-indicator" style="flex-shrink: 0; width: 0.875rem; height: 0.875rem; display: inline-flex; align-items: center; justify-content: center;">@if(checked)@if("radio".equals(type))<span style="width: 0.5rem; height: 0.5rem; border-radius: var(--lv-radius-md); background: currentColor;"></span>@else@template.lievit.icon(name = "check", size = "0.875rem")@endif@endif</span>
        @endif
        @if(!icon.isEmpty())
            <span aria-hidden="true" style="flex-shrink: 0; display: inline-flex;">@template.lievit.icon(name = icon, size = "1rem")</span>
        @endif
        <span style="flex: 1 1 auto;">${label}</span>
        @if(!shortcut.isEmpty())
            <span aria-hidden="true" data-slot="dropdown-menu-shortcut" style="flex-shrink: 0; margin-left: auto; padding-left: var(--lv-space-3); color: var(--lv-color-muted); font-size: var(--lv-text-xs); letter-spacing: 0.1em;">${shortcut}</span>
        @endif
    </a>
@else
    <button
        type="${formId.isEmpty() && formAction.isEmpty() ? "button" : "submit"}"
        role="${role}"
        data-slot="dropdown-menu-item"
        data-variant="${destructive ? "destructive" : null}"
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
            <span aria-hidden="true" data-slot="dropdown-menu-item-indicator" style="flex-shrink: 0; width: 0.875rem; height: 0.875rem; display: inline-flex; align-items: center; justify-content: center;">@if(checked)@if("radio".equals(type))<span style="width: 0.5rem; height: 0.5rem; border-radius: var(--lv-radius-md); background: currentColor;"></span>@else@template.lievit.icon(name = "check", size = "0.875rem")@endif@endif</span>
        @endif
        @if(!icon.isEmpty())
            <span aria-hidden="true" style="flex-shrink: 0; display: inline-flex;">@template.lievit.icon(name = icon, size = "1rem")</span>
        @endif
        <span style="flex: 1 1 auto;">${label}</span>
        @if(!shortcut.isEmpty())
            <span aria-hidden="true" data-slot="dropdown-menu-shortcut" style="flex-shrink: 0; margin-left: auto; padding-left: var(--lv-space-3); color: var(--lv-color-muted); font-size: var(--lv-text-xs); letter-spacing: 0.1em;">${shortcut}</span>
        @endif
    </button>
@endif
