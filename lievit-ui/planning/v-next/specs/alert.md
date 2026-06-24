<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — alert

- **tier**: PARTIAL
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/alert.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Alert (`role="alert"`, `role="status"` by intent — platform live-region;
      no react-aria reference needed because the role is the entire contract; no interactive focus
      behavior; closable variant uses a native `<button>` for platform keyboard)
    - inventory: Ant Design Alert as inventory reference (info/success/warning/error variants,
      icon, closable, description, banner mode)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

## 1. What it is

A banner that delivers a brief, contextual message — informational, success, warning, or error — without
interrupting the user's task or moving keyboard focus. The message is server-composed (the controller
decides whether to render an alert and with what content); the client receives the fully-formed HTML.
Static presentation → PARTIAL: the component holds no client state. Server-first works trivially: the
alert is markup, nothing more. The one interactive element — the dismiss button when `closable=true` —
is a real `<button>` served in the same markup; the consuming template wires the dismiss action via
`l:click` on it, or a plain form POST / navigation removes the alert on the next render. No enhancer is
needed.

The `role` is chosen by INTENT at render time (`info`/`success` → `role="status"` for polite
announcement; `warning`/`destructive` → `role="alert"` for assertive announcement). This is the
"role by intent" row in `03-component-inventory.md`.

## 2. API — params

| param | type | default | meaning |
|---|---|---|---|
| variant | String | "info" | INTENT: info \| success \| warning \| destructive — determines role, icon, and token pair |
| title | String | null | optional bold heading; when set, the description is the supporting line; when null, the message goes directly in the body |
| icon | boolean | true | show the variant-default icon (a `@template.lievit.icon` composed from the variant); set false to suppress |
| iconName | String | null | override the default variant icon with a named Lucide icon slug; only used when icon=true |
| closable | boolean | false | render the dismiss `<button>` (X); the consuming template wires `l:click="dismiss"` on it |
| banner | boolean | false | full-bleed layout (no border-radius, flush left/right edges); used for page-level system notices at the top of a viewport |
| role | String | null | override the auto-derived live-region role (auto: info→status, success→status, warning→alert, destructive→alert); pass "none" to suppress the role entirely for purely decorative display |
| cssClass | String | "" | extra utility classes appended to the root |
| attrs | String | "" | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (data-testid, aria-atomic overrides) |
| dataAttrs | Map<String,String> | {} | **SAFE escaped** dynamic data-* (value via `Escape.htmlAttribute`) |
| content | gg.jte.Content | — | the primary message body (the human-readable text; when title is also set, this is the description beneath it) |
| action | gg.jte.Content | null | optional inline action slot rendered after the body (e.g. a link or a small button) |

### Derived values (computed inside the template via `!{var ...}`)

| derived | from | value |
|---|---|---|
| `effectiveRole` | variant + role override | `"status"` for info/success; `"alert"` for warning/destructive; the explicit `role` param wins; `"none"` suppresses |
| `variantClass` | variant | a switch mapping variant → token-class string |
| `defaultIconName` | variant | info→"info", success→"circle-check", warning→"triangle-alert", destructive→"circle-x" |
| `resolvedIconName` | iconName, defaultIconName | iconName if provided, else defaultIconName |

## 3. Variants / sizes / states

### Variants (intent → role + token pair + icon)

| variant | live-region role | icon (default) | surface token | border / icon token |
|---|---|---|---|---|
| info | `role="status"` | info circle | `--lv-color-info` | `--lv-color-info-border` |
| success | `role="status"` | circle-check | `--lv-color-success` | `--lv-color-success-border` |
| warning | `role="alert"` | triangle-alert | `--lv-color-warning` | `--lv-color-warning-border` |
| destructive | `role="alert"` | circle-x | `--lv-color-destructive` | `--lv-color-destructive-border` |

The mapping follows the shared library intent vocabulary (architecture contract §5.a): `destructive`
here is the same token pair as `destructive` on a button — consistent across the library.

### Sizes

