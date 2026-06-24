<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — alert-dialog

- **tier**: PARTIAL (composes the `dialog` WIRE component + the shared `focus-trap` enhancer it already owns)
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/alert-dialog.jte`, listed in `dialog` spec §1 as
  the compose-target for the Ant Design `confirm()`-imperative-API pattern)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Alertdialog pattern (https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/) +
      APG Modal Dialog keyboard/focus spec (https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) +
      **react-aria `useDialog` / `FocusScope` interaction model** as the pattern reference (the focus order,
      trap, and Esc handling are identical to the dialog — transcribed into ORIGINAL template; no source copied)
    - inventory: Ant Design Modal `confirm()` API as the inventory reference (destructive + warning variants,
      confirm/cancel action pair, no arbitrary body content — the bounded scope is the key feature)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

## 1. What it is

An alert dialog is a modal overlay that INTERRUPTS the user to demand an explicit decision before a
potentially irreversible action proceeds (delete, discard, sign-out, payment submit). It is the APG
`alertdialog` pattern: `role="alertdialog"` signals to assistive technology that the element is both an
alert (it demands immediate attention) and a dialog (it traps focus until dismissed). The distinguishing
constraints vs a plain `dialog`:

- The message is BOUNDED: a title + a short descriptive paragraph, never arbitrary nested structure. The
  spec mandates `aria-describedby` pointing to the message; this only works when the message is a flat
  region, not a complex widget tree.
- The action pair is FIXED: one confirm action (potentially destructive) + one cancel/dismiss action.
  There is no `footer` slot with arbitrary buttons — the confirm/cancel labels come in as params.
- Initial focus is prescribed by APG: for dialogs involving irreversible steps (data deletion, financial
  actions), focus the LEAST destructive action on open, not the first focusable.
- `closable` is always `false` by design: an alert dialog does NOT allow Esc-to-dismiss or scrim-click-
  to-dismiss. The user MUST choose one of the two explicit actions. (Esc is still listed in the keyboard
  map because the APG Dialog key spec includes it; here it is routed to the cancel action, not a neutral
  "close", so the action is always deliberate.)

TIER rationale: PARTIAL. The open-state lives in the composing WIRE template (the `dialog` component's
`open` `@Wire` field); this partial does not need its own `@Wire` field. It renders the `alertdialog`
overlay structure — title, description, confirm button, cancel button — and wires the two action buttons
via the `l:click` params supplied by the consumer. The `focus-trap` enhancer is inherited from the
composed dialog shell: the partial re-uses the same `data-lievit-trap` directive the dialog enhancer
already binds. No new enhancer is introduced by this component; the single-source-a11y rule holds.

Server-first works well here: the title, description, and action labels are server facts (they carry
context: "Delete 'Rossi Giovanni — 3 immobili'?" is a server-resolved string). The open/close cycle is
a wire round-trip (the dialog component drives it).

## 2. API — params

This partial is rendered INSIDE a consuming `dialog` WIRE component's owned template region. The consumer
controls `open`; the partial controls the alertdialog surface.

| param | type | default | meaning |
|---|---|---|---|
| title | String | — | **REQUIRED.** The alert dialog's accessible name. Rendered as a heading (`<h2 id="{titleId}">`); the root gets `aria-labelledby="{titleId}"`. No default — a missing title is a broken a11y contract. |
| description | String | — | **REQUIRED.** The alert message (the content `aria-describedby` points to). A short paragraph. Rendered as `<p id="{descId}">`. No default — without it `aria-describedby` is broken. |
| variant | String | "destructive" | INTENT of the confirm action: `destructive` \| `warning` \| `default`. Controls the confirm button's variant token pair AND the icon shown beside the title. |
| confirmLabel | String | "Confirm" | Label of the confirm (primary) action button. Shown on the left of the action pair in LTR (the more prominent position). |
| cancelLabel | String | "Cancel" | Label of the cancel/dismiss action button. |
| confirmWireClick | String | — | **REQUIRED.** Wire action name fired on confirm-button click (`l:click="{confirmWireClick}"`). The SAFE wire-action channel. |
| cancelWireClick | String | — | **REQUIRED.** Wire action name fired on cancel-button click (`l:click="{cancelWireClick}"`). Typically the same `close()` action the parent dialog exposes. |
| confirmWireArgs | Map<String,String> | {} | **SAFE escaped** per-row arguments for the confirm action (e.g. `{id: row.id()}`), merged via `Escape.htmlAttribute`. |
| cancelWireArgs | Map<String,String> | {} | **SAFE escaped** per-row arguments for the cancel action. |
| loading | boolean | false | When true, the confirm button shows a spinner + `aria-busy="true"` + blocks re-activation. Reflects the async round-trip state surfaced by the consumer. |
| iconSlot | gg.jte.Content | null | Optional icon rendered to the left of the title (e.g. a warning/destructive icon from `@template.lievit.icon`). When null, no icon region is rendered. |
| cssClass | String | "" | Extra utility classes on the panel root (for consumer-specific width overrides). |
| attrs | String | "" | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only on the panel root. Never fed user or DB data. |

NOTE on slots: this is a PARTIAL (not a WIRE component), so it CAN have `gg.jte.Content` slots. However,
the `description` and the action region are NOT open slots — they are structural and must remain bounded
so `aria-describedby` resolves correctly and focus initial placement is deterministic. Only `iconSlot` is
a content slot (a narrow escape for icon markup). There is NO general `body` or `footer` slot: if arbitrary
body content or more than two actions are needed, use the plain `dialog` component instead.

## 3. Variants / sizes / states

**Variants** (the `variant` param; controls the confirm button intent + the optional icon tint):

| variant | confirm button variant | icon tint token | use when |
|---|---|---|---|
| `destructive` (default) | `destructive` (`--lv-color-destructive` / `-fg`) | `--lv-color-destructive` | Delete, remove, revoke, purge |
| `warning` | `primary` with amber tint (`--lv-color-warning` / `-fg`) | `--lv-color-warning` | Non-destructive but high-stakes (payment confirm, logout, overwrite) |
| `default` | `primary` | `--lv-color-primary` | Low-risk confirmation that still requires an explicit choice |

The cancel button is always `ghost` variant (no fill), regardless of the alert variant. This ensures the
visual hierarchy directs attention to the deliberate choice (confirm = weighted) vs the safe exit
(cancel = recessive).

**Sizes**: the alert dialog has no `size` param. The panel width is FIXED at a narrow max-width
(`max-w-sm`, resolving via `--lv-space-*` scale) because the content is bounded: title + one paragraph
+ two buttons. A wider panel would imply more content than this pattern allows. The dialog component's
`size` param is irrelevant here; the consumer should pass a fixed narrow size or the partial imposes its
own class.

**States**:

- `loading=true` on confirm button: spinner (reuses `spinner` partial), `aria-busy="true"`, pointer-events
  blocked. The cancel button remains active so the user can still bail.
- The panel itself has no `disabled` state: the dialog is always interactive while open.
- `data-variant="{variant}"` on the panel root: the CSS token switch selects the icon + border-accent tint
  (a thin coloured left-border or icon-zone background, Tailwind UI-style).
- The panel root also carries `data-slot="alert-dialog"` for test targeting and adopter CSS hooks.

## 4. The a11y contract (the heart — the alertdialog model)

**WAI-ARIA pattern**: APG Alertdialog (Modal).
Verified against: https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/ and
https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ (keyboard + focus rules, alertdialog inherits
the modal dialog keyboard spec).

**roles + ARIA** (the critical differences from plain `dialog`):

- Panel root: `role="alertdialog" aria-modal="true" aria-labelledby="{titleId}" aria-describedby="{descId}"`.
  - `role="alertdialog"` (NOT `role="dialog"`): the alert role asserts this is both an alert AND a modal.
    Screen readers (NVDA, JAWS, VoiceOver) will typically announce the dialog name + the description
    text immediately on open, without the user needing to navigate into the content.
  - `aria-describedby="{descId}"` is **MANDATORY** here (unlike plain dialog where it is optional): the
    `alertdialog` role is only meaningful when it has a linked description. A missing `aria-describedby`
    on `role="alertdialog"` is an axe-core violation.
  - `aria-modal="true"`: signals to AT that content outside the dialog is inert. Combined with the
    focus-trap (which also blocks programmatic focus escape), this satisfies both the AT and platform
    requirements for modal containment.
- Title: `<h2 id="{titleId}">`: a real heading element, not a `<div>`. The `h2` is the semantic level
  for a dialog title inside a page hierarchy (the page `<h1>` is the outer context; the dialog is a
  subordinate section).
- Description: `<p id="{descId}">`: a real paragraph. Must NOT be a complex structure (no lists, no
  tables, no form controls inside it) — if you need that, use `dialog` instead.
- Icon slot wrapper (when used): `aria-hidden="true"` on the icon container — the icon is decorative,
  the title + description are the accessible content.
- Confirm button: a real `<button type="button">` wired via `l:click="{confirmWireClick}"`. No
  `aria-label` needed (the label text is visible). When `loading=true`: `aria-busy="true"` + `disabled`.
- Cancel button: a real `<button type="button">` wired via `l:click="{cancelWireClick}"`. Always enabled.
- No scrim click-to-close: the `focus-trap` enhancer's light-dismiss-on-scrim behavior is suppressed
  (`closable=false` on the parent dialog, propagated as `data-closable="false"` on the panel; the
  enhancer reads this flag).
- No close-X button: there is intentionally no X in the corner. The user must use the two labeled actions.

**keyboard map** (exact APG Modal Dialog keyboard spec, adapted for alertdialog):

| key | does | who |
|---|---|---|
| Tab | Move focus to next tabbable element inside the panel; wraps from the last to the first | `focus-trap` enhancer |
| Shift+Tab | Move focus to previous tabbable element inside the panel; wraps from the first to the last | `focus-trap` enhancer |
| Esc | Fires the `cancelWireClick` action (routes Esc to the cancel action — never a neutral dismiss, always a deliberate choice) | `focus-trap` enhancer (reads the cancel-wire-click from `data-cancel-action` on the panel) |
| Enter / Space on confirm button | Activate the confirm action | platform (native `<button>`) |
| Enter / Space on cancel button | Activate the cancel action | platform (native `<button>`) |

NOTE on Esc: the APG Dialog spec says "Escape closes the dialog". For a plain `dialog` with `closable=true`
this is a neutral close. For `alertdialog`, closing IS choosing cancel — so Esc routes to the cancel wire
action, not a separate close mechanism. This matches the react-aria interaction model for confirm dialogs
(AlertDialog: Esc fires `onCancel`). The enhancer reads `data-cancel-action="{cancelWireClick}"` from the
panel to know which action to fire on Esc.

**focus management** (load-bearing):

- **initial focus**: on open, focus moves to the CANCEL button (the least destructive action), per the
  APG guideline for dialogs with irreversible steps: "focus the least destructive action". This is the
  critical difference from a plain dialog (which focuses the first focusable or a marked element).
  Implemented via `data-initial-focus` attribute on the cancel button; the `focus-trap` enhancer reads
  `data-initial-focus` to place focus there first. (React Aria `AlertDialog` does the same: `autoFocus`
  on the Cancel button by default.)
- **trap**: while open, Tab + Shift+Tab cycle within the panel only, never escaping to background content.
  Owned by `focus-trap.enhancer.ts` (the same single enhancer used by `dialog`, `drawer`, `sheet`).
- **restore**: on close (either confirm or cancel), focus returns to the element that triggered the open
  (the element that fired `openDialog()`). The `focus-trap` enhancer records the opener before trapping.
- **scroll lock**: body scroll is locked while open. The enhancer adds the lock when it installs the trap
  and removes it when the panel leaves the DOM (same as `dialog`).

**live region**: `role="alertdialog"` itself triggers an immediate announcement by AT on open (the dialog
name + description are announced without user navigation). No additional `role="alert"` or `aria-live`
region is needed or appropriate inside the panel — stacking alert roles creates double-announcement.

**shared mechanisms composed**:

- `focus-trap.enhancer.ts` (initial focus + trap + Esc routing + restore + scroll lock): the SINGLE
  source, parameterised via `data-*` attributes on the panel root. Do NOT hand-roll any of these.
- The popover/overlay seam (the scrim rendering + panel positioning): inherited from the parent `dialog`
  WIRE component's template shell. The alert-dialog PARTIAL renders INTO that shell.

This component composes two shared mechanisms, does NOT re-implement either, and does NOT introduce a new
one.

## 5. Tokens

Reads (directly or via composed partials):

| token | use |
|---|---|
| `--lv-color-overlay` | scrim background (from the parent dialog shell) |
| `--lv-color-popover` | panel background |
| `--lv-color-popover-fg` | panel text |
| `--lv-color-border` | panel border |
| `--lv-color-destructive` | confirm button + icon tint when variant=destructive |
| `--lv-color-destructive-fg` | confirm button text when variant=destructive |
| `--lv-color-warning` | icon tint + confirm button accent when variant=warning |
| `--lv-color-warning-fg` | confirm button text when variant=warning |
| `--lv-color-primary` | confirm button when variant=default |
| `--lv-color-primary-fg` | confirm button text when variant=default |
| `--lv-color-fg` | panel body text |
| `--lv-color-muted` | description text (slightly subdued) |
| `--lv-space-4` | panel padding (inner) |
| `--lv-space-6` | panel padding (outer / top) |
| `--lv-space-3` | gap between action buttons |
| `--lv-radius-lg` | panel border-radius |
| `--lv-shadow-xl` | panel elevation (same as dialog) |
| `--lv-z-modal` | z-index of the panel (above overlay) |
| `--lv-z-overlay` | z-index of the scrim |
| `--lv-ring` | focus-visible ring on buttons |
| `--lv-text-sm` | description paragraph text size |
| `--lv-text-base` | title text size |
| `--lv-font-sans` | font family |

**NET-NEW tokens**:

- `--lv-color-warning` / `--lv-color-warning-fg`: a warning-intent semantic colour pair for amber/yellow
  high-stakes-but-not-destructive alerts. The `destructive` token already exists; `warning` is additive.
  Authored in OKLCH. Added to `:root` + `.dark` re-point block. Justified: the `warning` intent is used
  across at least three other components (badge, alert, toast) — the token is a library-wide semantic, not
  alert-dialog-private. Goes into `registry/tokens/lievit-tokens.css` in BOTH blocks.

No other net-new tokens. The alert-dialog rides the existing overlay + button + typography token set.

## 6. Wire / island integration

The alert-dialog is a **PARTIAL rendered inside the owned-markup region of a `dialog` WIRE component**. It
does not have its own `@Wire` fields; the open/close state is owned by the parent `DialogComponent`.

**Typical consumer template** (the consuming WIRE template's owned region):

```
<%-- Inside a DialogComponent-owned .jte, when the dialog is open --%>
@template.lievit.alert-dialog(
    title="Elimina attività",
    description="Questa azione non può essere annullata. L'attività verrà eliminata permanentemente.",
    variant="destructive",
    confirmLabel="Elimina",
    cancelLabel="Annulla",
    confirmWireClick="deleteActivity",
    cancelWireClick="close",
    confirmWireArgs=${Map.of("id", activity.id())}
)
```

**JTE template structure** (the `alert-dialog.jte` rendered body):

```
<div
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="${titleId}"
    aria-describedby="${descId}"
    data-slot="alert-dialog"
    data-variant="${variant}"
    data-closable="false"
    data-cancel-action="${cancelWireClick}"
    class="[panel-layout-classes using --lv-* tokens] ${cssClass}"
    $unsafe{attrs}
