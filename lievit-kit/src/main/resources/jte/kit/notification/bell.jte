@import dev.lievit.kit.page.KitBellView
@import dev.lievit.kit.DatabaseNotification
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.notification.bell - the canonical Filament topbar BELL chrome, rendered from a
  KitBellView (a dev.lievit.kit.NotificationBell scoped to one recipient + the host's mutation URLs)
  onto the lievit-ui notification-bell partial.

  v-next migration (notification-bell API pivot): the top-level partial no longer accepts Content
  slots (header / notifications / empty). It now takes a flat items=List<Map<String,String>> where
  each map carries: variant, message, description, timestamp, read. The clear-all and mark-all-read
  actions are driven by the KitBellView's URL helpers; the server-first form POSTs live in
  supplementary <form> elements rendered AFTER the primitive (separate from the bell panel). The
  per-row mark-read POST and the deep-link are rendered as data containers the host wires; they
  are rendered inside kit-bell-row-actions so adopters can compose them.

  The level->variant map:
    success -> "success"
    warning -> "warning"
    danger  -> "destructive"
    info    -> "info"
    (other) -> "info"

  Params:
    bell  - the KitBellView render bundle (the NotificationBell + the recipient's page + URLs).
    csrf  - optional hidden CSRF token slot for the POST forms (the adopter's CSRF field).
--%>
@param KitBellView bell
@param gg.jte.Content csrf = null
!{var _items = new java.util.ArrayList<java.util.Map<String, String>>();}
!{for (DatabaseNotification n : bell.notifications()) {
    String _level = bell.icon(n);
    String _variant = "circle-check".equals(_level) ? "success"
        : "triangle-alert".equals(_level) ? "warning"
        : "circle-x".equals(_level) ? "destructive"
        : "info";
    _items.add(java.util.Map.of(
        "variant", _variant,
        "message", bell.title(n),
        "description", bell.body(n),
        "timestamp", bell.relativeTime(n),
        "read", n.isUnread() ? "false" : "true"
    ));
  }}
@template.lievit.notification-bell(
  id = bell.id(),
  unreadCount = (int) bell.unreadCount(),
  items = _items,
  emptyLabel = "You're all caught up.",
  bellAriaLabel = "Notifications")
<%-- Server-first mutation actions: form POSTs for mark-all-read and clear-all.
     These render as real <form> elements outside the bell primitive so they work JS-off.
     Adopters wire the submit via htmx hx-post or native form submit. --%>
<div data-slot="kit-bell-header-actions" style="display:none;" aria-hidden="true">
  @if(!bell.markAllReadUrl().isBlank())
    <form method="POST" action="${bell.markAllReadUrl()}" data-slot="kit-bell-mark-all-read">
      @if(csrf != null)${csrf}@endif
      <button type="submit">Mark all read</button>
    </form>
  @endif
  @if(!bell.clearAllUrl().isBlank())
    <form method="POST" action="${bell.clearAllUrl()}" data-slot="kit-bell-clear-all">
      @if(csrf != null)${csrf}@endif
      <button type="submit">Clear all</button>
    </form>
  @endif
</div>
<%-- Per-row supplementary: mark-read POST + deep-link, one block per notification.
     These carry the server-first row actions (JS-off POST + <a href> deep-link).
     The adopter renders the bell panel itself via the notification-bell primitive above;
     these blocks are the server-first mutation layer keyed to each notification id. --%>
@for(DatabaseNotification n : bell.notifications())
  <div data-slot="kit-bell-row" data-notification-id="${n.id()}" style="display:none;" aria-hidden="true">
    @if(!bell.markReadUrl(n.id()).isBlank())
      <form method="POST" action="${bell.markReadUrl(n.id())}" data-slot="kit-bell-row-mark-read">
        @if(csrf != null)${csrf}@endif
        <button type="submit">Mark read</button>
      </form>
    @endif
    @if(!bell.rowHref(n).isBlank())
      <a href="${bell.rowHref(n)}" data-slot="notification-bell-item-link">${bell.title(n)}</a>
    @endif
  </div>
@endfor