Alert does not take a `size` param. It is a layout-driven banner, not a toolbar control. The internal
spacing is fixed (`--lv-space-3`/`--lv-space-4` padding) and the text size is `--lv-text-sm` for the
body, `--lv-text-sm` (medium weight) for the title. This is correct: alert does not need to align flush
in a toolbar row, so the height-based scale from buttons/inputs does not apply.

### States

- **default**: rendered with the variant's surface + border token, the live-region role.
- **closable**: the dismiss `<button>` (X, icon-only, `aria-label="Dismiss"`) is rendered in the
  trailing position; the consuming template wires `l:click="dismiss"` (or any action) onto it. The
  alert's own markup is complete; dismissal is a server concern (the controller stops rendering it on
  the next response).
- **banner**: no `border-radius` (straight edges), full-bleed horizontal (no outer margin); the top
  border becomes a thick left-border stripe (the visual convention for page-level banners).
- **no icon** (icon=false): body text aligns to the left edge without icon offset; title and content
  still render normally.

## 4. The a11y contract

- **WAI-ARIA pattern**: APG Alert (`role="alert"` / `role="status"` by intent).
  Source: https://www.w3.org/WAI/ARIA/apg/patterns/alert/
  The APG states: "An alert is an element that displays a brief, important message in a way that
  attracts the user's attention without interrupting the user's task." Keyboard interaction is
  explicitly not applicable to the alert pattern itself.

- **roles + ARIA**:
    - root element: `role="${effectiveRole}"` where `effectiveRole` is `"alert"` (assertive, for
      warning/destructive) or `"status"` (polite, for info/success). Both roles imply
      `aria-live` (`alert` → assertive, `status` → polite) and `aria-atomic="true"` per the ARIA
      spec; the browser enforces these implicit values, so they are NOT emitted explicitly (to avoid
      redundancy and potential conflict with browser normalization).
    - icon (when rendered): `aria-hidden="true"` — the icon is purely decorative; the text conveys
      the meaning. Screen readers must not announce the icon separately.
    - dismiss button (when closable): a real `<button type="button">` with `aria-label="Dismiss"`.
      Icon-only → the accessible name is mandatory (the button spec rule, architecture contract §5.d).
    - title (when set): a `<p>` or `<strong>` element — NOT a heading (`<h2>` etc.). Alert banners
      are not section headings; promoting them to headings breaks document outline. The accessible name
      of the region comes from the visible text content, not from a dedicated `aria-label` (the content
      is already inside the live region).
    - `role="none"` override: the root element drops the role entirely and is rendered as a plain
      `<div>`. Use this only for purely decorative/contextual alerts whose content is already announced
      by another mechanism (e.g. it is the static header of a form that is never dynamically injected).

- **keyboard map**:

  | key | does | who |
  |---|---|---|
  | Tab | moves focus to the dismiss `<button>` when closable (normal document tab order) | platform |
  | Enter / Space | activates the dismiss button | platform (native `<button>`) |

  No other keyboard interaction. The alert itself is not focusable (`tabindex` is never added to the
  root). The dismiss button is the only interactive element and receives platform-standard keyboard
  activation. This matches the APG: "No keyboard interaction needed" for the alert pattern itself.

- **focus management**: none. The alert MUST NOT shift focus on appearance (the APG requirement:
  "alerts must not affect keyboard focus"). The user's current focus position is undisturbed when an
  alert is rendered or removed. The dismiss button enters the natural tab order by virtue of being a
  real `<button>` in the DOM; it is not focused programmatically.

- **live region behavior**:
    - `role="alert"` triggers an assertive announcement: most screen readers interrupt the current
      speech and read the alert content immediately. Use for warning/destructive (the user must not
      miss these).
    - `role="status"` triggers a polite announcement: the screen reader waits for a natural pause
      before reading. Use for info/success (contextual, not urgent).
    - Both roles carry implicit `aria-atomic="true"`: the whole alert is announced as a unit even
      if only part of it changes.
    - Alerts present in the DOM before page-load completes are NOT announced by screen readers
      (per APG); they are purely visual in that case. This is expected behavior, not a bug.
    - The `role="none"` override suppresses all live-region behavior intentionally.

