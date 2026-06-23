<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — dialog (EXEMPLAR: overlay, WIRE + focus-trap + popover seam)

- **tier**: WIRE + ENH (`focus-trap.enhancer.ts` + the popover/overlay seam)
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/modal.jte` + `alert-dialog.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Dialog (modal) + **react-aria `useDialog` / `FocusScope` interaction model** as the
      pattern reference (the focus order + trap + ARIA wiring, transcribed into ORIGINAL template +
      `focus-trap` enhancer; no react-aria source copied)
    - inventory: Ant Design Modal as inventory reference (sizes, footer actions, closable; the
      confirm()-imperative-API maps to composing `alert-dialog` instead)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

## 1. What it is
A modal dialog: an overlay scrim + a centered panel whose OPEN-STATE is a server fact (`@Wire boolean open`)
and whose BODY is OWNED server-rendered markup (NOT a `<slot>` — the bug class the whole pivot killed). WIRE
because open/close + the body content are server-driven (gest's profile-TOTP-reset + mfa flows already drive
this with `l:click`). The irreducible CLIENT behavior — focus TRAP while open, focus RESTORE on close, Esc to
close, scrim click to close — is the shared `focus-trap` enhancer + the popover/overlay seam, NOT a hand-roll.
This is the canonical OVERLAY exemplar: every overlay (drawer, sheet, slide-over) composes the same two
shared mechanisms.

## 2. API — the WIRE surface + template params
**Java (`DialogComponent`)**:
| member | kind | meaning |
|---|---|---|
| `open` `boolean` | `@Wire` | the open-state (the single piece of overlay state) |
| `title` `String` | `@Wire @LievitProperty(locked=true)` | the dialog accessible name (→ `aria-labelledby`) |
| `size` `String` | `@Wire @LievitProperty(locked=true)` | sm \| md \| lg \| xl — panel max-width |
| `closable` `boolean` | `@Wire @LievitProperty(locked=true)` | shows the X + allows Esc/scrim close (false = must act) |
| `openDialog()` / `close()` | `@LievitAction` | set `open`; `close()` is a no-op when `!closable` is enforced by the action |
| (body) | OWNED template markup | the server-rendered dialog body, edited in the copied/owned template; NOT a slot |

**Template params**: one `@param` per `@Wire` field + `@param ComponentMetadata _component` (+ `_instance`
if a derived view is read). The footer actions are OWNED markup (buttons wired via `l:click`).

## 3. Variants / sizes / states
- size → panel max-width token (sm/md/lg/xl); the panel is centered, scrim covers the viewport.
- states: `open` reflected by rendering (panel present + `aria-modal`) or absent (`hidden`); a non-closable
  dialog drops the X and the enhancer disables Esc/scrim-close.

## 4. The a11y contract (the heart — the overlay model)
- **WAI-ARIA pattern**: APG Dialog (Modal).
- **roles + ARIA**:
    - panel: `role="dialog" aria-modal="true" aria-labelledby="<titleId>"` (and `aria-describedby` → the
      body region if a description exists); rendered only when `open` (when closed, the whole subtree is
      `hidden`/absent so it leaves the a11y tree + tab order).
    - title: `id="<titleId>"`.
    - close button: a real `<button>` with `aria-label="Close"` (icon-only → label mandatory, the button rule).
    - scrim: `--lv-color-overlay`, `aria-hidden="true"`, click → `close()` (when closable).
- **keyboard map**:
  | key | does | who |
  |---|---|---|
  | Esc | close (when closable) | enhancer (focus-trap owns the key while open) |
  | Tab / Shift+Tab | cycle focus WITHIN the panel only (the trap) | `focus-trap` enhancer |
  | Enter/Space on footer buttons | activate the wired action | platform (native buttons) |
- **focus management** (the load-bearing part):
    - **initial focus**: on open, focus moves into the panel — to the first focusable, or the close button,
      or an explicitly marked initial-focus element. (`focus-trap` enhancer.)
    - **trap**: while open, Tab cannot leave the panel (cycles within). (`focus-trap`.)
    - **restore**: on close, focus returns to the element that opened the dialog (the trigger). (`focus-trap`
      records the opener.)
    - **scroll lock**: body scroll is locked while open (the enhancer adds the lock; CSP-clean, no inline style).
