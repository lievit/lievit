<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui context-menu partial -- a right-click floating role="menu" panel that opens at the
  pointer position. UNCONTROLLED by default: the context-menu-trigger.enhancer.ts intercepts the
  contextmenu DOM event, records the pointer coordinates, writes data-menu-x + data-menu-y onto
  the panel, and manages the open/closed lifecycle entirely client-side. CONTROLLED opt-in: pass
  open=true (bound to the CALLER's own @Wire field) to keep the panel in the DOM across wire
  round-trips; the enhancer still owns positioning and keyboard handling.

  TIER: PARTIAL (registry:jte). The open-state is NOT server state here -- no @Wire field, no
  Java component, no _component/_instance params. Same tier decision as dropdown-menu: a menu
  whose actions do server work (via l:click / href on each item) is fundamentally a PARTIAL +
  one irreducible gesture enhancer for the contextmenu event capture. The BUSINESS component
  that needs controlled open passes open="${myComp.contextMenuOpen()}" from its own @Wire field.

  STRUCTURE (scientific decision rule): WAI-ARIA APG Menu pattern (context-menu variant,
  https://www.w3.org/WAI/ARIA/apg/patterns/menu/). Panel = role="menu" aria-orientation="vertical".
  Items = real <button> with role="menuitem" / "menuitemcheckbox" / "menuitemradio" (platform
  gives keyboard + click for free; the shared collection-nav.enhancer.ts owns arrow roving,
  Home/End, typeahead, Enter/Space commit, Escape). Groups = role="group" aria-labelledby.
  Separators = role="separator". Submenus = nested context-menu via recursive content composition.
  Pointer positioning: the enhancer sets data-menu-x + data-menu-y on the panel; context-menu.css
  drives position:fixed + translate via CSS attr() (CSP-clean: no inline style).

  ENHANCER COMPOSITION (single-source-a11y rule, ADR-0012 contract sect 2.b):
    - context-menu-trigger.enhancer.ts (net-new, component-specific, NOT shared): intercepts the
      contextmenu event on [data-context-menu-trigger], preventDefault(), records x/y + active
      element, shows/positions the panel, manages outside-click + Escape, restores focus on close.
      Wire: data-trigger-selector on the wrapper root, data-menu-x/data-menu-y on the panel.
    - collection-nav.enhancer.ts (shared): activated on [data-lievit-collection] (the role="menu"
      panel root) -- owns arrow roving (aria-activedescendant model), typeahead, Home/End, Tab-close.

  A11y (WAI-ARIA APG Menu, context-menu variant):
    roles: role="menu" aria-orientation="vertical" on the panel; role="menuitem|menuitemcheckbox|
           menuitemradio" on items; role="separator" on dividers; role="group" aria-labelledby on
           groups; role="presentation" on group header spans.
    keyboard: ArrowDown/Up roving (collection-nav); Home/End jump (collection-nav); Enter/Space
              commit (collection-nav fires l:click); Escape close (trigger enhancer); Tab close +
              release focus (collection-nav + trigger enhancer); typeahead (collection-nav);
              ArrowRight open-submenu / ArrowLeft close-submenu (collection-nav).
    focus: initial focus = panel tabindex=-1 receives programmatic focus from trigger enhancer;
           collection-nav sets aria-activedescendant to the first non-disabled item;
           on close: focus returns to the element that was focused when contextmenu fired.
    live region: none (a context menu does not announce counts; results go to toast).

  CONTROLLED mode: when open=true the panel is included in the DOM; the caller binds open to its
  own @Wire field. The enhancer reads the panel's presence to decide the current state and still
  manages positioning + keyboard + outside-click.

  POSITION: context-menu.css provides:
    [data-slot="context-menu-panel"] {
      --_menu-x: attr(data-menu-x type(<number>), 0);
      --_menu-y: attr(data-menu-y type(<number>), 0);
      transform: translate(calc(var(--_menu-x) * 1px), calc(var(--_menu-y) * 1px));
    }
  The enhancer sets data-menu-x / data-menu-y after the panel appears. No inline style is emitted.

  Params:
    boolean         open            = false  when false the panel is absent from the DOM
                                             (uncontrolled: the enhancer manages this;
                                              controlled: bind to the caller's @Wire field)
    String          id              = "lv-ctx-menu"  unique id for the panel (page-scoped)
    String          size            = "md"   "sm" | "md" | "lg" -- item row height scale
    String          ariaLabel       = ""     accessible name for the panel; use this OR ariaLabelledby
    String          ariaLabelledby  = ""     id of an external element that labels the panel
    gg.jte.Content  trigger                  the region that right-clicks open this menu (OWNED markup)
    gg.jte.Content  content                  the menu items composed from context-menu/item + separator +
                                             group (OWNED markup, never a native slot)
    String          cssClass        = ""     extra utility classes on the root wrapper

  Usage:
    @template.lievit.context-menu(
      id = "row-actions",
      ariaLabel = "Row actions",
      trigger = @`
        <div class="p-2">Right-click this row...</div>
      `,
      content = @`
        @template.lievit.context-menu.item(label = "Rename", icon = "pencil",
            attrs = "l:click=\"rename\" data-id=\"${row.id()}\"")
        @template.lievit.context-menu.item(label = "Delete", icon = "trash-2", variant = "destructive",
            attrs = "l:click=\"delete\" data-id=\"${row.id()}\"")
        @template.lievit.context-menu.separator()
        @template.lievit.context-menu.item(label = "Copy link", icon = "link", href = "/rows/${row.id()}")
      `
    )
--%>
@param boolean open = false
@param String id = "lv-ctx-menu"
@param String size = "md"
@param String ariaLabel = ""
@param String ariaLabelledby = ""
@param gg.jte.Content trigger
@param gg.jte.Content content
@param String cssClass = ""
!{var panelId = id + "-panel";}
!{var sizeToken = "sm".equals(size) ? "var(--lv-space-8)" : ("lg".equals(size) ? "var(--lv-space-10)" : "var(--lv-space-9)");}
!{var labelAttr = !ariaLabelledby.isEmpty() ? null : (!ariaLabel.isEmpty() ? ariaLabel : "Context menu");}
!{var labelledbyAttr = !ariaLabelledby.isEmpty() ? ariaLabelledby : null;}

<div
  data-slot="context-menu"
  data-size="${size}"
  data-trigger-selector="[data-slot='context-menu-trigger']"
  data-panel-id="${panelId}"
  class="relative ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  <div
    data-slot="context-menu-trigger"
    data-context-menu-for="${panelId}"
  >${trigger}</div>
  @if(open)
    <div
      id="${panelId}"
      data-slot="context-menu-panel"
      data-size="${size}"
      role="menu"
      aria-orientation="vertical"
      aria-label="${labelAttr}"
      aria-labelledby="${labelledbyAttr}"
      tabindex="-1"
      data-lievit-collection
      data-lievit-collection-orientation="vertical"
      data-lievit-collection-wrap="true"
      data-lievit-collection-escape-action="close"
      class="box-border min-w-[var(--lv-context-menu-min-width,12rem)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-popover)] py-[var(--lv-space-1)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-popover-fg)] shadow-[var(--lv-shadow-md)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
      style="position:fixed; top:0; left:0; z-index:var(--lv-z-popover);"
    >${content}</div>
  @endif
</div>
