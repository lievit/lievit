<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui dropdown-menu/separator partial -- a non-selectable divider between dropdown-menu
  groups (Wave 2/3, server-first, no JS). Pure CSS.

  TIER: STATIC presentational -> JTE partial. A token-styled hairline carrying role="separator"
  so assistive tech announces the group boundary.

  A11y (WAI-ARIA APG): role="separator" inside the role="menu" panel.

  Params: (none)

  Usage:
    @@template.dropdown-menu.separator()
--%>
<div role="separator" data-slot="dropdown-menu-separator" style="height: 1px; background: var(--lv-color-border); margin: var(--lv-space-1) 0;"></div>
