@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui dropdown-menu/sub partial -- a NESTED submenu inside a dropdown-menu (Wave 2/3,
  server-first, no JS). Bundles the shadcn DropdownMenuSub + DropdownMenuSubTrigger +
  DropdownMenuSubContent triple into one server-pure disclosure: a native <details> whose
  <summary> is the SubTrigger (role="menuitem", aria-haspopup="menu", a trailing chevron-right)
  and whose body is the SubContent (role="menu") holding the nested items.

  TIER DECISION (why this shape, server-first): a true Radix flyout submenu reveals on hover /
  arrow-right and floats beside the parent -- that hover/arrow reveal + repositioning is the ONE
  piece that genuinely needs JS. The zero-JS, CSP-clean equivalent is the native <details>
  disclosure: the SubTrigger toggles the nested menu OPEN INLINE (the browser owns the open state,
  no script), the items are real <a>/<button> that work JS-off. An adopter who wants the floating,
  hover-revealed flyout drops a small typed-TS enhancer that listens for pointerenter / ArrowRight
  on the summary and CSS-anchor-positions the [data-slot=dropdown-menu-sub-content] beside the
  parent -- the documented escape-hatch, NOT a shipped island. The static structure + the wire hook
  ship; the floating reveal is DEFERRABLE.

  STRUCTURE (shadcn DropdownMenuSub family + WAI-ARIA APG): <details data-slot=dropdown-menu-sub>
  > <summary data-slot=dropdown-menu-sub-trigger role=menuitem aria-haspopup=menu> (label + leading
  icon + a trailing Lucide chevron-right, aria-hidden) > <div data-slot=dropdown-menu-sub-content
  role=menu> holding the nested item partials (OWNED, server-rendered).

  A11y: the summary is role="menuitem" with aria-haspopup="menu" + aria-expanded mirrored by the
  browser's <details> open state; the content is role="menu"; a disabled submenu sets aria-disabled
  on the summary and is not openable.

  Params:
    String         label                the submenu trigger text.
    gg.jte.Content content              the nested items (dropdown-menu/item entries), OWNED.
    String         icon = ""            an optional leading Lucide icon on the trigger.
    boolean        open = false         render the submenu initially expanded (<details open>).
    boolean        disabled = false     dims + locks the submenu so it cannot open.
    String         cssClass = ""        extra utility classes on the <details>.

  Usage:
    @@template.lievit.dropdown-menu.sub(label = "Share", icon = "share-2", content = @@`
      @@template.lievit.dropdown-menu.item(href = "/share/link", label = "Copy link")
      @@template.lievit.dropdown-menu.item(href = "/share/email", label = "Email")
    `)
--%>
@param String label
@param gg.jte.Content content
@param String icon = ""
@param boolean open = false
@param boolean disabled = false
@param String cssClass = ""
<details
    data-slot="dropdown-menu-sub"
    open="${open && !disabled}"
    class="${cssClass}"
    style="font: inherit;"
>
    <summary
        role="menuitem"
        data-slot="dropdown-menu-sub-trigger"
        aria-haspopup="menu"
        aria-disabled="${disabled ? "true" : null}"
        class="flex items-center"
        style="gap: var(--lv-space-2); width: 100%; color: var(--lv-color-fg); padding: var(--lv-space-2) var(--lv-space-3); box-sizing: border-box; cursor: ${disabled ? "not-allowed" : "pointer"}; opacity: ${disabled ? "0.5" : "1"}; list-style: none; font: inherit;"
    >
        @if(!icon.isEmpty())
            <span aria-hidden="true" style="flex-shrink: 0; display: inline-flex;">@template.lievit.icon(name = icon, size = "1rem")</span>
        @endif
        <span style="flex: 1 1 auto;">${label}</span>
        <span aria-hidden="true" style="flex-shrink: 0; margin-left: auto; display: inline-flex;">@template.lievit.icon(name = "chevron-right", size = "1rem")</span>
    </summary>
    <div
        role="menu"
        data-slot="dropdown-menu-sub-content"
        style="padding-left: var(--lv-space-3);"
    >${content}</div>
</details>
