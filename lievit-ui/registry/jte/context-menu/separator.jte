<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui context-menu/separator partial -- a non-selectable visual divider between groups of
  context-menu items. Pure CSS, no JS.

  TIER: STATIC presentational -> JTE partial.

  A11y (WAI-ARIA APG Menu): role="separator" inside the role="menu" panel. aria-hidden="true" on
  the visual element so AT does not announce it redundantly (the role="separator" on the <hr> is
  sufficient; the aria-hidden is on the wrapper that carries the visual styling).

  Params: (none)

  Usage:
    @template.lievit.context-menu.separator()
--%>
<hr
  role="separator"
  data-slot="context-menu-separator"
  style="height:1px; border:none; background:var(--lv-color-border); margin:var(--lv-space-1) 0;"
/>
