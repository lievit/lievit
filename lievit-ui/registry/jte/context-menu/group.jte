<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui context-menu/group partial -- a labelled group of related context-menu items.
  Wraps its items in a role="group" element with aria-labelledby pointing to a header span.

  TIER: STATIC presentational -> JTE partial.

  STRUCTURE (WAI-ARIA APG Menu, group pattern): role="group" aria-labelledby="<headerId>". The
  header is role="presentation" (visual label only, not a menu item) so AT reads the label as the
  group name, not as a menu item. The header is not focusable and collection-nav skips it (no
  data-lievit-item attribute).

  A11y (WAI-ARIA APG): role="group" aria-labelledby; group header role="presentation" with a
  unique id; items inside are standard role="menuitem" (composed from context-menu/item partial).

  Params:
    String         groupId  = ""  unique id suffix for the group header element. When empty a
                                  random suffix is not feasible in a static template; callers MUST
                                  supply a unique id when more than one group exists on a page.
    String         label    = ""  visible group header text (also the a11y group name).
    gg.jte.Content content        the group's items composed from context-menu/item partial.

  Usage:
    @template.lievit.context-menu.group(
      groupId = "edit-actions",
      label = "Edit",
      content = @`
        @template.lievit.context-menu.item(label = "Cut", icon = "scissors", attrs = "l:click=\"cut\"")
        @template.lievit.context-menu.item(label = "Copy", icon = "copy", attrs = "l:click=\"copy\"")
        @template.lievit.context-menu.item(label = "Paste", icon = "clipboard", attrs = "l:click=\"paste\"")
      `
    )
--%>
@param String groupId = ""
@param String label = ""
@param gg.jte.Content content
!{var headerId = "ctx-grp-" + (!groupId.isEmpty() ? groupId : "default");}

<div
  role="group"
  data-slot="context-menu-group"
  aria-labelledby="${headerId}"
>
  <span
    id="${headerId}"
    role="presentation"
    data-slot="context-menu-group-header"
    style="display:block; padding:var(--lv-space-2) var(--lv-space-3); font-size:var(--lv-text-xs); font-weight:500; color:var(--lv-color-muted); letter-spacing:0.05em; user-select:none;"
  >${label}</span>
  ${content}
</div>
