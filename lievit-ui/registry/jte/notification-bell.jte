@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui notification-bell partial -- an icon-button with an inline unread-count badge that
  opens a native-popover notification history panel. Domain-agnostic: items are a
  List of Map (keys: variant, message, description, timestamp, read) so no dev.lievit import
  is needed and the partial carries no domain coupling.

  TIER: PARTIAL presentational (ADR-0012 server-first pivot). Bell opens/closes via the native
  browser popover API -- no JS, no z-index war, light-dismiss + Esc built-in. The server renders
  the initial unread count and item list; the toast.enhancer.ts can increment the unread badge
  via data-unread-count after page load without a full round-trip.

  STRUCTURE (scientific decision rule):
    - Inventory: Ant Design Notification hub; shadcn notification bell pattern. Original styling
      over --lv-* tokens; no Tailwind UI or Ant Design code copied.
    - WAI-ARIA: bell button is icon-only -- bellAriaLabel is REQUIRED (button-name rule, APG).
      The unread count is EMBEDDED in aria-label ("Notifications, 3 unread") so AT users know
      the count without a separate badge announcement (no duplicate announcement).
    - Panel: role="region" aria-label="Notifications" (a navigable landmark, non-modal).
      Items: native ul/li in natural tab order. No roving tabindex (spec: collection-nav
      enhancer NOT composed). No focus trap (panel is non-modal; spec: focus-trap NOT composed).
    - Popover positioning: native popover API (popover="auto") + CSS Anchor Positioning for
      placement. Same overlay seam as dropdown-menu: no hand-rolled click-outside.
    - Count badge: inlined (no @template.lievit.badge compose) so the component stays
      self-contained for flat-resolver render tests.

  A11y (WAI-ARIA icon button + popover region):
    - Bell button: real native <button> (role=button + keyboard for free). Aria-label carries
      the count when unread ("Notifications, 3 unread"); without unread just "Notifications".
    - Count badge span: aria-hidden="true" -- decorative (count is already in aria-label).
    - aria-haspopup="listbox" on the bell button (the panel is a non-modal browsable list).
    - Panel: role="region" aria-label="${bellAriaLabel}" (landmark, not a menu).
    - Item list: ul/li native semantics; no additional ARIA role needed.
    - Unread dot per item: role="img" aria-label="unread" so the read/unread state is
      announced by AT, not only seen (colour is never the sole signal).
    - Esc closes the panel + restores focus to bell button (native popover light-dismiss).
    - No focus trap; no auto-focus on panel open.

  EXTRA ATTRIBUTES -- two channels (the XSS decision rule):
    - attrs (TRUSTED raw, $unsafe): STATIC author-typed strings only (data-testid, wire
      directives). NEVER interpolate a DB-derived or user-supplied value into attrs.
    - dataAttrs (SAFE escaped): Map of dynamic data-* on the bell button root. Each value is
      escaped via Escape.htmlAttribute (same routine as button.jte). Per-row DB values go
      here and ONLY here.

  Params:
    int                          unreadCount       = 0               Badge count; 0 hides the badge.
    int                          maxCount          = 99              Badge shows "99+" when count exceeds this.
    java.util.List items         = java.util.List.of()              Notification history. Each element is a
                                                                     Map of String to String with keys:
                                                                     variant, message, description, timestamp, read.
    String                       emptyLabel        = "No notifications"  Shown when items is empty.
    String                       clearAllLabel     = "Clear all"    Label for the clear-all button.
    String                       clearAllWireClick = null            Wire action name; button absent when null.
    String                       bellAriaLabel     = "Notifications" REQUIRED accessible name (icon-only button).
    String                       size              = "md"            Bell button height: "sm" | "md" | "lg".
    String                       id                = "lv-notification-bell"  Popover panel id (unique per page).
    String                       cssClass          = ""              Extra utility classes on the wrapper span.
    String                       attrs             = ""              TRUSTED raw ($unsafe) -- STATIC strings only.
    java.util.Map dataAttrs      = java.util.Map.of()               SAFE dynamic data-* on the bell button
                                                                     (values via Escape.htmlAttribute).

  Usage:
    @@template.lievit.notification-bell(bellAriaLabel = "Notifications", unreadCount = 3,
        items = notifItems)
    @@template.lievit.notification-bell(bellAriaLabel = "Notifications", unreadCount = 0,
        clearAllLabel = "Clear all", clearAllWireClick = "clearNotifications",
        emptyLabel = "Nothing to see here", size = "sm")
