<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — toast / notification-bell (live-region announcer + notification hub)

- **tier**: PARTIAL (the individual toast item markup, server-rendered) + ENH (`toast.enhancer.ts`,
  vanilla-TS, owns the queue, timing, dismissal, and announcement lifecycle)
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of the existing `toast` enhancer + any
  `registry/jte/toast*.jte` partials; this spec pins the a11y contract and the clean split between the
  server-rendered item partial and the client-side queue manager)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Alert pattern (`role=alert`, `aria-live=assertive` for destructive/warning;
      `role=status` / `aria-live=polite` for info/success) — sourced from
      https://www.w3.org/WAI/ARIA/apg/patterns/alert/ + MDN `role=status` reference; react-aria
      `useToast`/`useToastRegion` interaction model as the pattern reference for the queue + focus
      management; no react-aria source copied
    - inventory: Ant Design Message + Notification as inventory reference (placement, duration, queue,
      notification-bell hub; the manual Notification instance API maps to server-event-driven toast
      insertion here; `alert` variant maps to the `destructive` intent)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual look inspired by Tailwind UI
      (NO code copied)

---

## 1. What it is

A **toast** is a transient, non-blocking status announcement: a short message that appears in a corner
of the viewport, auto-dismisses after a configurable duration, and can be manually dismissed early.
A **notification-bell** is a persistent hub that collects the same items as a browsable list, so
nothing is lost after a toast auto-disappears.

The component is two surfaces sharing one data model:

1. **Toast region + items** — the live-region container (`role=status` or `role=alert` per intent) that
   a screen reader announces; the visual items that stack in a corner and dismiss over time.
2. **Notification-bell** — an icon-button badge that opens a dropdown panel showing the full
   notification history; items land here simultaneously with the toast.

**Why PARTIAL + ENH, not WIRE**: the message content and severity come from the SERVER (a Spring action
emits them via the `Lievit-Toast` response header or a direct model attribute), but the QUEUE state —
which toasts are currently visible, their countdown timers, the dismiss animation, the bell unread-count
— is EPHEMERAL CLIENT state that must survive across multiple wire round-trips and does not belong in a
`@Wire` field. The JTE partial renders ONE item's markup to a static HTML string; the enhancer owns the
queue, injects/removes items from the live region, and keeps the bell counter. A server-push path
(Server-Sent Events / HTMX `hx-sse`) is the mechanism for proactive server notifications; the enhancer
handles the event and inserts the item. This split is the right architecture: the server owns CONTENT,
the enhancer owns TRANSIENCE.

---

## 2. API — params / props

### 2.a Toast item partial (`toast-item.jte`)

One JTE partial renders the markup for a single toast item. The enhancer calls it (via a
pre-rendered server fragment or a JS-side template stamp, see §6) to inject into the live region.