- **shared mechanisms composed**: none. This is the simplest live-region tier — the role IS the
  entire contract. No focus-trap, no collection-nav, no popover seam. The dismiss button composes
  the `lievit.icon` partial (same as button.jte).

## 5. Tokens

### Consumed tokens

| token | purpose |
|---|---|
| `--lv-color-info` | info variant surface background |
| `--lv-color-info-fg` | info variant body text + icon |
| `--lv-color-info-border` | info variant border / stripe |
| `--lv-color-success` | success variant surface background |
| `--lv-color-success-fg` | success variant body text + icon |
| `--lv-color-success-border` | success variant border / stripe |
| `--lv-color-warning` | warning variant surface background |
| `--lv-color-warning-fg` | warning variant body text + icon |
| `--lv-color-warning-border` | warning variant border / stripe |
| `--lv-color-destructive` | destructive variant surface background |
| `--lv-color-destructive-fg` | destructive variant body text + icon |
| `--lv-color-destructive-border` | destructive variant border / stripe |
| `--lv-color-fg` | dismiss button icon fill (neutral, not variant-coloured) |
| `--lv-space-3` | vertical padding (top + bottom) |
| `--lv-space-4` | horizontal padding (left + right, icon gap, dismiss gap) |
| `--lv-space-2` | gap between icon and text content |
| `--lv-text-sm` | body text size |
| `--lv-font-sans` | body text face |
| `--lv-font-medium` | title weight |
| `--lv-radius-md` | standard border-radius (suppressed in banner mode) |
| `--lv-ring` | dismiss button focus-visible ring |

### Net-new tokens proposed

| token | value (OKLCH) | justification |
|---|---|---|
| `--lv-color-info` | `oklch(0.95 0.04 240)` (light) | info-blue surface; not in the current v2 set (which has primary/secondary/destructive but not a semantic info colour). Needed for the info variant to have a dedicated pale-blue surface rather than reusing `--lv-color-accent` (which is brand-coloured). |
| `--lv-color-info-fg` | `oklch(0.35 0.12 240)` (light) | info text + icon; WCAG-AA against `--lv-color-info` surface. |
| `--lv-color-info-border` | `oklch(0.75 0.10 240)` (light) | info border stripe. |
| `--lv-color-success` | `oklch(0.95 0.06 145)` (light) | success-green surface. |
| `--lv-color-success-fg` | `oklch(0.32 0.14 145)` (light) | success text + icon; WCAG-AA. |
| `--lv-color-success-border` | `oklch(0.72 0.14 145)` (light) | success border stripe. |
| `--lv-color-warning` | `oklch(0.97 0.06 80)` (light) | warning-amber surface. |
| `--lv-color-warning-fg` | `oklch(0.40 0.14 65)` (light) | warning text + icon; WCAG-AA (amber needs dark fg). |
| `--lv-color-warning-border` | `oklch(0.78 0.14 75)` (light) | warning border stripe. |

Dark-mode re-points for all net-new tokens are required in the `.dark, [data-theme="dark"]` block
(lightness values shift down by ~0.40–0.50 on surfaces, fg tokens shift up; chroma stays comparable).
`--lv-color-destructive` and its `-fg`/`-border` siblings are assumed to already exist in the v2
token set; if `destructive-border` is absent it is added on the same pattern.

All OKLCH values are authored source-of-truth; hex is a compiled fallback only (architecture contract §4).

## 6. Wire / island integration

**Static: no enhancer.** The alert is pure server-rendered JTE markup. There is nothing irreducible on
the client; the dismiss action is a server round-trip wired by the CONSUMING template, not by the
partial itself.

### JTE template structure