--%>
@param int unreadCount = 0
@param int maxCount = 99
@param java.util.List<java.util.Map<String, String>> items = java.util.List.of()
@param String emptyLabel = "No notifications"
@param String clearAllLabel = "Clear all"
@param String clearAllWireClick = null
@param String bellAriaLabel = "Notifications"
@param String size = "md"
@param String id = "lv-notification-bell"
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()

<%-- Anchor name for CSS Anchor Positioning: unique per bell instance via the panel id. --%>
!{var anchorName = "--" + id + "-anchor";}
!{var hasUnread = unreadCount > 0;}
!{var badgeLabel = unreadCount > maxCount ? (maxCount + "+") : String.valueOf(unreadCount);}
!{var effectiveBellLabel = hasUnread
    ? bellAriaLabel + ", " + badgeLabel + " unread"
    : bellAriaLabel;}

<%-- Bell button size: height-based toolbar-aligned scale (architecture contract section 5.b).
     iconOnly (w == h, square) because the bell button has no text label. --%>
!{var btnSize = switch (size) {
    case "sm" -> "var(--lv-space-8)";
    case "lg" -> "var(--lv-space-10)";
    default   -> "var(--lv-space-9)";
  };}

<%-- SAFE dynamic data-* fragment: each entry becomes data-<key>="<Escape.htmlAttribute(value)>".
     Keys must be simple identifiers ([A-Za-z][A-Za-z0-9-]*); non-identifier keys are dropped.
     Result is emitted with $unsafe because every value is already escaped. --%>
!{var dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), dataAttrs_);
      dataAttrs_.writeContent("\"");
    }
  }}
!{var dataAttrsMarkup = dataAttrs_.toString();}

