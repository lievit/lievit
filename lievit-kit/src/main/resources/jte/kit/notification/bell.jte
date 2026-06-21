@import io.lievit.kit.page.KitBellView
@import io.lievit.kit.DatabaseNotification
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.notification.bell - the canonical Filament topbar BELL chrome, rendered from a
  KitBellView (a io.lievit.kit.NotificationBell scoped to one recipient + the host's mutation URLs)
  onto the lievit-ui notification-bell + notification-bell/header + notification-bell/item partials.
  The render-counterpart of the table chrome: a host renders THIS in the topbar instead of
  hand-mapping the recipient's DatabaseNotification page onto the panel.

  The map (NotificationBell -> lievit-ui notification-bell):
    - bell.unreadCount() -> the trigger's badge count (the panel auto-hides the pill at zero).
    - the header strip -> notification-bell/header: a title + the mark-all-read POST + clear-all
      POST. They are real <form> submits to the host's URLs (CSP-clean, no inline script); the bell
      view-model's markAllRead() / clearAll() are the wire-host's handlers behind those URLs.
    - each DatabaseNotification (newest first) -> one notification-bell/item:
        data.title  -> item title         data.body -> item body
        unread flag -> the unread dot + an enabled per-row mark-read POST
        createdAt   -> a relative time the host's KitBellView formats ("2m ago")
        a level->Lucide icon (the stored heroicon-style data.icon is NOT in the lievit set, so the
        row leans on the level glyph the bundle derives, never the raw stored icon).
      The per-row mark-read posts to the bundle's mark-read URL pattern (%s = notification id).
    - empty -> the "all caught up" line when the recipient has no notifications.

  All mutations are server-first form POSTs (the panel forms carry the host's CSRF token via the
  `csrf` slot the host fills). The BELL_REFRESH live-refresh (BroadcastNotification over SSE, the
  lievit-notifications-refresh event) is a RUNTIME concern the wire-host owns; this template renders
  the pure server-side panel, the 30s poll / SSE push re-runs it. No template work for liveness.

  Params:
    bell  - the KitBellView render bundle (the NotificationBell + the recipient's page + the
            mark-read / mark-all-read / clear-all URLs + the per-row relative time and level glyph).
    csrf  - the host's CSRF hidden-input fragment, stamped inside every mutation form; null in a
            context with no CSRF (e.g. the render gate).
--%>
@param KitBellView bell
@param gg.jte.Content csrf = null
@template.lievit.notification-bell(
  id = bell.id(),
  unreadCount = bell.unreadCount(),
  header = @`
    <form method="post" data-slot="kit-bell-header-form" class="contents">
      @if(csrf != null)${csrf}@endif
      @template.lievit.notification-bell.header(
        markAllReadAction = bell.markAllReadUrl(),
        clearAllAction = bell.clearAllUrl(),
        disabled = !bell.hasNotifications())
    </form>
  `,
  notifications = bell.hasNotifications() ? @`
    @for(DatabaseNotification n : bell.notifications())
      <form method="post" data-slot="kit-bell-item-form" data-notification="${n.id()}" class="contents">
        @if(csrf != null)${csrf}@endif
        @template.lievit.notification-bell.item(
          title = bell.title(n),
          body = bell.body(n),
          time = bell.relativeTime(n),
          icon = bell.icon(n),
          unread = n.isUnread(),
          href = bell.rowHref(n),
          markReadAction = n.isUnread() ? bell.markReadUrl(n.id()) : "")
      </form>
    @endfor
  ` : null,
  empty = @`You're all caught up.`)