```
<root element>                   role="${effectiveRole}"  data-slot="alert"
                                  data-variant="${variant}"
                                  class="${variantClass} [layout classes]"
                                  ${attrs}  [trusted raw]
                                  [data-* from dataAttrs, each escaped]

  <icon region>                  aria-hidden="true"  (when icon=true)
    @template.lievit.icon(...)

  <body region>                   data-slot="alert-body"
    <title>                       data-slot="alert-title"  (when title set)
      ${title}
    <content>                     data-slot="alert-content"
      ${content}                  (the gg.jte.Content slot)
    <action>                      data-slot="alert-action"  (when action slot set)
      ${action}                   (the optional gg.jte.Content slot)

  <dismiss button>               type="button"  aria-label="Dismiss"  data-slot="alert-dismiss"
                                  [l:click="dismiss" added by the consuming template via attrs]
    @template.lievit.icon(name="x", size="sm", ariaHidden=true)
```

### data-* hooks

| attribute | element | purpose |
|---|---|---|
| `data-slot="alert"` | root | test + styling hook for the container |
| `data-slot="alert-body"` | body wrapper | test + styling hook for the text region |
| `data-slot="alert-title"` | title element | test + styling hook; rendered only when title≠null |
| `data-slot="alert-content"` | content wrapper | test + styling hook for the message body |
| `data-slot="alert-action"` | action wrapper | test + styling hook; rendered only when action slot set |
| `data-slot="alert-dismiss"` | dismiss button | test + styling hook; rendered only when closable=true |
| `data-variant="${variant}"` | root | styling + test target for variant-specific rules |

### Consuming template wiring (pattern)

The alert partial is stateless. The consuming WIRE template owns the visibility decision and the
dismiss action:

```java
// In a WIRE component:
@Wire boolean alertVisible = true;

@LievitAction
void dismissAlert() {
    alertVisible = false;  // server removes the alert from the next render
}
```

```
// In the consuming .jte template:
!{if alertVisible}
  @template.lievit.alert(
    variant = "success",
    title = "Saved",
    closable = true,
    attrs = "l:click.self=\"dismissAlert\"",   <%-- trusted wire directive on the dismiss button via attrs --%>
    content = @`Your changes have been saved.`
  )
!{/if}
```

The partial renders the dismiss `<button>`; the consumer stamps `l:click="dismissAlert"` on it via
`attrs` (trusted-raw, since this is a static string the author writes, not a per-row DB value). The
lievit runtime binds it. After the wire round-trip sets `alertVisible=false`, the next render omits
the alert entirely.

For non-wire contexts (plain form post, navigation), the controller simply omits the alert from the
model/template on the redirected response — no client state required.

## 7. Acceptance tests

All tests run on the REAL substrate (no mocked `$lievit`, no synthetic DOM that misses the live-region
role assignment). The alert is a PARTIAL rendered by the JTE compiler.

- **render — basic** (jsdom, real JTE render): render with `variant="info"` and a content slot;
  assert `data-slot="alert"` present; assert `role="status"` on the root; assert the content text is
  visible; assert `data-variant="info"` on the root.

- **render — title + content** (jsdom): render with `title="Saved"` and a content description; assert
  `data-slot="alert-title"` is present with the title text; assert `data-slot="alert-content"` is
  present with the description text; assert both visible.

- **render — role derivation by variant** (jsdom, parametric over all 4 variants):
    - info → `role="status"` on root
    - success → `role="status"` on root
    - warning → `role="alert"` on root
    - destructive → `role="alert"` on root

- **render — role override** (jsdom): render with `variant="info"` + `role="alert"`; assert root has
  `role="alert"` (override wins). Render with `role="none"`; assert root has no role attribute.

- **render — icon present + hidden** (jsdom): icon=true → `data-slot` icon region present +
  `aria-hidden="true"`; icon=false → icon region absent.

- **render — closable** (jsdom): closable=true → `data-slot="alert-dismiss"` present; assert it is a
  `<button type="button">` with `aria-label="Dismiss"`; closable=false → dismiss button absent.

- **render — banner mode** (jsdom): banner=true → root does NOT have the `--lv-radius-md` class;
  banner=false → radius class present.

- **render — action slot** (jsdom): render with the optional `action` slot containing a link; assert
  `data-slot="alert-action"` present and the link text visible; without the action slot, the slot
  element is absent.