| param | type | default | meaning |
|---|---|---|---|
| `variant` | `String` | `"info"` | `info \| success \| warning \| destructive` — the intent; drives the live-region role and the token pair |
| `message` | `String` | — | the primary message text (REQUIRED; rendered in the item body) |
| `description` | `String` | `null` | optional secondary line below the message |
| `duration` | `int` | `5000` | auto-dismiss after this many ms; `0` = persistent until manual dismiss |
| `dismissible` | `boolean` | `true` | show the X close button |
| `toastId` | `String` | — | a server-assigned id (`UUID`); used by the enhancer as `data-toast-id` to target the item for removal |
| `icon` | `String` | `null` | optional icon name (Lucide slug); falls back to the intent-default icon when null |
| `action` | `String` | `null` | optional action label (a link or button text inside the toast, e.g. "Undo") |
| `actionHref` | `String` | `null` | if set, the action renders as `<a href>` (navigation); mutually exclusive with `actionWireClick` |
| `actionWireClick` | `String` | `null` | if set, the action renders as a `<button l:click="...">` (wire action); mutually exclusive with `actionHref` |
| `actionWireArgs` | `Map<String,String>` | `{}` | **SAFE escaped** per-action wire args (values via `Escape.htmlAttribute`); forwarded as `data-*` on the action button |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (e.g. `data-testid="toast-success"`) |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` (value via `Escape.htmlAttribute`) |

The two escaping channels mirror `button.jte` exactly:
- `attrs` = **trusted raw** (`$unsafe`): ONLY author-typed static strings; never feed DB-derived or
  user-supplied data here.
- `dataAttrs` / `actionWireArgs` = **safe escaped**: every value passes through
  `Escape.htmlAttribute`; a hostile string renders inert.

### 2.b Toast region partial (`toast-region.jte`)

The container live-region that wraps the item stack. Rendered once into the page layout (in the
`<body>` footer, outside any `aria-modal` surface so it is always reachable by AT).

| param | type | default | meaning |
|---|---|---|---|
| `placement` | `String` | `"bottom-end"` | `top-start \| top-center \| top-end \| bottom-start \| bottom-center \| bottom-end` — absolute corner position |
| `maxVisible` | `int` | `5` | maximum items shown simultaneously; overflow is queued by the enhancer |
| `attrs` | `String` | `""` | **TRUSTED raw** extra attributes |

### 2.c Notification-bell partial (`notification-bell.jte`)

The icon-button + badge + dropdown panel that lists accumulated notifications. Composed from the
existing `button`, `badge`, `dropdown-menu` / `popover` partials.

| param | type | default | meaning |
|---|---|---|---|
| `unreadCount` | `int` | `0` | badge count; `0` hides the badge |
| `maxCount` | `int` | `99` | badge shows `99+` when count exceeds this |
| `items` | `List<NotificationItem>` | `List.of()` | the accumulated notification history (server-rendered in the panel body; passed from the controller) |
| `emptyLabel` | `String` | `"No notifications"` | shown when `items` is empty |
| `clearAllLabel` | `String` | `"Clear all"` | label for the clear-all action button |
| `clearAllWireClick` | `String` | `null` | wire action name to clear all (if null, the button is absent) |
| `bellAriaLabel` | `String` | `"Notifications"` | accessible name on the bell button (REQUIRED; icon-only button) |
| `attrs` | `String` | `""` | **TRUSTED raw** extra attributes on the bell button |

### 2.d `NotificationItem` (Java record, the shared data model)

```java
public record NotificationItem(
    String id,          // server-assigned UUID
    String variant,     // info | success | warning | destructive
    String message,
    String description, // nullable
    Instant timestamp,
    boolean read
) {}
```

The same record is used for the toast live-region and the bell panel, so the server emits ONE data
structure and both surfaces consume it.

### 2.e Enhancer attributes (the `data-lievit-toast-*` surface)

The enhancer reads these from the DOM to configure per-page behaviour (set on the toast-region root):

| attribute | type | meaning |
|---|---|---|
| `data-toast-placement` | String | mirrors `placement`; the enhancer uses it to confirm corner CSS |
| `data-toast-max-visible` | int | mirrors `maxVisible` |
| `data-toast-sse-url` | String | optional; if present, the enhancer opens an `EventSource` on this URL and listens for `toast` events (server-push path) |
| `data-toast-bell-id` | String | the `id` of the notification-bell element on the same page; the enhancer increments its badge counter when a new toast is queued |

---

## 3. Variants / Sizes / States / Slots

### Variants (intent-driven)

| variant | live-region role | aria-live | intent icon (default) | token pair |
|---|---|---|---|---|
| `info` | `role="status"` | `polite` | `info` (Lucide) | `--lv-color-info` / `--lv-color-info-fg` |
| `success` | `role="status"` | `polite` | `circle-check` | `--lv-color-success` / `--lv-color-success-fg` |
| `warning` | `role="alert"` | `assertive` | `triangle-alert` | `--lv-color-warning` / `--lv-color-warning-fg` |
| `destructive` | `role="alert"` | `assertive` | `circle-x` | `--lv-color-destructive` / `--lv-color-destructive-fg` |

The live-region ROLE is chosen per-variant because AT interruption level must match urgency:
- `info` and `success` use `role=status` (`aria-live=polite` implicit) — the AT announces when the
  user is idle; appropriate for non-urgent confirmations ("Saved", "Uploaded").
- `warning` and `destructive` use `role=alert` (`aria-live=assertive` implicit) — the AT interrupts
  immediately; appropriate for errors and actions that need immediate attention.

The toast REGION element carries the correct role at render time (server-rendered by `toast-region.jte`
with a `data-toast-role-{polite,assertive}` container split — see §6). The enhancer inserts items into
the correct sub-container.

### Sizes

Toast items do not follow the `sm|md|lg` height-based size scale (they are not toolbar controls).
They have a fixed internal layout:
- icon: `--lv-space-5` (20px square)
- body text: `--lv-text-sm`
- description: `--lv-text-xs`
- minimum width: `--lv-space-72` (288px); maximum width: `--lv-space-96` (384px)
- padding: `--lv-space-4` (16px) all sides

The notification-bell button DOES follow the `sm|md|lg` scale (it is a toolbar-aligned icon button,
composed from the `button` partial with `iconOnly=true`).

### States

| state | visual | ARIA |
|---|---|---|
| entering | slide-in + fade-in transition (CSS, `--lv-motion-*` tokens) | item is present in the live region → AT announces |
| visible | steady | — |
| dismissing | fade-out + slide-out (class toggled by enhancer, CSS transition) | none; AT has already announced |
| dismissed | removed from DOM | — |
| persistent (`duration=0`) | no countdown; visible until manual dismiss | — |
| bell-unread | badge shows `unreadCount` | `aria-label` on the badge updates (e.g. "3 unread notifications") |
| bell-open | panel open (composed from `popover` seam) | `aria-expanded=true` on the bell button |

### Slots / composition

Toast items have no `gg.jte.Content` slot (they are PARTIAL, not WIRE, but their content is fully
parameter-driven, not a free slot — the action element and the description line are optional params,
not open composition points). The notification-bell panel body is OWNED markup in the partial (the list
of `NotificationItem`s is rendered by a `!{for item : items}` loop).

---

## 4. The a11y contract

- **WAI-ARIA pattern**: APG Alert pattern for disruptive variants (`role=alert`, assertive);
  `role=status` (polite live region) for non-disruptive variants. Both are covered by the APG Alert
  page (https://www.w3.org/WAI/ARIA/apg/patterns/alert/) and the ARIA spec `role=status` definition
  (https://www.w3.org/TR/wai-aria-1.2/#status). The react-aria `useToast`/`useToastRegion` interaction
  model is the pattern reference for focus management and keyboard interaction on individually-focused
  items; no react-aria source is copied.

- **roles + ARIA**:
    - **Toast region** (the live-region container in the page body, always in the DOM):
      two sub-containers, one `role="status" aria-live="polite" aria-atomic="false"` (for info/success)
      and one `role="alert" aria-live="assertive" aria-atomic="false"` (for warning/destructive).
      `aria-atomic="false"` is deliberate: items are individual announcements, not a single atomic
      region — the AT announces each new child as it is inserted, not the full container text.
      `aria-relevant="additions"` (the default for live regions) is left implicit; removals are silent.
    - **Individual toast item** (`data-slot="toast-item"`):
      no additional ARIA role (it lives inside the live region; its text is the announcement).
      The close button is a real `<button aria-label="Dismiss notification">`.
      The optional action is `<button>` or `<a href>` with visible label text (no icon-only action).
      `data-toast-id="<uuid>"` on the item root (the enhancer uses this to target it for removal).
    - **Notification-bell button**: a real `<button>` (`iconOnly=true` → `ariaLabel` REQUIRED, the
      button rule) composed from the `button` partial. `aria-expanded` reflects the panel open-state
      (managed by the `popover` seam). `aria-haspopup="dialog"` if the panel uses `role=dialog`;
      `aria-haspopup="menu"` if it uses `role=menu`; here the panel is a non-modal list, so
      `aria-haspopup="listbox"` or `aria-haspopup="true"` is acceptable (match the popover seam
      convention).
    - **Bell panel** (the notification history dropdown):
      `role="region" aria-label="Notifications"` (it is a landmark region with accumulated history).
      Each item row: `role="listitem"` inside a `<ul>` (the natural list semantics). The unread badge:
      `<span aria-hidden="true">` visually + the count is embedded in the bell button's `aria-label`
      (e.g. `aria-label="Notifications, 3 unread"`) so AT users know the count without a separate badge
      announcement.

- **keyboard map**:

  | key | does | who |
  |---|---|---|
  | Tab (in page) | moves focus into a visible toast item if the item is focusable (i.e. it has a dismiss button or an action button) | platform (the items are in normal tab order in the DOM) |
  | Shift+Tab (in page) | reverse tab, same | platform |
  | Enter / Space (on dismiss X) | dismisses the toast (fires the enhancer dismiss, removes from DOM) | platform (native `<button>`) |
  | Enter / Space (on action button) | fires the action (`l:click` wire action or `<a href>` navigation) | platform (native `<button>` / `<a>`) |
  | Esc (while a toast item is focused) | dismisses the currently-focused toast, returns focus to previously-focused element | enhancer (`toast.enhancer.ts`) |
  | Tab (in notification-bell panel) | navigates among panel items and the "clear all" button | platform |
  | Esc (while bell panel is open) | closes the bell panel, returns focus to the bell button | `popover` seam (light-dismiss) |
  | Enter / Space (on bell button) | opens/closes the bell panel | platform (native `<button>`) |
  | F6 / Shift+F6 | (NOT handled; toast items are NOT a landmark-to-landmark jump; they are in normal DOM flow) | — |

  Toast items deliberately do NOT implement roving tabindex or a focus trap. They are non-modal and must
  not interrupt the user's current task. The APG Alert pattern explicitly states: "alerts do not affect
  keyboard focus". Focus ONLY moves to a toast if the user explicitly Tabs into it.

- **focus management**:
    - **No auto-focus on toast appearance.** The APG Alert pattern is unambiguous: a toast must not
      steal focus. Focus stays where it is when a toast appears.
    - **Esc to dismiss** (while focused within a toast item): the enhancer listens for `keydown` on
      each item; Esc fires the dismiss + restores focus to the element that was focused before the user
      tabbed into the toast. The enhancer records the `document.activeElement` at the moment the user's
      focus enters the toast item (via `focusin` event), and restores it on Esc-dismiss or on the
      auto-dismiss that fires while the item still has focus.
    - **Auto-dismiss with focus inside**: if the countdown timer fires while the user has focus inside
      the toast, the enhancer DOES NOT dismiss immediately. It PAUSES the timer until focus leaves the
      item (`focusout` event), then resumes (or dismisses if the paused time was already elapsed).
      This is the react-aria `useToast` model: hover + focus both pause the timer. A toast that the
      user is reading is never ripped away.
    - **Notification-bell panel**: the panel is opened via the `popover` seam (non-modal, no trap).
      On open, focus moves to the first focusable item in the panel (the first notification row or
      "Clear all"). On close, focus returns to the bell button. The `popover` seam's light-dismiss
      owns this.
    - **No focus trap.** Toast items are non-modal; the bell panel is non-modal. Neither composes
      `focus-trap.enhancer.ts`.

- **live region**:
    - The live-region container is the primary a11y mechanism. The AT announces inserted text; no
      separate `aria-label` on each item is needed.
    - `aria-live=polite` (status container): announced when the user is idle — correct for
      confirmation toasts ("File saved").
    - `aria-live=assertive` (alert container): interrupts immediately — correct for error toasts.
    - The live-region container MUST be present in the DOM BEFORE any announcement is inserted. The
      enhancer NEVER creates the container dynamically; `toast-region.jte` renders it at page load.
      This is the load-order invariant that makes dynamic live regions reliable across AT.
    - The bell badge count change does NOT use a live region for its numeric update; instead the count
      is embedded in the bell button's `aria-label` (updated by the enhancer via
      `button.setAttribute('aria-label', ...)`) so the announcement is governed by the button's AT
      focus, not a proactive interruption.
    - The notification-bell panel (browsable history) is a NON-live region; it is navigated
      intentionally by the user, not announced proactively.

- **shared mechanisms composed**:
    - The **`popover` seam** (native `popover` + CSS Anchor Positioning): the notification-bell
      dropdown panel is positioned and light-dismissed via this seam. Do NOT hand-roll positioning or
      click-outside.
    - The **shared live-region announcer** (the `toast` surface itself IS the canonical announcer for
      the library — see `03-component-inventory.md` §4, "live-region announcer" reused by form error
      summary, async loading). The two sub-containers (polite / assertive) are the mechanism every
      other component in the library targets when it needs to announce something. Build them once here.
    - `focus-trap.enhancer.ts` is NOT composed (toasts are non-modal, no trap).
    - `collection-nav.enhancer.ts` is NOT composed (the bell panel list is a plain `<ul>` in tab
      order, no roving tabindex needed).

---

## 5. Tokens

### Colour tokens (OKLCH, source-of-truth format)

| token | usage |
|---|---|
| `--lv-color-info` | `info` variant background |
| `--lv-color-info-fg` | `info` variant text + icon |
| `--lv-color-success` | `success` variant background |
| `--lv-color-success-fg` | `success` variant text + icon |
| `--lv-color-warning` | `warning` variant background |
| `--lv-color-warning-fg` | `warning` variant text + icon |
| `--lv-color-destructive` | `destructive` variant background |
| `--lv-color-destructive-fg` | `destructive` variant text + icon |
| `--lv-color-bg` | toast item background (for a neutral/white card style over the intent-coloured border variant) |
| `--lv-color-border` | subtle border on the toast item card |
| `--lv-color-fg` | message text (neutral) |
| `--lv-color-muted` | description text (secondary) |
| `--lv-color-popover` | notification-bell panel background |
| `--lv-color-popover-fg` | notification-bell panel text |
| `--lv-color-overlay` | not used (no scrim; toasts are non-modal) |
| `--lv-ring` | focus-visible ring on the dismiss button + action + bell button |

### Structural tokens

| token | usage |
|---|---|
| `--lv-space-4` (16px) | item padding all sides |
| `--lv-space-5` (20px) | intent icon size (square) |
| `--lv-space-6` (24px) | gap between icon and body |
| `--lv-space-2` (8px) | gap between message and description; gap between body and dismiss button |
| `--lv-space-72` (288px) | toast item min-width |
| `--lv-space-96` (384px) | toast item max-width |
| `--lv-space-3` (12px) | notification-bell panel item row padding vertical |
| `--lv-radius-lg` | toast item card border-radius |
| `--lv-shadow-md` | toast item card drop-shadow |
| `--lv-shadow-xs` | notification-bell panel shadow |
| `--lv-z-toast` | z-index for the toast region stack (NET-NEW, see below) |
| `--lv-z-popover` | z-index for the bell dropdown panel |
| `--lv-text-sm` | message text size |
| `--lv-text-xs` | description text size; badge count text |
| `--lv-text-base` | — (not used directly) |
| `--lv-font-sans` | all text |
| `--lv-motion-enter` | enter transition duration for the slide-in |
| `--lv-motion-exit` | exit transition duration for the fade-out |
| `--lv-motion-easing` | easing curve for both transitions |

### NET-NEW tokens (additive, justified)

| token | value (OKLCH default) | dark re-point | justification |
|---|---|---|---|
| `--lv-z-toast` | `500` | (same; structural, theme-invariant) | The toast region stacks above overlays (`--lv-z-overlay ~= 400`) but below `alertdialog` (`--lv-z-modal ~= 600`). A toast must render over a non-modal drawer (z ~300) but not occlude a modal dialog the user must respond to. Without this token an adopter has no clean override point. Goes in `:root` block only (structural). |
| `--lv-color-info` | `oklch(0.82 0.10 220)` | `oklch(0.35 0.10 220)` | Intent-colour pair for the `info` variant (sky-blue family). If the token already exists in `lievit-tokens.css` under another name, map it; if not, add it to both `:root` and `.dark`. Paired with `--lv-color-info-fg`. |
| `--lv-color-info-fg` | `oklch(0.25 0.10 220)` | `oklch(0.92 0.06 220)` | Foreground on `--lv-color-info` backgrounds. |

(If `--lv-color-info`/`-fg` already exist in the v2 token set under these exact names, do not re-add
them — verify against `registry/tokens/lievit-tokens.css` before proposing; the above are additive
only if absent.)

---

## 6. Wire / island integration

### Server-rendered JTE structure

The page layout template includes `toast-region.jte` once, immediately before `</body>`. It is NOT
inside any WIRE component root and NOT inside any `aria-modal` surface (modals must not occlude it).

```
<!-- toast-region.jte renders: -->
<div data-slot="toast-region"
     data-toast-placement="${placement}"
     data-toast-max-visible="${maxVisible}"
     [data-toast-sse-url if set]
     [data-toast-bell-id if set]
     class="fixed [placement-utilities] z-[--lv-z-toast] flex flex-col gap-[--lv-space-2] pointer-events-none">

  <!-- polite sub-container (info, success) -->
  <div role="status" aria-live="polite" aria-atomic="false" aria-relevant="additions"
       data-slot="toast-live-polite"
       class="contents">
  </div>

  <!-- assertive sub-container (warning, destructive) -->
  <div role="alert" aria-live="assertive" aria-atomic="false"
       data-slot="toast-live-assertive"
       class="contents">
  </div>
