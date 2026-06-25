<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui notification-bell/header partial -- the strip at the top of the notification panel
  (Filament's database-notifications header): a title on the left, the mark-all-read and
  clear-all actions on the right. Server-first, no JS.

  TIER: STATIC presentational -> JTE partial. The two actions are real <button>s that POST a
  wire action (the dev.lievit.kit.NotificationBell markAllRead() / clearAll() operations): a
  non-blank action URL renders the button as a form submit (formaction, CSP-clean, no inline
  handler); otherwise the adopter wires an l:click in their copy of the markup. The buttons
  carry the mark-read ("check") and clear ("trash-2") Lucide icons + a text label so the
  action is named for assistive tech, never icon-only.

  A11y: the title is the panel's heading; the actions are real focusable <button>s with text
  labels; the icons are aria-hidden decoration. A disabled action (no unread to clear) carries
  the platform disabled state.

  Params:
    String  title              = "Notifications"  the panel heading text.
    String  markAllReadLabel   = "Mark all read"  the mark-all-read button label.
    String  clearAllLabel      = "Clear all"      the clear-all button label.
    String  markAllReadAction  = ""               non-blank => the button posts this URL (formaction).
    String  clearAllAction     = ""               non-blank => the button posts this URL (formaction).
    String  formId             = ""               a <form> id the buttons submit (when posting).
    boolean disabled           = false            dims + disables both actions (nothing to act on).
    String  cssClass           = ""               extra utility classes on the header.

  Usage:
    @@template.lievit.notification-bell.header(
      markAllReadAction = "/notifications/read-all",
      clearAllAction = "/notifications/clear")
--%>
@param String title = "Notifications"
@param String markAllReadLabel = "Mark all read"
@param String clearAllLabel = "Clear all"
@param String markAllReadAction = ""
@param String clearAllAction = ""
@param String formId = ""
@param boolean disabled = false
@param String cssClass = ""
!{var actionStyle = "color: var(--lv-color-muted-fg); background: transparent; border: 0; padding: var(--lv-space-1) var(--lv-space-2); cursor: " + (disabled ? "not-allowed" : "pointer") + "; opacity: " + (disabled ? "0.5" : "1") + "; font: inherit; border-radius: var(--lv-radius-sm);";}

<div data-slot="notification-bell-header" class="flex items-center justify-between gap-[var(--lv-space-2)] px-[var(--lv-space-3)] py-[var(--lv-space-2)] ${cssClass}">
  <span data-slot="notification-bell-title" class="font-[var(--lv-font-semibold)] text-[var(--lv-color-fg)]">${title}</span>
  <span data-slot="notification-bell-actions" class="flex items-center gap-[var(--lv-space-1)]">
    <button
      type="${markAllReadAction.isEmpty() ? "button" : "submit"}"
      data-slot="notification-bell-mark-all-read"
      form="${formId.isEmpty() ? null : formId}"
      formaction="${markAllReadAction.isEmpty() ? null : markAllReadAction}"
      disabled="${disabled}"
      aria-disabled="${disabled ? "true" : null}"
      class="inline-flex items-center gap-[var(--lv-space-1)] text-[length:var(--lv-text-xs)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
      style="${actionStyle}"
    >@template.lievit.icon(name = "check", size = "0.875rem")<span>${markAllReadLabel}</span></button>
    <button
      type="${clearAllAction.isEmpty() ? "button" : "submit"}"
      data-slot="notification-bell-clear-all"
      form="${formId.isEmpty() ? null : formId}"
      formaction="${clearAllAction.isEmpty() ? null : clearAllAction}"
      disabled="${disabled}"
      aria-disabled="${disabled ? "true" : null}"
      class="inline-flex items-center gap-[var(--lv-space-1)] text-[length:var(--lv-text-xs)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
      style="${actionStyle}"
    >@template.lievit.icon(name = "trash-2", size = "0.875rem")<span>${clearAllLabel}</span></button>
  </span>
</div>