- **axe-core — info/success** (jsdom, real rendered DOM): run axe on the rendered alert with
  `role="status"`; assert zero violations. Assert the icon is `aria-hidden`.

- **axe-core — warning/destructive** (jsdom): run axe on the rendered alert with `role="alert"`;
  assert zero violations. Assert the dismiss button (when closable=true) has an accessible name.

- **axe-core — icon-only dismiss button accessible name** (jsdom): closable=true with no visible text
  on the button → `aria-label="Dismiss"` must be present; axe accessible-name rule must pass. An
  icon-only button WITHOUT `aria-label` FAILS the test (asserts the rule is enforced, same pattern as
  button spec §7).

- **keyboard — dismiss button activation** (jsdom / Playwright): Tab moves focus to the dismiss button
  (normal tab order); Enter / Space fires the click event on the button (platform native `<button>`).
  Verify no other element on the alert receives programmatic focus on render.

- **variants / tokens** (jsdom): each variant (`info`, `success`, `warning`, `destructive`) renders
  the correct token classes as computed by the `switch`; the root has `data-variant` set to the
  variant string; the icon region uses the expected default icon name for each variant.

- **escaping — dataAttrs XSS** (jsdom): `dataAttrs={"test-id": "\">|<script>alert(1)</script>"}` →
  the rendered attribute value is HTML-escaped and does not produce an injected tag; same check as
  button spec §7 escaping test.

- **JTE compiles + renders** (real JTE compiler gate): covered by the existing `test/jte-compile`
  gate; all `@param` types resolve; the template compiles without error.

- **live-region announcement** (Playwright, real browser): inject an alert into the DOM after page
  load (simulate a server morph that adds the alert element); assert with an accessibility tree
  snapshot (or `aria-query`) that the live-region content is present in the accessibility tree with
  the correct `role`. (Full screen-reader audio cannot be asserted in Playwright; the role + content
  presence is the tractable gate.)

## 8. Non-goals / anti-patterns

- **NOT a toast / notification**: alerts are embedded in the page layout at a fixed position in the
  document flow. Transient floating notifications that appear in a corner, queue, and auto-dismiss
  belong to the `toast` component (`role=status`, enhancer-driven queue). Do not use `alert` for
  ephemeral overlays.

- **NOT an alert-dialog**: `alert` never interrupts task flow or traps focus. When a dangerous
  action requires explicit confirmation before proceeding, use the `alert-dialog` component
  (`role="alertdialog"`, modal focus-trap, requires a response). The APG is explicit: use alert for
  passive notification, alert-dialog when workflow interruption is necessary.

- **NOT focusable by design**: do not add `tabindex` to the alert root. The APG requires that alerts
  not affect keyboard focus. Only the dismiss button (a real `<button>`) is focusable, via normal
  document tab order.

- **NOT auto-dismissing**: WCAG 2.0 criterion 2.2.3 (No Timing) prohibits content that disappears
  automatically without user control (for non-essential content this is a should, for time limits it
  is a shall). Alert banners must not vanish after a timeout; if timed dismissal is needed, use `toast`.

- **NOT a heading element**: the `title` param renders as `<p>` or `<strong>`, never `<h1>`–`<h6>`.
  Alert banners are not document sections; elevating them to headings breaks the page outline.

- **NOT a container for arbitrary complex widgets**: the content slot carries text + simple inline
  elements (a link, a short description). Complex interactive content (forms, tables, lists of
  actions) belongs outside the live-region; if it must be inside, the screen reader announces the
  whole `aria-atomic` block as a single unit, which can be confusing.

- **NOT re-implementing live-region logic in TypeScript**: the role IS the live-region mechanism.
  Do not add JavaScript that clones the alert content and injects it into a separate announcer div,
  or that uses `aria-live` attributes dynamically. The JTE template sets the role on the server;
  the browser's accessibility tree handles the announcement. Adding a JS announcer on top of a
  `role="alert"` element causes double-announcements.