</div>
```

Both sub-containers are present at page load (before any toast fires), satisfying the live-region
pre-existence invariant.

`toast-item.jte` renders ONE item's markup. The server produces this fragment (either inline in a
`Lievit-Toast` response header payload, or as a pre-rendered HTML fragment) and the enhancer injects
it into the correct sub-container.

```
<!-- toast-item.jte renders: -->
<div data-slot="toast-item"
     data-variant="${variant}"
     data-toast-id="${toastId}"
     data-toast-duration="${duration}"
     role="none"
     class="pointer-events-auto flex items-start gap-[--lv-space-6] rounded-[--lv-radius-lg]
            bg-[--lv-color-bg] border border-[--lv-color-border] shadow-[--lv-shadow-md]
            p-[--lv-space-4] min-w-[--lv-space-72] max-w-[--lv-space-96]
            [variant-accent-border-left]">

  <!-- intent icon -->
  <span aria-hidden="true" class="shrink-0 size-[--lv-space-5] text-[--lv-color-{variant}]">
    @template.lievit.icon(name = resolvedIcon, size = "sm")
  </span>

  <!-- body -->
  <div data-slot="toast-body" class="flex-1 space-y-[--lv-space-2]">
    <p data-slot="toast-message"
       class="text-[--lv-text-sm] font-medium text-[--lv-color-fg]">${message}</p>
    !{if description != null}
      <p data-slot="toast-description"
         class="text-[--lv-text-xs] text-[--lv-color-muted]">${description}</p>
    !{endif}
    !{if action != null}
      !{if actionHref != null}
        <a href="${actionHref}"
           class="text-[--lv-text-xs] font-medium underline text-[--lv-color-primary] hover:text-[--lv-color-primary-hover] focus-visible:outline-none focus-visible:ring-[--lv-ring]">
          ${action}
        </a>
      !{else if actionWireClick != null}
        <button type="button"
                l:click="${actionWireClick}"
                ${actionWireArgs rendered as escaped data-* attributes}
                class="text-[--lv-text-xs] font-medium underline text-[--lv-color-primary] hover:text-[--lv-color-primary-hover] focus-visible:outline-none focus-visible:ring-[--lv-ring]">
          ${action}
        </button>
      !{endif}
    !{endif}
  </div>

  <!-- dismiss button (when dismissible) -->
  !{if dismissible}
    <button type="button"
            data-slot="toast-dismiss"
            aria-label="Dismiss notification"
            class="shrink-0 rounded-[--lv-radius-sm] p-[--lv-space-1] text-[--lv-color-muted]
                   hover:text-[--lv-color-fg] hover:bg-[--lv-color-accent]
                   focus-visible:outline-none focus-visible:ring-[--lv-ring]">
      @template.lievit.icon(name = "x", size = "sm", ariaHidden = true)
    </button>
  !{endif}
