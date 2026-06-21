@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui tabs-panel partial -- one panel of the tabs primitive (shadcn TabsContent), a
  role="tabpanel" region shown only when its id is the active tab. Server-first, zero-JS, CSP-clean.

  STRUCTURE (shadcn TabsContent + WAI-ARIA APG): <div role="tabpanel" data-slot="tabs-content"
  aria-labelledby="lv-tab-<id>"> linked back to its trigger; the inactive panel carries the boolean
  `hidden` so it leaves the view + a11y tree (the platform's own panel switch, no JS). The active
  panel is keyboard-reachable (tabindex="0") so a screen-reader user lands in the revealed content.

  Params:
    String id                     this panel's id (matches its tab id in the tabs strip).
    String active                 the active tab id; this panel shows when id.equals(active).
    gg.jte.Content content        the panel body.
    String cssClass = ""          extra utility classes on the panel.

  Usage:
    @@template.lievit.tabs-panel(id = "info", active = "info", content = @@`<p>...</p>`)
--%>
@param String id
@param String active
@param gg.jte.Content content
@param String cssClass = ""

!{var isActive = id.equals(active);}

<div
  role="tabpanel"
  data-slot="tabs-content"
  id="lv-tabpanel-${id}"
  aria-labelledby="lv-tab-${id}"
  tabindex="${isActive ? "0" : null}"
  hidden="${!isActive}"
  class="${cssClass}"
  style="outline: none;"
>${content}</div>