>
    <%-- Icon + title row --%>
    <div data-slot="alert-dialog-header">
        @if(iconSlot != null)
            <span aria-hidden="true" data-slot="alert-dialog-icon">
                ${iconSlot}
            </span>
        @endif
        <h2 id="${titleId}" data-slot="alert-dialog-title">${title}</h2>
    </div>

    <%-- Description (the aria-describedby target) --%>
    <p id="${descId}" data-slot="alert-dialog-description" class="[muted text classes]">
        ${description}
    </p>

    <%-- Action pair: cancel first in DOM (gets initial focus), confirm second --%>
    <div data-slot="alert-dialog-actions">
        @template.lievit.button(
            variant="ghost",
            type="button",
            attrs=${"l:click=\"" + cancelWireClick + "\" data-initial-focus"},
            wireArgs=${cancelWireArgs},
            content=${cancelLabel}
        )
        @template.lievit.button(
            variant=${variant},
            type="button",
            loading=${loading},
            attrs=${"l:click=\"" + confirmWireClick + "\""},
            wireArgs=${confirmWireArgs},
            content=${confirmLabel}
        )
    </div>
</div>
```

Key structural decisions in the template:

- The cancel button comes FIRST in DOM order and carries `data-initial-focus`. The `focus-trap` enhancer
  reads `data-initial-focus` on the panel's first child matching that attribute and focuses it on open.
  DOM order = cancel first means Tab-from-cancel → confirm, which is the natural left-to-right order. The
  visual layout may reverse this (confirm left, cancel right) via `flex-row-reverse` or explicit ordering
  — but DOM order is cancel-first for a11y (initial focus) + screen-reader linear reading.
- `data-closable="false"` on the root: the `focus-trap` enhancer reads this to suppress Esc-as-neutral-
  close and instead route Esc to `data-cancel-action`.
- `data-cancel-action="{cancelWireClick}"` on the root: the enhancer fires this wire action on Esc, making
  Esc === cancel (always a deliberate choice, never a silent dismiss).
- `${title}` and `${description}` are output through the standard JTE HTML-escaped channel (JTE's default
  `${}` output, not `$unsafe`). DB-derived strings go here safely.
- `confirmWireArgs` and `cancelWireArgs` flow through the SAFE escaped channel (`wireArgs` →
  `Escape.htmlAttribute` per value) on the two buttons, identical to the `button.jte` per-row pattern.
- No `<script>`, no `on*=` attributes, no inline event handlers. CSP-clean.

**Enhancer responsibilities** (the `focus-trap.enhancer.ts`, already built for `dialog`, parameterised):

The partial introduces no new enhancer code. It communicates intent to the existing `focus-trap` enhancer
via `data-*` attributes. The enhancer, when it finds a panel with `data-closable="false"`, suppresses the
scrim-click-to-close and routes Esc to `data-cancel-action`. This parameterisation is added to the
`focus-trap` enhancer spec as part of the `alert-dialog` build — it is a CONFIG extension, not a behavior
fork (one enhancer, parameterised, not two enhancers).

**The round-trip**:

1. User triggers open: a button elsewhere fires `l:click="openDialog"` on the parent `DialogComponent`.
2. Server sets `open=true` → re-renders the dialog shell → the alert-dialog partial renders inside it.
3. Morph patches the DOM → panel appears → `focus-trap` lifecycle hook fires → moves focus to
   `data-initial-focus` element (the cancel button) → installs the trap → locks body scroll.
4. User presses confirm → `l:click` fires `confirmWireClick` → server action runs (validation + authz
   BEFORE mutation) → server closes + executes the irreversible action → re-render without panel → morph
   removes panel → enhancer restores focus to the opener.
5. User presses cancel (or Esc) → `cancelWireClick` fires (e.g. `close()`) → server sets `open=false` →
   re-render without panel → morph removes panel → enhancer restores focus to opener.

## 7. Acceptance tests

The component is DONE only when ALL pass. Real substrate, not mocked (the client-island-fidelity lesson).

**render** (real `LievitRuntime` + jsdom, REAL `focus-trap` enhancer mounted — the same substrate the
slide-over empty-body bug slipped through):

- `RENDER-01: panel presence on open` — parent dialog opens → assert the panel is present in the DOM,
  `role="alertdialog"`, `aria-modal="true"`, `data-slot="alert-dialog"` present.
- `RENDER-02: aria-labelledby resolves` — assert `aria-labelledby` on the panel points to an element
  whose text content equals the `title` param.
- `RENDER-03: aria-describedby resolves` — assert `aria-describedby` on the panel points to an element
  whose text content equals the `description` param. This is the mandatory alertdialog contract; a missing
  or mis-pointing `aria-describedby` is an explicit test failure (not just an axe warning).
- `RENDER-04: panel absence on close` — after cancel action fires → assert the panel is absent from the
  DOM and from the a11y tree.
- `RENDER-05: no close-X present` — assert no element with `aria-label="Close"` exists in the panel.
- `RENDER-06: no scrim-dismiss` — assert no click-handler on the scrim fires the close action (the
  `data-closable="false"` flag is present and the enhancer reads it).

**axe-core** (run on the rendered open-panel DOM, zero violations of these rules):

- `AXEA-01: alertdialog` — axe rule `aria-dialog-name`: the element with `role="alertdialog"` has an
  accessible name (`aria-labelledby` resolves to non-empty text). Zero violations.
- `AXEA-02: aria-describedby present and resolves` — axe rule `aria-valid-attr-value`: `aria-describedby`
  value references an existing element id. Zero violations.
- `AXEA-03: no aria-modal without trap` — the panel has `aria-modal="true"` AND the `focus-trap` is
  installed (assert `document.activeElement` is inside the panel). Zero violations.
- `AXEA-04: button accessible names` — confirm + cancel buttons have non-empty accessible names (their
  label text). Zero violations of `button-name`.
- `AXEA-05: heading structure` — the title is a real `<h2>`. Zero violations of `heading-order` within
  the panel scope.

**keyboard** (each key in the §4 map asserted on the REAL enhancer — not a mocked `$lievit`):

- `KB-01: Tab cycles within panel` — open dialog → Tab three times → assert focus never leaves the panel;
  after the last tabbable element, Tab wraps to the first.
- `KB-02: Shift+Tab cycles backward` — open dialog → Shift+Tab → assert focus moves to the last tabbable
  inside the panel.
- `KB-03: Esc fires cancel action` — open dialog → press Esc → assert the `cancelWireClick` action is
  fired (server receives the cancel action name, not a neutral close signal).
- `KB-04: Enter on confirm activates` — Tab to confirm button → Enter → assert `confirmWireClick` fires.
- `KB-05: Enter on cancel activates` — initial focus is on cancel → Enter → assert `cancelWireClick` fires.

**focus** (the load-bearing focus contract):

- `FOCUS-01: initial focus on cancel button` — open dialog → assert `document.activeElement` is the
  cancel button (the element with `data-initial-focus`), NOT the confirm button and NOT the panel root.
- `FOCUS-02: trap holds` — while open, simulate Tab exhausting all focusable elements → assert focus
  never lands outside the panel (no background link, no body, no document itself).
- `FOCUS-03: focus restores on cancel` — record the opener element → cancel → assert
  `document.activeElement === openerElement`.
- `FOCUS-04: focus restores on confirm` — record the opener element → confirm → assert focus returns
  to the opener after the round-trip morph.
- `FOCUS-05: body scroll locked while open` — open dialog → assert `document.body` has the scroll-lock
  class/style applied by the enhancer. Close → assert it is removed.

**variants / states**:

- `VAR-01: destructive variant` — `variant="destructive"` → assert `data-variant="destructive"` on the
  panel root; assert the confirm button has the destructive token class; assert the icon tint class
  references `--lv-color-destructive`.
- `VAR-02: warning variant` — assert the warning token class on icon + confirm button.
- `VAR-03: default variant` — assert the primary token class on the confirm button.
- `STATE-01: loading state` — `loading=true` → assert confirm button has `aria-busy="true"` and is
  disabled; assert cancel button is NOT disabled.
- `STATE-02: cancel always active` — regardless of `loading`, the cancel button is never disabled.

**wire round-trip IT** (lievit-kit, real runtime, the `CollapsibleComponentIT` pattern):

- `IT-01: open → render → cancel → close` — mount a consuming `DialogComponent` that includes the
  alert-dialog partial → trigger `openDialog()` → assert panel present + correct aria attributes →
  trigger cancel action → assert panel absent.
- `IT-02: open → confirm → close` — trigger `openDialog()` → trigger confirm action → assert the
  server-side consequence (a test-scoped boolean flag toggled by the confirm action) + panel absent.
- `IT-03: confirmWireArgs reach the action` — provide `confirmWireArgs={id: "test-42"}` → assert the
  server action receives `id="test-42"` correctly (the per-row safe-channel test).

**escaping** (the XSS abuse-case):

- `XSS-01: hostile confirmWireArgs renders inert` — set `confirmWireArgs={id: "\">|<script>alert(1)"}` →
  render → assert the rendered `data-id` attribute value is HTML-escaped and no `<script>` tag appears.
- `XSS-02: title is HTML-escaped` — `title="<img onerror=alert(1)>"` → assert it renders as literal text,
  not as an injected element (JTE's default `${}` channel handles this; verify it is not `$unsafe`).

**Playwright** (gesture fidelity, legacy-VM oracle):

- `PW-01: real keyboard flow` — open alert-dialog → real `page.keyboard.press('Tab')` → assert focus
  moves within the panel → `page.keyboard.press('Escape')` → assert dialog is gone + focus is on the
  opener. The body content (title + description strings) must be visible (the projection assertion —
  not a fake substrate).
- `PW-02: confirm action executes` — open → click confirm button → assert the server-side consequence
  is visible in the page (row deleted, count decremented, etc.) on the live VM.

**JTE compiles + renders**: covered by the `test/jte-compile` real-compiler + render gate (already in
the pre-commit framework).

## 8. Non-goals / anti-patterns

This component deliberately does NOT do the following. If you need these, use `dialog` instead.

- **No arbitrary body content**: the body is a single `<p>` paragraph. A form, a list, a data table, or
  any interactive content inside the alert message is NOT supported and would break the `aria-describedby`
  contract. Use `dialog` for rich body content.
- **No more than two actions**: confirm + cancel. A three-button alert ("Save / Discard / Cancel") is a
  `dialog` with custom footer markup. The two-button contract is load-bearing for the focus prescription
  (cancel = least destructive = initial focus is only unambiguous with exactly two actions).
- **No Esc-to-dismiss (neutral)**: Esc always routes to the cancel action. There is no way to dismiss the
  alert-dialog without triggering one of the two wire actions. This is intentional (APG: irreversible
  step → user must choose).
- **No scrim-click-to-dismiss**: same rationale. `data-closable="false"` is hardcoded; consumers cannot
  override it to `true` on an alert-dialog partial.
- **No close-X button**: same rationale. Composing a close button inside an alert-dialog is an anti-pattern.
- **No imperative / programmatic open API**: the open-state lives in the parent `DialogComponent`'s
  `@Wire boolean open` field, driven by a wire action. There is no `AlertDialog.show()` static method
  (the Ant Design `Modal.confirm()` imperative API pattern). In a server-first stack, open-state is a
  server fact, not a client-side imperative call. If you need a toast-style automatic alert, use the
  `toast` component.
- **No title-less alert-dialog**: `title` is mandatory. An alert-dialog without a visible, linked title
  fails the `aria-dialog-name` axe rule. There is no `title=null` escape hatch.
- **No description-less alert-dialog**: `description` is mandatory for the same reason. An alertdialog
  without `aria-describedby` is semantically incomplete; axe will flag it.
- **Not a toast / notification**: the alert-dialog is MODAL and BLOCKS all interaction. For a
  non-blocking status message, use `toast` (`role="status"` / `role="alert"`). For a banner, use
  `alert` (PARTIAL, inline).

## 9. Agent instructions

Generate ORIGINAL code over `--lv-*`; you may read the WAI-ARIA APG alertdialog + modal dialog patterns,
React Aria `AlertDialog` + `FocusScope` specs, and Ant Design Modal `confirm()` feature set as pattern
references; never paste literal source from react-aria / ant-design / Tailwind UI (the one bright line,
`02`) — the output is always original generation.

Compose `focus-trap.enhancer.ts` (initial focus + trap + Esc-to-cancel + scroll lock) and the parent
`dialog` overlay shell — do NOT hand-roll focus trapping, Esc routing, or scroll lock.

The `focus-trap` enhancer needs a ONE-TIME parameterisation addition: reading `data-closable="false"` to
suppress neutral Esc-close and instead fire `data-cancel-action`. Implement this as a CONFIG extension
of the existing enhancer (a new `data-*` attribute branch), not a separate enhancer file. Update the
enhancer spec + its acceptance tests in the same commit.

Mirror `button.jte` conventions exactly: typed `@param`, `data-slot`, the two escaping channels (title
and description through JTE's default `${}` escaped channel, `wireArgs`/`confirmWireArgs`/`cancelWireArgs`
through `Escape.htmlAttribute`, `attrs` as `$unsafe` trusted-only — never DB data through `attrs`),
zero `<script>`, zero `on*=`.

The cancel button MUST carry `data-initial-focus`. The render test `FOCUS-01` MUST pass — the least-
destructive-action focus placement is the spec, not optional.

Add `--lv-color-warning` / `--lv-color-warning-fg` OKLCH tokens to `registry/tokens/lievit-tokens.css`
in BOTH `:root` and `.dark` blocks (additive, library-wide semantic, not alert-dialog-private).

Minimal code to GREEN against the acceptance tests; refactor only while green.
