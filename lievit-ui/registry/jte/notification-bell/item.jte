<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui notification-bell/item partial -- one notification ROW in the bell panel (the
  Filament database-notification entry, one io.lievit.kit.DatabaseNotification): a title, an
  optional body, a relative time, an optional leading icon, and -- when unread -- an unread DOT
  plus an optional mark-read action. Server-first, no JS.

  TIER: STATIC presentational -> JTE partial. The read/unread state is server-owned data (the
  DatabaseNotification.isUnread() flag), so the server renders the whole row keyed on `unread`.
  The mark-read action is a real <button> that POSTs a wire action (NotificationBell.markRead):
  a non-blank `markReadAction` renders it as a form submit (formaction, CSP-clean); otherwise the
  adopter wires an l:click. The whole row is an <a href> when `href` is set (the browser
  navigates to the notification's target), else an inert <div> row.

  STRUCTURE (data-state): the row carries data-state="unread" | "read" so a stylesheet can tint
  the unread rows (the shadcn data-state convention the dropdown-menu item uses); the unread DOT
  is the visible, colour-independent unread signal (never colour alone). role="menuitem" so the
  row is announced as an item of the panel's role="menu".

  A11y (WAI-ARIA APG): role="menuitem"; an unread row's dot carries an aria-label "unread" so
  the state is announced, not only seen; the icon + time are decorative (aria-hidden); the
  mark-read button has a text-bearing aria-label.

  Params:
    String  title                       the notification title (the primary line).
    String  body            = ""        an optional secondary line (the notification body).
    String  time            = ""        an optional relative time (display only, e.g. "2m ago").
    String  icon            = ""        an optional leading Lucide icon name.
    boolean unread          = false     unread => the unread dot + data-state="unread".
    String  href            = ""        non-blank => the whole row is an <a href> (navigation).
    String  markReadLabel   = "Mark as read"  the mark-read button's accessible name.
    String  markReadAction  = ""        non-blank => the mark-read button posts this URL (formaction).
    String  formId          = ""        a <form> id the mark-read button submits.
    String  cssClass        = ""        extra utility classes on the row.

  Usage:
    @@template.lievit.notification-bell.item(
      title = "New listing assigned",
      body = "Via Roma 12 is now yours.",
      time = "2m ago",
      icon = "home",
      unread = true,
      markReadAction = "/notifications/42/read")
--%>
@param String title
@param String body = ""
@param String time = ""
@param String icon = ""
@param boolean unread = false
@param String href = ""
@param String markReadLabel = "Mark as read"
@param String markReadAction = ""
@param String formId = ""
@param String cssClass = ""
!{var state = unread ? "unread" : "read";}
!{var rowStyle = "gap: var(--lv-space-2); padding: var(--lv-space-3); text-decoration: none; color: inherit; background: " + (unread ? "var(--lv-color-accent)" : "transparent") + ";";}
!{var isLink = !href.isEmpty();}

<%-- One root (no <a>/<div> split, which JTE rejects). Whole-row link = shadcn stretched-link: a
     transparent absolute <a> over the relative row; the mark-read button sits above it (relative) so
     it stays clickable. role=menuitem carries the row semantics; a <button> cannot live inside <a>. --%>
<div role="menuitem" data-slot="notification-bell-item" data-state="${state}" class="relative flex items-start ${cssClass}" style="${rowStyle}">
  @if(isLink)
    <a href="${href}" data-slot="notification-bell-item-link" aria-label="${title}" class="absolute inset-0 outline-none focus-visible:shadow-[var(--lv-ring)]"></a>
  @endif
  @if(unread)
    <span data-slot="notification-bell-item-dot" aria-label="unread" role="img" class="mt-[var(--lv-space-1)] inline-block shrink-0 rounded-full bg-[var(--lv-color-primary)]" style="width: 0.5rem; height: 0.5rem;"></span>
  @else
    <span aria-hidden="true" class="mt-[var(--lv-space-1)] inline-block shrink-0" style="width: 0.5rem; height: 0.5rem;"></span>
  @endif
  @if(!icon.isEmpty())
    <span aria-hidden="true" class="shrink-0" style="display: inline-flex; color: var(--lv-color-muted-fg);">@template.lievit.icon(name = icon, size = "1rem")</span>
  @endif
  <span data-slot="notification-bell-item-content" class="min-w-0 flex-1">
    <span data-slot="notification-bell-item-title" class="block font-[var(--lv-font-medium)] text-[var(--lv-color-fg)]">${title}</span>
    @if(!body.isEmpty())
      <span data-slot="notification-bell-item-body" class="block text-[length:var(--lv-text-xs)] text-[var(--lv-color-muted-fg)]">${body}</span>
    @endif
    @if(!time.isEmpty())
      <span data-slot="notification-bell-item-time" aria-hidden="true" class="mt-[var(--lv-space-1)] block text-[length:var(--lv-text-xs)] text-[var(--lv-color-muted)]">${time}</span>
    @endif
  </span>
  @if(unread && !markReadAction.isEmpty())
    <button
      type="submit"
      data-slot="notification-bell-item-mark-read"
      form="${formId.isEmpty() ? null : formId}"
      formaction="${markReadAction}"
      aria-label="${markReadLabel}"
      class="relative shrink-0 focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
      style="color: var(--lv-color-muted-fg); background: transparent; border: 0; padding: var(--lv-space-1); cursor: pointer; border-radius: var(--lv-radius-sm);"
    >@template.lievit.icon(name = "check", size = "0.875rem")</button>
  @endif
</div>