<span
  data-slot="notification-bell"
  class="relative inline-flex ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>

  <%-- Bell trigger button: square icon-only, toolbar-height-aligned.
       popovertarget + popover API provides toggle, light-dismiss, and Esc-close with NO JS.
       aria-label is the SOLE accessible name (icon-only); it embeds the count when non-zero. --%>
  <button
    type="button"
    data-slot="notification-bell-trigger"
    data-unread-count="${unreadCount}"
    popovertarget="${id}"
    aria-haspopup="listbox"
    aria-label="${effectiveBellLabel}"
    $unsafe{dataAttrsMarkup}
    $unsafe{attrs}
    class="relative inline-flex shrink-0 items-center justify-center rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] text-[var(--lv-color-fg)] transition-[color,box-shadow] hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
    style="width:${btnSize};height:${btnSize};anchor-name:${anchorName};"
  >
    @template.lievit.icon(name = "bell", size = "1.125rem")

    <%-- Inline count badge: aria-hidden because the count is already in aria-label above.
         Rendered only when hasUnread -- a zero count leaves no pill in the DOM. --%>
    @if(hasUnread)
      <span
        data-slot="notification-bell-count"
        aria-hidden="true"
        class="absolute inline-flex items-center justify-center rounded-full font-[var(--lv-font-medium)] leading-none"
        style="top:-0.25rem;right:-0.25rem;min-width:1.125rem;height:1.125rem;padding:0 0.25rem;background:var(--lv-color-destructive);color:var(--lv-color-destructive-fg);font-size:0.625rem;"
      >${badgeLabel}</span>
    @endif
  </button>

  <%-- Notification panel: native popover (top-layer, light-dismiss + Esc, no JS).
       role="region" is a navigable landmark with an accessible name.
       Items are a plain ul/li list in natural tab order (no roving tabindex: spec section 4). --%>
  <div
    id="${id}"
    popover="auto"
    data-slot="notification-bell-panel"
    role="region"
    aria-label="${bellAriaLabel}"
    class="m-0 box-border w-80 max-w-[calc(100vw-var(--lv-space-4))] rounded-[var(--lv-radius-lg)] border border-[var(--lv-color-border)] bg-[var(--lv-color-popover)] text-[var(--lv-color-popover-fg)] shadow-[var(--lv-shadow-md)]"
    style="position-anchor:${anchorName};position-area:bottom span-all;position-try-fallbacks:flip-block;margin-block:var(--lv-space-1);z-index:var(--lv-z-popover);"
  >

    <%-- Panel header: title label + optional clear-all button (absent when clearAllWireClick is null). --%>
    <div data-slot="notification-bell-header" class="flex items-center justify-between gap-[var(--lv-space-2)] border-b border-[var(--lv-color-border)] px-[var(--lv-space-3)] py-[var(--lv-space-2)]">
      <span data-slot="notification-bell-title" class="text-[length:var(--lv-text-sm)] font-[var(--lv-font-semibold)] text-[var(--lv-color-fg)]">${bellAriaLabel}</span>
      @if(clearAllWireClick != null && !clearAllWireClick.isBlank())
        <button
          type="button"
          data-slot="notification-bell-clear-all"
          l:click="${clearAllWireClick}"
          class="inline-flex items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-sm)] px-[var(--lv-space-1)] py-[var(--lv-space-px)] text-[length:var(--lv-text-xs)] text-[var(--lv-color-muted-fg)] transition-colors hover:text-[var(--lv-color-fg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
        >@template.lievit.icon(name = "trash-2", size = "0.75rem")${clearAllLabel}</button>
      @endif
    </div>

    <%-- Notification item list: items iterate as ul/li. Each item reads Map keys:
         variant (info|success|warning|destructive), message, description, timestamp, read.
         The variant drives the intent icon and accent colour. read="true" suppresses the dot. --%>
    <div data-slot="notification-bell-list" class="max-h-96 overflow-y-auto">
      @if(items.isEmpty())
        <p data-slot="notification-bell-empty" class="px-[var(--lv-space-3)] py-[var(--lv-space-6)] text-center text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]">${emptyLabel}</p>
      @else
        <ul role="list" class="divide-y divide-[var(--lv-color-border)] p-0 m-0 list-none">
          @for(java.util.Map<String, String> item : items)
            !{var itemVariant = item.getOrDefault("variant", "info");}
            !{var itemMsg = item.getOrDefault("message", "");}
            !{var itemDesc = item.getOrDefault("description", null);}
            !{var itemTs = item.getOrDefault("timestamp", null);}
            !{var isRead = "true".equals(item.get("read"));}
            !{var itemIconName = switch (itemVariant) {
                case "success"     -> "circle-check";
                case "warning"     -> "triangle-alert";
                case "destructive" -> "circle-x";
                default            -> "info";
              };}
            !{var itemIconColor = switch (itemVariant) {
                case "success"     -> "var(--lv-color-success)";
                case "warning"     -> "var(--lv-color-warning)";
                case "destructive" -> "var(--lv-color-destructive)";
                default            -> "var(--lv-color-info)";
              };}
            <li
              data-slot="notification-bell-item"
              data-variant="${itemVariant}"
              class="flex items-start gap-[var(--lv-space-3)] px-[var(--lv-space-3)] py-[var(--lv-space-3)] transition-colors hover:bg-[var(--lv-color-accent)]"
            >
              <%-- Intent icon: decorative (the message text conveys meaning). --%>
              <span aria-hidden="true" class="mt-[var(--lv-space-px)] shrink-0" style="color:${itemIconColor};">
                @template.lievit.icon(name = itemIconName, size = "1rem")
              </span>
              <%-- Item body: message + optional description + optional timestamp. --%>
              <span data-slot="notification-bell-item-body" class="min-w-0 flex-1 space-y-[var(--lv-space-1)]">
                <p data-slot="notification-bell-item-message" class="m-0 text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] leading-snug text-[var(--lv-color-fg)]">${itemMsg}</p>
                @if(itemDesc != null && !itemDesc.isBlank())
                  <p data-slot="notification-bell-item-description" class="m-0 text-[length:var(--lv-text-xs)] leading-snug text-[var(--lv-color-muted-fg)]">${itemDesc}</p>
                @endif
                @if(itemTs != null && !itemTs.isBlank())
                  <p data-slot="notification-bell-item-timestamp" aria-hidden="true" class="m-0 text-[length:var(--lv-text-xs)] text-[var(--lv-color-muted)]">${itemTs}</p>
                @endif
              </span>
              <%-- Unread dot: colour-independent read/unread signal. role="img" + aria-label="unread"
                   announces the state to AT (colour is never the sole signal: WCAG 1.4.1). --%>
              @if(!isRead)
                <span
                  data-slot="notification-bell-item-dot"
                  role="img"
                  aria-label="unread"
                  class="mt-[var(--lv-space-2)] shrink-0 rounded-[var(--lv-radius-full)] bg-[var(--lv-color-primary)]"
                  style="width:0.5rem;height:0.5rem;"
                ></span>
              @endif
            </li>
          @endfor
        </ul>
      @endif
    </div>

  </div>
</span>