- **live region**: none (a dialog is not a status announcer; an alert-dialog uses `role="alertdialog"` — see
  the `alert-dialog` spec, which composes THIS).
- **shared mechanisms composed**: `focus-trap.enhancer.ts` (initial focus + trap + restore + scroll lock +
  Esc) + the popover/overlay seam (the rendering + light-dismiss-on-scrim). Do NOT re-implement either —
  drawer/sheet/slide-over reuse the SAME two, parameterised (modal vs non-modal, center vs side).

## 5. Tokens
Reads `--lv-color-{overlay,popover,popover-fg,border,fg,muted}`, `--lv-z-{overlay,modal}` (scrim below
panel), `--lv-radius-lg`, `--lv-shadow-xl` (the panel elevation), `--lv-space-{4,6,…}`, `--lv-ring`. NET-NEW:
none (the overlay tokens `--lv-color-overlay` + `--lv-z-overlay/modal` already exist in the v2 token set).

## 6. Wire actions
- a trigger elsewhere fires `l:click="openDialog"` (or `$set('open', 'true')`); the X + scrim fire
  `l:click="close"`; footer buttons fire their own wire actions (`l:click="confirmReset"` etc.).
- round-trip: open click → `openDialog()` sets `open=true` → server re-renders WITH the panel → morph mounts
  it → the `focus-trap` enhancer (lifecycle `onComponentInit` / a directive on the panel) traps focus. Close
  → `close()` sets `open=false` → re-render WITHOUT the panel → morph removes it → enhancer restores focus to
  the opener.
- the enhancer registers on the panel's presence (a `l:dialog` directive or the lifecycle hook), reads
  `closable` to decide whether Esc/scrim close; it FIRES the `close` wire action (it does not close
  client-only — the server owns `open`, so closing is a wire round-trip; the enhancer just triggers it +
  manages focus/scroll meanwhile).

## 7. Acceptance tests
- **render** (real LievitRuntime + jsdom, REAL `focus-trap` mounted — NOT a mocked `$lievit`; this is exactly
  the substrate the slide-over empty-body bug slipped through): open → assert the panel is present, `role=
  dialog aria-modal=true`, the BODY content is VISIBLE (the projection assertion — the bug that shipped),
  `aria-labelledby` → the title. Close → assert the panel is gone from the DOM + a11y tree.
- **axe-core**: zero violations of the Dialog rules on the open panel.
- **keyboard**: Esc closes (closable) / is inert (non-closable); Tab cycles within the panel and never lands
  on a background element (assert the trap).
- **focus**: on open, focus is inside the panel; on close, focus is back on the opener; background scroll is
  locked while open.
- **wire round-trip IT** (lievit-kit, real runtime): mount → openDialog → re-render asserts panel + body;
  close → re-render asserts panel absent.
- **Playwright** (gesture fidelity, legacy-VM oracle): a real click opens, the body shows resolved fields
  (not a fake substrate), Esc + scrim-click close, focus returns to the trigger.

## 8. Agent instructions
Style ORIGINALLY over `--lv-*`; read public APG Dialog + React Aria `useDialog`/`FocusScope` SPEC + Ant
Design Modal feature set from training; never paste literal source from react-aria / ant-design / Tailwind UI
(the one bright line, `02`) — generate original code. Compose `focus-trap` + the popover
seam — do NOT hand-roll focus trapping or scroll lock (the single-source rule; drawer/sheet/slide-over depend
on the SAME enhancer being correct). The dialog body is OWNED template markup, NOT a `Content` slot (WIRE has
none — server-first refactor blueprint §1.b). Render the panel as a JTE boolean-attribute conditional
(`hidden`/present), never a smart-attribute null-drop. The render test MUST assert the body is VISIBLE after
open (the projection assertion is the lesson, not optional). Minimal code to GREEN.
