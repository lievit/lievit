@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui notification-bell partial -- the topbar notification bell (the Filament
  Livewire/DatabaseNotifications component, the io.lievit.kit.NotificationBell view-model): a
  badge-count TRIGGER that opens a dropdown PANEL listing the recipient's notifications
  (notification-bell/item rows) under a mark-all-read / clear-all header
  (notification-bell/header). Server-first PARTIAL (ADR-0012), ZERO shipped JS.

  TIER DECISION (why PARTIAL, not WIRE): the bell's STATE -- the unread count, the page of rows,
  the read/unread flag per row -- is server-owned data the NotificationBell view-model already
  holds; "reveal the panel" needs no server round-trip and no durable client state. So the
  reveal is the native overlay seam (the dropdown-menu's `popover` attribute + CSS Anchor
  Positioning) and the panel is OWNED, server-rendered markup. The MUTATIONS (mark-read,
  mark-all-read, clear-all) are real wire-action POSTs the adopter wires on the header/row
  buttons (an l:click or a form action) -- never inline script (CSP-clean). The kit's wire host
  refreshes the count via the lievit-notifications-refresh broadcast event or the 30s poll;
  this partial renders the pure view, the host owns the liveness.

  STRUCTURE (scientific decision rule): WAI-ARIA APG menu-button (the same platform overlay the
  dropdown-menu partial documents), specialised into a notification panel:
    - TRIGGER = a <button popovertarget aria-haspopup="menu"> carrying the bell icon + an unread
      COUNT badge (the lievit-ui badge partial, variant=destructive, the shadcn over-the-icon
      count pill). The badge renders only when `unreadCount > 0` (the bell's hasUnread()); an
      aria-label states the count so screen readers announce "Notifications, N unread".
    - PANEL = a `popover="auto"` top-layer surface (no z-index war, light-dismiss + Escape), the
      same overlay mechanics + tokens as dropdown-menu-content but wider (notifications are rows
      of text, not a slim menu). It is a role="menu" listing notification-bell/item rows under a
      notification-bell/header strip.
    - HEADER = the notification-bell/header sub-part: a title + the mark-all-read and clear-all
      actions (real <button>s the adopter wires).
    - ROWS = the `notifications` Content slot, composed from notification-bell/item (one per
      DatabaseNotification: title / body / time, an unread dot, an optional mark-read action).
    - EMPTY = the `empty` slot renders when there are no notifications (default: a muted line).

  A11y (WAI-ARIA APG menu-button): trigger <button popovertarget aria-haspopup="menu"> with an
  aria-label stating the unread count; the browser adds aria-expanded while open. Panel
  role="menu" labelled by the header title. The count badge is decorative (aria-hidden) -- the
  count is already in the trigger's aria-label, so it is not announced twice.

  Params:
    String         id = "lv-notification-bell"  the panel id (popovertarget target). Unique/page.
    long           unreadCount = 0               the unread badge count (renders the pill when > 0).
    String         label = "Notifications"       the trigger's accessible name (prefix of the aria-label).
    gg.jte.Content header                        the panel header (notification-bell/header).
    gg.jte.Content notifications = null          the notification rows (notification-bell/item list).
    gg.jte.Content empty = null                  rendered when `notifications` is null/blank (no rows).
    String         placement = "bottom"          "bottom" | "top": preferred side (flips when cramped).
    boolean        disabled = false              disables the trigger so the panel cannot open.
    String         cssClass = ""                 extra utility classes on the wrapper.

  Usage:
    @@template.lievit.notification-bell(
      id = "topbar-bell",
      unreadCount = bell.unreadCount(),
      header = @@`@@template.lievit.notification-bell.header(
        markAllReadAction = "/notifications/read-all",
        clearAllAction = "/notifications/clear")`,
      notifications = @@`
        @@for(var n : bell.notifications())
          @@template.lievit.notification-bell.item(
            title = n.data().get("title").toString(),
            body = n.data().get("body").toString(),
            time = "2m ago",
            unread = n.isUnread(),
            markReadAction = "/notifications/" + n.id() + "/read")
        @@endfor
      `,
      empty = @@`You're all caught up.`)
--%>
@param String id = "lv-notification-bell"
@param long unreadCount = 0
@param String label = "Notifications"
@param gg.jte.Content header
@param gg.jte.Content notifications = null
@param gg.jte.Content empty = null
@param String placement = "bottom"
@param boolean disabled = false
@param String cssClass = ""
!{var anchorName = "--" + id + "-anchor";}
!{var area = "top".equals(placement) ? "top span-all" : "bottom span-all";}
!{var hasUnread = unreadCount > 0;}
!{var ariaLabel = hasUnread ? label + ", " + unreadCount + " unread" : label;}

<span data-slot="notification-bell" class="relative inline-block ${cssClass}" style="font-family:var(--lv-font-sans);">
  <button
    type="button"
    data-slot="notification-bell-trigger"
    popovertarget="${id}"
    aria-haspopup="menu"
    aria-label="${ariaLabel}"
    disabled="${disabled}"
    class="relative inline-flex items-center justify-center rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] p-[var(--lv-space-2)] text-[var(--lv-color-fg)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
    style="anchor-name:${anchorName};"
  >
    @template.lievit.icon(name = "bell", size = "1.25rem")
    @if(hasUnread)
      <span
        data-slot="notification-bell-count"
        aria-hidden="true"
        class="absolute -translate-y-1/2 translate-x-1/2"
        style="top:0; right:0;"
      >@template.lievit.badge(variant = "destructive", label = unreadCount > 99 ? "99+" : String.valueOf(unreadCount))</span>
    @endif
  </button>

  <div
    id="${id}"
    popover="auto"
    data-slot="notification-bell-panel"
    role="menu"
    aria-label="${label}"
    class="m-0 box-border w-[20rem] max-w-[calc(100vw-var(--lv-space-4))] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-popover)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-popover-fg)] shadow-[var(--lv-shadow-md)]"
    style="position-anchor:${anchorName}; position-area:${area}; position-try-fallbacks:flip-block; margin-block:var(--lv-space-1); z-index:var(--lv-z-popover); font-family:var(--lv-font-sans);"
  >
    ${header}
    @template.lievit.separator()
    <div data-slot="notification-bell-list" role="presentation" class="max-h-[24rem] overflow-y-auto">
      @if(notifications != null)
        ${notifications}
      @else
        <p data-slot="notification-bell-empty" class="px-[var(--lv-space-3)] py-[var(--lv-space-6)] text-center text-[var(--lv-color-muted-fg)]">@if(empty != null)${empty}@else No notifications.@endif</p>
      @endif
    </div>
  </div>
</span>