</div>
```

`notification-bell.jte` renders the bell button (composed from `button` partial, `iconOnly=true`) plus
the popover-seam panel containing a `<ul>` list of `NotificationItem` rows. Each row renders the
variant icon, message, description, timestamp, and a per-item dismiss button (wire action).

### Enhancer responsibilities (`toast.enhancer.ts`)

The enhancer is registered in the lievit runtime's lifecycle registry. It activates when
`data-slot="toast-region"` is present on the page.

**Queue management**:
- Maintains an in-memory ordered queue of pending toast items (items that have not yet been displayed,
  when `maxVisible` is reached).
- On receiving a new item (from any insertion path), checks if the visible count < `maxVisible`. If
  yes, inserts the item into the DOM immediately. If no, holds it in queue and inserts when a visible
  item dismisses.

**Insertion paths** (the three ways a new toast arrives):
1. **Wire round-trip response**: the `Lievit-Toast` HTTP response header carries a JSON payload
   `{variant, message, description, duration, dismissible, id, icon?, action?}`. The runtime morph
   hook reads this header (a runtime concern, not the enhancer's) and dispatches a custom DOM event
   `lievit:toast` with the payload. The enhancer listens for `lievit:toast` and inserts the item.
2. **Server-Sent Events** (proactive push): when `data-toast-sse-url` is set, the enhancer opens an
   `EventSource` on that URL and listens for events of type `toast`. The `data` is the same JSON
   payload. The enhancer inserts the item.
3. **Direct JS API** (for adopter scripts that must trigger a toast outside a wire round-trip):
   `window.lievit.toast({variant, message, ...})` dispatches the `lievit:toast` DOM event above,
   which the enhancer handles uniformly. This path keeps CSP compliance (no `eval`, no inline
   script) — the adopter calls a global function that was set up by the runtime during init.

**Item lifecycle**:
- On insertion, the enhancer reads `data-toast-duration`. If > 0, starts a `setTimeout` for that
  duration.
- The enhancer adds `focusin` / `focusout` listeners to the item to pause/resume the timer while
  the user has focus inside (the hover-pauses-timer model; hover is handled via CSS `animation-play-
  state: paused` on `:hover` — no JS needed for the visual pause, but the enhancer extends the
  `setTimeout` on `focusin` to prevent forced dismissal while focused).
- On timer expiry (or on click of the dismiss button, or on `keydown` Esc inside the item), the
  enhancer adds the exit CSS class (`data-dismissing`) to trigger the fade-out transition, then
  removes the item from the DOM after `--lv-motion-exit` duration, then dequeues the next pending
  item.
- On Esc-dismiss, restores focus to the element recorded at the `focusin` event.

**Bell counter**:
- When `data-toast-bell-id` is set, the enhancer finds the bell element and increments the
  `data-unread-count` attribute + updates `aria-label` on the bell button. The bell partial renders
  the initial count server-side; the enhancer only INCREMENTS it for toasts that arrive after page
  load (without a full round-trip that would re-render the bell).

**Directives registered**:
- `l:toast-dismiss` (a directive on the dismiss button, alternative to the click listener): fires the
  dismiss on the parent item. The current implementation uses a plain `click` listener; a directive
  is acceptable if the enhancer follows the runtime directive registry API.
- No `l:*` wire directives are registered by the enhancer itself (it is a PARTIAL enhancer, not a
  WIRE enhancer; the wire actions on action buttons are wired in the template via `l:click`).

**The enhancer is NOT Turbo, NOT a framework**. It is a typed-TS module that registers via the
lievit runtime lifecycle registry (`lifecycleRegistry.register('toast', { init, destroy })`), is
CSP-clean (no eval, no inline), and fires no framework-specific events.

---

## 7. Acceptance tests

The component is DONE only when ALL of the following pass on REAL substrates (not mocked).

### Render tests (jsdom + the real JTE compile gate)

- **`toast-region renders two live-region sub-containers`**: renders `toast-region.jte` with
  `placement="bottom-end" maxVisible=3`; asserts `[data-slot="toast-live-polite"][role="status"][aria-live="polite"]`
  and `[data-slot="toast-live-assertive"][role="alert"][aria-live="assertive"]` are both present in the
  DOM (the load-order invariant: containers must exist before any announcement).
- **`toast-item renders all variants`**: renders `toast-item.jte` for each of `info / success /
  warning / destructive`; asserts `data-variant`, the correct intent icon default, the message text,
  no extra ARIA role on the item (it is text inside the live region, no `role` needed on the item).
- **`toast-item renders description when provided`**: asserts `[data-slot="toast-description"]` is
  present when `description` is set; absent when null.
- **`toast-item renders dismiss button when dismissible=true`**: asserts `[data-slot="toast-dismiss"]
  [aria-label="Dismiss notification"]` is a `<button>`.
- **`toast-item renders action as <a> when actionHref set`**: asserts an `<a href>` with the action
  label; no `<button>` for the action.
- **`toast-item renders action as <button l:click> when actionWireClick set`**: asserts
  `<button l:click="...">`.
- **`notification-bell renders with bell aria-label and unread badge`**: renders `notification-bell.jte`
  with `unreadCount=3`; asserts the bell `<button>` accessible name contains "3" (or the full
  `aria-label` value includes the count); asserts `[data-slot="badge"]` is present.
- **`notification-bell hides badge when unreadCount=0`**: asserts no badge element (or `hidden`) when
  `unreadCount=0`.
- **`notification-bell renders item list`**: passes 2 `NotificationItem` instances; asserts 2 `<li>`
  rows with message text.
- **`notification-bell shows empty label when items empty`**: asserts the `emptyLabel` string is
  rendered.
- **JTE compiles + renders**: covered by the `test/jte-compile` real-compiler + render gate (all three
  partials: `toast-region.jte`, `toast-item.jte`, `notification-bell.jte`).

### axe-core assertions (zero violations on the cited APG / ARIA rules)

- **`axe on toast-region + item (info variant)`**: render a `toast-region` containing an injected
  `info` toast item; run axe; assert zero violations. Rules of particular interest: `aria-live-region-
  content`, `aria-valid-attr-value`, `button-name` (dismiss button has `aria-label`).
- **`axe on toast-region + item (destructive variant)`**: as above for `role=alert` container.
- **`axe on notification-bell (open panel)`**: render the bell with the panel open; run axe; assert
  zero violations. Rules: `button-name` (bell button has `aria-label`), `list` (panel uses `<ul><li>`
  correctly).
- **`axe on toast-item without dismiss (non-dismissible)`**: `dismissible=false`; assert zero
  violations (no orphaned dismiss button).
- **`iconOnly bell button without ariaLabel FAILS axe`**: assert that rendering `notification-bell.jte`
  without `bellAriaLabel` (or with an empty string) produces an axe `button-name` violation (the rule
  test itself).

### Keyboard tests (each asserted on a REAL substrate)

- **`Enter/Space on dismiss button dismisses the toast`** (jsdom + real enhancer mounted): inject an
  item into the live region; Tab into the dismiss button; press Enter; assert the item is removed from
  the DOM after the exit transition.
- **`Esc while focused inside toast dismisses and restores focus`**: set focus on an element outside
  the toast; Tab into the dismiss button; press Esc; assert (1) the toast item is removed from DOM;
  (2) the previously-focused external element regains focus.
- **`Esc does not dismiss a non-dismissible toast`**: `dismissible=false`; Tab into the action button
  (the only focusable child); press Esc; assert the toast item is still in the DOM.
- **`Enter on action button (wire action) fires the click`** (jsdom + real enhancer): assert the
  `click` event fires on the action button.
- **`Esc closes bell panel and returns focus to bell button`** (jsdom + popover seam): open the bell
  panel; press Esc; assert panel is closed (or `hidden`) + focus is on the bell button.
- **`Tab in bell panel navigates items in order`**: assert Tab moves focus sequentially through
  notification item rows and the "Clear all" button without escaping the panel (the panel is
  non-modal but has natural tab order in the DOM).

### Focus management tests

- **`Auto-dismiss pauses while item has focus`**: inject an item with `duration=200`; Tab into the
  dismiss button (triggers `focusin`); wait 300ms; assert the item is still in the DOM (timer is
  paused); Tab away (`focusout`); assert the item eventually dismisses.
- **`Auto-dismiss fires after duration when not focused`**: inject an item with `duration=200`; wait
  250ms; assert the item is removed from the DOM.
- **`No auto-focus on toast appearance`**: record `document.activeElement` before inserting a toast;
  insert a toast item into the live region; assert `document.activeElement` has NOT changed (the
  toast must not steal focus).

### Queue / maxVisible tests (enhancer, jsdom)

- **`Queue holds items beyond maxVisible`**: inject 6 items with `maxVisible=3`; assert exactly 3
  items are in the DOM; dismiss one; assert a 4th item enters.
- **`Items enter in insertion order`**: inject items A, B, C with `maxVisible=1`; dismiss A; assert B
  appears next, then C.

### Variant / state tests

- **`info variant uses polite sub-container`**: assert the item is injected into `[data-slot=
  "toast-live-polite"]`, not the assertive container.
- **`destructive variant uses assertive sub-container`**: assert injected into `[data-slot=
  "toast-live-assertive"]`.
- **`persistent toast (duration=0) does not auto-dismiss`**: inject with `duration=0`; wait 5000ms;
  assert still in DOM.

### Escaping tests (XSS abuse cases)

- **`hostile message string renders inert`**: render `toast-item.jte` with
  `message = "<script>alert(1)</script>"`; assert the DOM text content is the literal string with
  the tag characters escaped; no `<script>` element in the rendered output.
- **`hostile actionWireArgs value renders inert`**: render with
  `actionWireArgs = {id: '"><script>x</script>'}`; assert the `data-id` attribute value is
  HTML-escaped (the `Escape.htmlAttribute` path), never a tag.
- **`hostile dataAttrs value renders inert`**: same pattern as `wireArgs`.
- **`attrs is documented trusted-only`**: assert (by review convention + lint) that `attrs` is never
  fed a runtime/DB value in any usage in the codebase.

### Wire round-trip / SSE test (integration)

- **`Lievit-Toast header inserts a toast on morph`** (real LievitRuntime IT, `CollapsibleComponentIT`
  pattern): mount a page with a WIRE component that returns a `Lievit-Toast` header on a wire action;
  fire the action; assert the morph step dispatches `lievit:toast`; assert the toast item appears in
  the live-region container in the rendered DOM.
- **`SSE path inserts a toast`** (jsdom + mock `EventSource`): provide a mock `EventSource` that
  emits a `toast` event; assert the enhancer inserts the item into the correct sub-container.

### Playwright (gesture fidelity, real legacy-VM oracle)

- **`Toast appears and auto-dismisses on a real page action`**: perform a real save action that
  triggers a `success` toast; assert the toast text is visible; wait for the duration; assert it is
  gone.
- **`Keyboard dismiss on real page`**: a real `page.keyboard.press('Tab')` into the dismiss button;
  `page.keyboard.press('Enter')`; assert the toast is gone from the DOM.
- **`Notification-bell opens, shows history, closes on Esc`**: real `page.click` on the bell; assert
  panel is visible and contains at least one notification row; `page.keyboard.press('Escape')`; assert
  panel is gone and focus is on the bell button.

---

## 8. Non-goals / anti-patterns

- **NOT an alert-dialog**: a toast does not block user interaction, does not steal focus, and does not
  require a response before the user can continue. Destructive-action confirmation ("Are you sure?")
  belongs in `alert-dialog`, not a destructive toast.
- **NOT a form error summary**: inline field-level validation errors belong in the `field` partial's
  error region (`aria-describedby`) or a form-level error summary with `role=alert`. Toast is for
  TRANSIENT system messages, not persistent field errors.
- **NOT server-rendered live HTML** (no WIRE tier): the toast content is defined by the SERVER but
  the insertion is CLIENT-managed. There is no `@Wire boolean toastVisible` field and no WIRE
  component for toasts. The server communicates via the `Lievit-Toast` header (a protocol convention),
  not by owning client display state.
- **NOT a Turbo Stream**: do NOT insert toast items via Turbo Stream `<turbo-stream action="append">`.
  lievit owns its own morph; Turbo is not in the stack (ADR-0012). The insertion mechanism is the
  `lievit:toast` DOM event dispatched by the runtime morph hook.
- **NOT a framework island**: the enhancer is typed-vanilla-TS, CSP-clean, dependency-free. No Lit
  component, no Alpine directive, no React. The existing `toast` enhancer is in the registry; v-next
  re-forges it, it does not replace it with a framework.
- **NOT the aria-live container for ALL announcements**: the toast region is the CANONICAL live-region
  announcer for the library, and other components (form error summary, async loading indicator) route
  their announcements through it — but they do so via the `lievit:toast` event API, NOT by writing
  directly into the sub-containers. The sub-containers' DOM is exclusively managed by the enhancer;
  nothing else injects or removes children from them.
- **Do NOT put the toast region inside an aria-modal surface**: a dialog or drawer with
  `aria-modal=true` hides everything outside it from AT. The region MUST be outside any modal overlay.
  This is an architectural constraint on the page layout, enforced by the placement in `<body>` footer.
- **Do NOT make toasts persist past navigation** via Turbo Drive caching: Turbo Drive (page navigation)
  may cache a page with visible toast items in the DOM. The enhancer's `destroy` lifecycle hook MUST
  cancel all pending timers and clear the live-region children so a restored page cache is clean.
- **Do NOT flash more than 3 times per second**: rapid successive toasts that cause the live-region
  content to change faster than 3Hz are a WCAG 2.3.1 (Three Flashes) risk and an AT usability
  disaster. The `maxVisible` cap + the queue mechanism are the technical enforcement; do not bypass
  them.

---

## Agent instructions

Generate ORIGINAL code over `--lv-*` tokens. You MAY read the WAI-ARIA APG Alert pattern
(https://www.w3.org/WAI/ARIA/apg/patterns/alert/), react-aria `useToast`/`useToastRegion` SPEC, and
Ant Design Notification / Message feature set from training as REFERENCES for pattern and inventory.
You MUST NOT paste literal source from react-aria, ant-design, or Tailwind UI — the output is always
original generation (`02-licensing.md`).

The two live-region sub-containers (`role=status` polite + `role=alert` assertive) MUST be rendered
in the JTE partial and present at page load BEFORE any toast fires. This is the single most important
correctness constraint: a dynamically created live region is unreliable across AT.

The enhancer owns the queue, timers, and DOM insertion — NOT the JTE partial. The JTE partial is a
static stamp; the enhancer is the actor. Keep this split clean.

Compose the `popover` seam for the notification-bell dropdown — do NOT hand-roll positioning or
light-dismiss.

The `Lievit-Toast` response-header protocol is the primary insertion path for wire-triggered toasts.
Specify and implement this header in the runtime morph hook (or confirm it already exists in the
existing `toast` enhancer's runtime integration) before wiring the acceptance tests.

The auto-dismiss-pause-on-focus rule is load-bearing for a11y: a user who has keyboard-navigated into
the toast to read it must not have it pulled out from under them. Assert this with the focus-pause test
before declaring the enhancer done.

Mirror the escaping channels from `button.jte` exactly. `message` and `description` are server-provided
strings that MUST be HTML-escaped in the template; use the JTE `${...}` escaped interpolation (not
`$unsafe`). `attrs` is the one trusted-raw channel; document it in the header comment and restrict it
to static author strings.

Minimal code to GREEN against the acceptance tests. The keyboard map + focus rules + live-region
pre-existence + the hostile-string escaping tests are all contract assertions — assert ALL of them.
