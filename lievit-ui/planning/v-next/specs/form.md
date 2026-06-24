<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — form

- **tier**: PARTIAL
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/form.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Form Landmark (https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/examples/form.html)
      + W3C WAI Forms Tutorial — Notifications (https://www.w3.org/WAI/tutorials/forms/notifications/)
      + ARIA21 (`aria-invalid` + `aria-describedby` for error identification);
      the native `<form>` element supplies the landmark + submit keyboard for free;
      the error-summary live region is BUILT (no react-aria equivalent — the APG covers field-level
      error announcement, the error-summary heading+list pattern is W3C Forms Tutorial, not a named APG
      pattern); no typed-TS enhancer needed — pure server-rendered HTML with platform keyboard behavior.
    - inventory: Ant Design Form as inventory reference (layout variants, error display, help text,
      size propagation; the "Form.Item" wrapper maps to the separate `field` PARTIAL)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

## 1. What it is

A structural wrapper that marks a region of the page as a form landmark, owns the `<form>` element,
propagates a size context to its `field` / control children, and renders an accessible error-summary
live region when server-side validation fails.
The `form` PARTIAL is the container layer only: it does not render individual fields or controls.
Those are composed separately — the `field` PARTIAL wraps each label+control+error+hint row; controls
(`input`, `select`, `checkbox`, `radio-group`, etc.) render themselves.
Server-first works trivially: the form's open-state (errors present/absent, which fields are invalid)
is always a server fact; the template renders the error summary and the per-field `aria-invalid` states
from the controller model on every submit cycle.
No WIRE, no enhancer — the native `<form>` element and the browser's submit mechanism supply all
necessary platform behavior; submit validation is handled by the server and reflected back in the
next full or partial (htmx) render.

## 2. API — params

| param | type | default | meaning |
|---|---|---|---|
| `id` | `String` | `null` | the HTML `id` of the `<form>`; required if multiple forms exist on the page (the landmark label rule: each form landmark needs a unique accessible name, derived from the matching heading via `aria-labelledby="<headingId>"`) |
| `action` | `String` | `null` | the form action URL; when `null` the form posts to the current URL |
| `method` | `String` | `"post"` | `post` \| `get` |
| `layout` | `String` | `"stacked"` | `stacked` \| `inline` \| `horizontal` — controls how `field` children lay out their label relative to their control |
| `size` | `String` | `"md"` | `sm` \| `md` \| `lg` — propagated via a CSS custom property `--lv-form-size` read by descendent `field` + controls for toolbar-aligned heights |
| `labelWidth` | `String` | `null` | when `layout="horizontal"`: a CSS length string (e.g. `"8rem"`) set as the `--lv-form-label-width` CSS variable on the root; `field` children read it; `null` = each field sizes its own label |
| `errors` | `List<FormError>` | `[]` | server-side validation errors to render in the error-summary live region; each `FormError` carries `fieldId` (nullable) + `message`; an empty list suppresses the summary |
| `errorSummaryHeading` | `String` | `"Correggi gli errori prima di procedere"` | visible heading text inside the error summary panel; i18n responsibility is the adopter's (pass the localised string) |
| `autocomplete` | `String` | `null` | HTML `autocomplete` attribute value on the `<form>` (`"on"` \| `"off"` \| `null` = browser default) |
| `novalidate` | `boolean` | `true` | adds `novalidate` to the `<form>` (disables browser built-in constraint-validation UI; server handles all validation — the default for lievit because the server is always the authority); set `false` only to opt into native HTML5 constraint UI |
| `enctype` | `String` | `null` | `multipart/form-data` when the form includes file uploads; `null` = default `application/x-www-form-urlencoded` |
| `cssClass` | `String` | `""` | extra utility classes on the root `<form>` element |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (e.g. `hx-post="/..."`, `data-controller="..."`) |
| `headingId` | `String` | `null` | the `id` of an existing visible heading element (`<h1>`–`<h6>`) that labels this form landmark; when set, `aria-labelledby="${headingId}"` is emitted on the `<form>` (required when more than one form landmark exists on the page, per APG) |
| `ariaLabel` | `String` | `null` | direct `aria-label` string when no visible heading is available; mutually exclusive with `headingId`; `headingId` wins when both are set |
| `content` | `gg.jte.Content` | — | the form body: `field` PARTIAL calls, grouped content, submit buttons — everything between the error summary and the closing `</form>` |
| `footer` | `gg.jte.Content` | `null` | optional slot rendered after `content` but still inside the `<form>`, at the bottom; typically holds the submit/cancel button row |

**`FormError` record** (a simple Java record the adopter constructs from their validation result):
| field | type | meaning |
|---|---|---|
| `fieldId` | `String` (nullable) | the HTML `id` of the invalid field; when set, the error-summary renders a focusable link (`<a href="#${fieldId}">`) that moves focus to the field; when `null`, the error is form-level |
| `message` | `String` | the human-readable error message |

## 3. Variants / sizes / states

**Layout variants** (the `layout` param):
- `stacked` (default): label stacks above the control inside each `field`; compact, best for dense forms.
- `inline`: label and control share a single horizontal row; best for short forms (search filters, toolbar-embedded).
- `horizontal`: label is fixed-width in a left column (`--lv-form-label-width`), control in the right; classic data-entry form, aligns multiple fields vertically.

The layout context is propagated via a `data-form-layout="${layout}"` attribute on the root `<form>`; the
`field` PARTIAL reads this attribute (via CSS `[data-form-layout="horizontal"] .field-label { width: var(--lv-form-label-width) }`) to adapt without requiring explicit layout param on every field.
An adopter nesting a `field` outside a `form` gets the `stacked` default.

**Size** (`sm` | `md` | `lg`):
The `--lv-form-size` CSS custom property is set inline on the root (`style="--lv-form-size: sm"`);
descendent controls and the `field` PARTIAL inherit it and resolve their own height token:
`sm → --lv-space-8` (32 px), `md → --lv-space-9` (36 px, default), `lg → --lv-space-10` (40 px).
This is the same scale as every form control and button in the library — one `size` on the `form`
keeps the whole surface toolbar-aligned with zero per-control repetition.

**Error summary state**:
- HIDDEN (default): `errors` is empty; the `<div role="alert">` container is rendered but empty (so it is
  in the DOM and AT-visible before errors arrive; the update to non-empty triggers the live-region
  announcement). Alternatively, it may be conditionally absent when `errors` is empty — see the
  implementation note in §6.
- VISIBLE: `errors` is non-empty; the container shows the heading + error list; receives programmatic
  focus (see §4 focus management).

**Disabled form state**:
There is no `disabled` param on the form itself (disabling an entire `<form>` is not a valid HTML concept).
To prevent submission during a pending operation, the consuming WIRE/htmx context sets `aria-busy="true"`
(managed by the runtime's `beforeCall`/`afterCall` hook) and disables the submit button via its own
`disabled` param.

**No `variant` param**: the form is a structural container, not a styled action surface.
It carries no visual intent (no primary/destructive/ghost axis).
The only visual state it renders is the error-summary panel, which always uses the `destructive` token pair.

## 4. The a11y contract (the heart — platform landmark + error-announcement)

- **WAI-ARIA pattern**: APG Form Landmark (https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/examples/form.html);
  error notification pattern from W3C WAI Forms Tutorial — Notifications (https://www.w3.org/WAI/tutorials/forms/notifications/);
  ARIA21 for `aria-invalid` + `aria-describedby` (https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA21).

- **roles + ARIA emitted by the template**:
    - Root: native `<form>` element — the browser maps it to the ARIA `form` landmark role when the element
      has an accessible name (set via `aria-labelledby` or `aria-label`).
      Without an accessible name, the `<form>` is NOT exposed as a landmark (WHATWG + ARIA spec behavior);
      the template omits `role="form"` entirely (redundant on a `<form>`) and instead ensures an accessible
      name is always present: either from `headingId` (`aria-labelledby`) or `ariaLabel` (`aria-label`).
      When both are absent AND the page has only one form, the lack of landmark is acceptable (APG: "use a
      label only when you need to distinguish between multiple forms"); the template emits a warning comment.
    - Error summary container: `<div role="alert" aria-live="assertive" aria-atomic="true" id="<formId>-errors">`.
      `role="alert"` is an implicit `aria-live="assertive"` + `aria-atomic="true"` live region — the moment
      its text content changes (errors appear), the AT interrupts and reads the full summary.
      The `aria-atomic="true"` ensures the whole summary (heading + all messages) is read, not just the delta.
    - Error summary heading: `<h2>` (or a visually-styled heading at the correct document outline level —
      the adopter controls this via the `errorSummaryHeading` string; the PARTIAL always wraps it in the
      same element, here `<h2>`, scoped inside the form region; adopters wanting a different level override
      via `cssClass`).
    - Per-error links: `<a href="#${error.fieldId()}">` when `fieldId` is non-null — clicking or pressing
      Enter moves focus to the named field.
      Form-level errors (no `fieldId`) render as `<li>` text without a link.
    - The `<form>` itself does NOT carry `aria-describedby` pointing to the error summary: the live region
      self-announces; adding `aria-describedby` would read the summary on every focus-into-form, which is
      both redundant and noisy.

- **keyboard map**:
  | key | does | who |
  |---|---|---|
  | Tab / Shift+Tab | moves focus through all focusable descendants in DOM order (fields, controls, buttons, error-summary links) | platform |
  | Enter (in a text `<input>`) | submits the form when the form has a single submit button (HTML implicit submit) | platform |
  | Enter / Space (on a submit `<button>`) | submits the form | platform (native `<button type="submit">`) |
  | Enter (on an error-summary link `<a href="#">`) | moves focus to the named invalid field | platform |
  | Esc | no default form behavior; consuming WIRE/htmx context may bind Esc to cancel/close | none (context-owned) |

  There are NO non-native keys — no roving tabindex, no arrow navigation, no focus trap.
  The `form` PARTIAL sits at platform tier: the native `<form>` element and native controls supply
  all keyboard and focus behavior for free.

- **focus management**:
    - **On error**: when the server returns a re-rendered form with `errors` non-empty, the error-summary
      container receives programmatic focus: `tabindex="-1"` is set on the `<div role="alert">` and the
      controller (or the htmx `hx-on::after-swap` handler, or the consuming WIRE's `@LievitRender`) calls
      `document.getElementById('<formId>-errors').focus()`. This moves the AT reading position to the
      summary so the user hears the error count and the list immediately — without this focus move, the
      `role="alert"` live region still READS the summary, but sighted keyboard users have no visual anchor.
      The lievit convention: the controller sets a `focusOnError` flag in the model; the template emits
      `data-lv-autofocus` on the error-summary element when `focusOnError` is true; the runtime's
      existing `autofocus` directive moves focus on morph (zero JS in the template; CSP-clean).
    - **On success**: the form clears (redirect or htmx swap); focus follows naturally to the new page state.
      No explicit focus management is needed on the form itself.
    - **No focus trap**: a form is not a modal overlay.
      Tab moves freely in and out of the form region.

- **live region**:
    - The `<div role="alert">` is the ONLY live region the form emits.
      It announces the full error summary (heading + all messages) when errors appear.
      Individual field errors (the `<span>` linked via `aria-describedby` on each control) are rendered
      by the `field` PARTIAL, not by `form`; the `form` owns only the summary.
    - When `errors` is empty the container is present but empty — ATs ignore empty live regions.
      An implementation MAY conditionally render it absent when empty and insert it on error; the `role="alert"`
      live region fires on content update either way.
      The preferred pattern (simpler) is: always present, initially empty, populate on error.

- **shared mechanisms composed**: none (platform-only; no popover, no focus-trap, no collection-nav).
  The form is the SIMPLEST structural container in the library: the complexity lives in the controls it
  wraps, not in the form itself.
  The `field` PARTIAL owns `aria-describedby` wiring between each control and its inline error;
  the `form` PARTIAL owns the cross-field summary.

## 5. Tokens

The form PARTIAL reads a minimal set — it is structural, not decorative:

| token | usage |
|---|---|
| `--lv-space-4` | gap between `field` rows in `stacked` layout |
| `--lv-space-6` | padding inside the error-summary panel |
| `--lv-space-8` | gap between the error-summary panel and the first field |
| `--lv-color-destructive` | error-summary panel border + heading text |
| `--lv-color-destructive-subtle` | error-summary panel background (a tinted wash, lighter than the full destructive) |
| `--lv-color-destructive-fg` | error-summary body text + link color |
| `--lv-radius-md` | error-summary panel corner radius |
| `--lv-text-sm` | error-summary message text size |
| `--lv-text-base` | error-summary heading text size |
| `--lv-font-sans` | all form text |
| `--lv-ring` | focus-visible ring on the error-summary container (when it receives programmatic focus) |

**CSS custom properties propagated** (not `--lv-*` tokens but layout context signals):
| variable | set on `<form>` | read by |
|---|---|---|
| `--lv-form-size` | `sm` \| `md` \| `lg` (the `size` param value as a string) | `field` PARTIAL, controls — each maps to the `--lv-space-{8,9,10}` height token in their own switch |
| `--lv-form-label-width` | the `labelWidth` param value (CSS length) | `field` PARTIAL in `horizontal` layout mode |

**NET-NEW tokens**:
- `--lv-color-destructive-subtle`: a lighter tinted variant of `--lv-color-destructive` for panel
  backgrounds (error summary, alert backgrounds). Additive, goes in `:root` + `.dark` blocks.
  OKLCH authored: light mode `oklch(0.97 0.012 20)` (very light red-pink wash), dark mode
  `oklch(0.22 0.025 20)` (muted dark red). Justified: the existing `--lv-color-destructive` is the
  full-saturation token (used for borders, icons, text); a subtle wash variant is needed for the panel
  background to maintain readable contrast without the harshness of a fully saturated red fill.
  The `alert` PARTIAL will also use this token (shared intent, one token, no per-component invention).

## 6. Wire / island integration

**Tier: PARTIAL — static, no enhancer, no WIRE fields.**

The `form` PARTIAL renders a plain HTML `<form>` with optional error summary.
It is a presentation layer with no server-side component state and no client-side JS behavior.

**JTE template structure** (the server-rendered shape):

```
<form
  id="${id}"
  action="${action}"
  method="${method}"
  autocomplete="${autocomplete}"
  ${novalidate ? "novalidate" : ""}
  ${enctype != null ? "enctype=\"" + enctype + "\"" : ""}
  aria-labelledby="${headingId != null ? headingId : null}"
  aria-label="${headingId == null && ariaLabel != null ? ariaLabel : null}"
  data-slot="form"
  data-form-layout="${layout}"
  style="--lv-form-size: ${size}${labelWidth != null ? "; --lv-form-label-width: " + labelWidth : ""}"
  class="flex flex-col gap-[--lv-space-4] ${cssClass}"
  ${attrs}
>
  <!-- Error summary live region (always present; empty when no errors) -->
  <div
    role="alert"
    aria-live="assertive"
    aria-atomic="true"
    id="${id != null ? id + "-errors" : "form-errors"}"
    tabindex="-1"
    data-slot="form-error-summary"
    ${errors.isEmpty() ? "hidden" : ""}
    ${focusOnError && !errors.isEmpty() ? "data-lv-autofocus" : ""}
    class="rounded-[--lv-radius-md] border border-[--lv-color-destructive]
           bg-[--lv-color-destructive-subtle] p-[--lv-space-6]
           focus-visible:outline-none focus-visible:ring-[--lv-ring]
           ${errors.isEmpty() ? "hidden" : ""}"
  >
    !{if !errors.isEmpty()}
      <p class="text-[--lv-text-base] font-semibold text-[--lv-color-destructive]
                 mb-[--lv-space-2]">${errorSummaryHeading}</p>
      <ul class="list-disc list-inside space-y-[--lv-space-1]
                  text-[--lv-text-sm] text-[--lv-color-destructive-fg]">
        !{for FormError err : errors}
          <li>
            !{if err.fieldId() != null}
              <a href="#${err.fieldId()}"
                 class="underline hover:no-underline focus-visible:ring-[--lv-ring]">
                ${err.message()}
              </a>
            !{else}
              ${err.message()}
            !{/if}
          </li>
        !{/for}
      </ul>
    !{/if}
  </div>

  <!-- Form body (fields, controls, submit button) -->
  ${content}

  <!-- Optional footer slot (submit/cancel button row) -->
  !{if footer != null}
    <div data-slot="form-footer" class="flex items-center gap-[--lv-space-3] pt-[--lv-space-2]">
      ${footer}
    </div>
  !{/if}
</form>
```

**Data hooks** (for test selectors and adopter CSS):
| attribute | element | purpose |
|---|---|---|
| `data-slot="form"` | `<form>` root | primary selector for tests + adopter overrides |
| `data-form-layout="${layout}"` | `<form>` root | CSS context selector for `field` children |
| `data-slot="form-error-summary"` | error summary `<div>` | test selector for error-state assertions |
| `data-slot="form-footer"` | footer wrapper `<div>` | test selector for button-row content |
| `data-lv-autofocus` | error summary `<div>` | runtime autofocus directive fires on morph |

**Error summary rendering strategy**: the error summary `<div role="alert">` is ALWAYS present in
the DOM (rendered empty when `errors` is empty, visible with content when non-empty).
This avoids the "insert a live region after content is already present" anti-pattern, where some AT
implementations miss the announcement because the element was not in the DOM before the content changed.
The empty-hidden container is in the a11y tree but announces nothing (empty live regions are ignored).
When the server re-renders with errors, the container is populated + the `hidden` attribute is removed;
the content change triggers the `role="alert"` announcement.

**Interaction with htmx**: when the form is submitted via `hx-post` (htmx), the server returns an
`HX-Reswap` fragment or a full-form swap; the error summary is naturally re-rendered in the new HTML.
The `data-lv-autofocus` mechanism works transparently (the runtime morph fires autofocus on the
newly present attribute).
No special htmx hook is needed in the form PARTIAL itself.

**Interaction with WIRE (consuming context)**: the form PARTIAL is typically OWNED by a WIRE
component's template (e.g. `PersonFormComponent`), not composed with a `Content` slot inside WIRE.
The WIRE template renders `@template.lievit.form(id="person-form", errors=_instance.errors(), ...)` and
the `content` slot contains the concrete field templates.
The WIRE component owns the `errors` list as a derived property (populated after `@LievitAction` validation).

## 7. Acceptance tests

All tests run on a REAL substrate (real JTE compiler + real DOM; the client-island-fidelity lesson).

- **render — no errors (default state)**:
  Render `form` with `errors=[]`.
  Assert: `data-slot="form"` present; `data-slot="form-error-summary"` present but has `hidden` attribute
  (not visible); `content` slot children are in the DOM.

- **render — with errors (error-summary state)**:
  Render `form` with `errors=[{fieldId:"email", message:"Email non valida"}, {fieldId:null, message:"Operazione non consentita"}]`.
  Assert: error summary does NOT have `hidden`; the heading text is present; "Email non valida" renders
  as `<a href="#email">` (a focusable link); "Operazione non consentita" renders as plain `<li>` text
  (no link, no `href`); `data-slot="form-error-summary"` has `tabindex="-1"` (ready for programmatic focus).

- **render — layout variants**:
  Render `form` with `layout="stacked"`, then `"inline"`, then `"horizontal"` (with `labelWidth="10rem"`).
  Assert: `data-form-layout` attribute matches the layout param;
  for `horizontal`, `style` contains `--lv-form-label-width: 10rem`.

- **render — size propagation**:
  Render `form` with `size="sm"`, then `"lg"`.
  Assert: `style` attribute contains `--lv-form-size: sm` / `--lv-form-size: lg` on the root `<form>`.

- **render — footer slot**:
  Render `form` with a non-null `footer` slot.
  Assert: `data-slot="form-footer"` is present and contains the footer content.
  Render with `footer=null`.
  Assert: `data-slot="form-footer"` is absent.

- **render — accessible name: headingId**:
  Render `form` with `headingId="my-heading"`.
  Assert: `<form aria-labelledby="my-heading">` in the output; no `aria-label` emitted.

- **render — accessible name: ariaLabel**:
  Render `form` with `headingId=null, ariaLabel="Dati personali"`.
  Assert: `<form aria-label="Dati personali">` in the output.

- **render — headingId wins over ariaLabel**:
  Render `form` with both `headingId="h1"` and `ariaLabel="fallback"`.
  Assert: `aria-labelledby="h1"` present; `aria-label` absent.

- **axe-core — no errors state**:
  Run axe on the rendered form (no errors, with `ariaLabel="Test form"` for landmark labelling).
  Assert: zero violations on landmark, live-region, and form rules.

- **axe-core — error-summary state**:
  Run axe on the rendered form with `errors` non-empty.
  Assert: zero violations; the error-summary `<div role="alert">` is reachable and correctly labelled.

- **axe-core — iconOnly accessible name**:
  N/A (form has no icon-only elements).

- **keyboard — error-link focus**:
  Mount the form with one error `{fieldId:"username", message:"Campo obbligatorio"}`.
  Assert: the `<a href="#username">` is keyboard-focusable (Tab reaches it) and Enter navigates
  (assert `document.activeElement.id === "username"` after Enter on the link, in jsdom).

- **keyboard — submit**:
  Mount the form with a `<button type="submit">` in the content slot.
  Assert: pressing Enter inside a text input triggers form submit (platform behavior, assert the
  `submit` event fires).

- **autofocus on error**:
  Render the form with `errors` non-empty and `focusOnError=true`.
  Assert: `data-lv-autofocus` is present on the error-summary container; the runtime autofocus
  directive moves `document.activeElement` to `data-slot="form-error-summary"` on morph.

- **novalidate default**:
  Render `form` with default params.
  Assert: the `<form>` has the `novalidate` attribute.
  Render with `novalidate=false`.
  Assert: the `<form>` does NOT have `novalidate`.

- **enctype**:
  Render with `enctype="multipart/form-data"`.
  Assert: `<form enctype="multipart/form-data">` in the output.
  Render without `enctype`.
  Assert: no `enctype` attribute emitted (browser default).

- **XSS / escaping**:
  `attrs` is TRUSTED raw (documented); the template must NOT be fed user data via `attrs`.
  Verify this is stated in the header doc-comment and is NOT a runtime-escaped channel.
  The `FormError.message()` value is rendered via the JTE default-escaped channel (`${}`), so a
  message containing `<script>` renders as `&lt;script&gt;` — assert this on a hostile `message` value.

- **JTE compiles + renders**: covered by `test/jte-compile` real-compiler + render gate.

## 8. Non-goals / anti-patterns

- **This PARTIAL does NOT render form fields.** `form` is the container; `field` renders label + control
  + error + hint for each row. Never add field-rendering logic to `form.jte` — that collapses two
  concerns into one and breaks composability.

- **This PARTIAL does NOT own per-field error messages.** The `aria-describedby` link between each
  control and its inline error message is the responsibility of the `field` PARTIAL. `form` owns only
  the cross-field summary live region. Duplicating per-field errors inside the form's summary is correct
  (a11y best practice); duplicating them via `aria-describedby` from the `form` root is wrong.

- **No client-side validation.** Lievit's server-first principle: validation runs on the server and the
  result is reflected in the next render. Native HTML5 constraint validation is opt-in via `novalidate=false`
  only for simple cases where the adopter explicitly wants it. Do not add JS validation logic to this PARTIAL
  or to an enhancer for this PARTIAL — that is scope creep toward a client framework.

- **No form state management.** The `form` PARTIAL does not track "dirty", "touched", "submitted", or
  "pristine" field states client-side. These are UI niceties available in React Hook Form / Formik; in
  lievit, this state either belongs on the server (surfaced in the next render) or is out of scope.
  An adopter who needs it composes a WIRE component that owns the state as `@Wire` fields.

- **No multi-step / wizard behavior.** A multi-step form is a `wizard` WIRE component, not a `form`
  PARTIAL with step logic embedded. The `form` wraps a single step; the `wizard` component orchestrates
  the step sequence.

- **No WIRE coupling.** `form.jte` is a PARTIAL: it has no `@Wire` fields, no `@LievitProperty`, no
  `@LievitAction`, no wire round-trip of its own. A consuming WIRE template OWNS the form PARTIAL in its
  body — the WIRE supplies the errors list and the action targets; the form PARTIAL renders them.
  Never promote `form` to WIRE just to hold error state — that state belongs in the consuming context's
  WIRE component, not in a generic form container.

- **No `role="form"` on the `<form>` element.** Redundant (`<form>` already maps to the ARIA `form`
  role when accessible-named). Adding `role="form"` to a `<form>` element is an ARIA anti-pattern.

- **No `action="#"` default.** The `action` param defaults to `null`, which renders no `action`
  attribute (posts to the current URL). Hardcoding `"#"` as a default would post to a fragment anchor,
  breaking htmx and standard form semantics.

- **No layout logic for `horizontal` in the form PARTIAL itself.** The `horizontal` layout is a CSS
  context: the form sets `data-form-layout` + `--lv-form-label-width`; the `field` PARTIAL applies
  the horizontal layout rules. The `form` does not directly touch field label alignment — that would
  violate the single-responsibility boundary.

## 9. Agent instructions

Generate ORIGINAL code over `--lv-*` tokens.
You MAY read:
- APG Form Landmark example (https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/examples/form.html)
  for accessible-name + landmark rules;
- W3C WAI Forms Tutorial Notifications (https://www.w3.org/WAI/tutorials/forms/notifications/) for
  the error-summary + live-region pattern;
- Ant Design Form for the layout + size propagation inventory;
- Tailwind UI for visual look.
You MUST NOT paste literal source from any of them (the one bright line, `02`) — output is original.

Mirror `button.jte`'s house conventions exactly: header doc-comment with the credits/a11y/params/usage
sections; typed `@param`; `data-slot` on root; the two escaping channels
(`attrs` = TRUSTED raw `$unsafe`; `errors` messages = JTE default-escaped `${}`).
Zero `<script>`, zero `on*=` attributes.

The error-summary live region is the load-bearing a11y piece.
Render it ALWAYS present (empty-when-no-errors pattern, NOT conditionally inserted) to guarantee AT
picks up the `role="alert"` container before errors land.
The `data-lv-autofocus` + `tabindex="-1"` pair on the error container is mandatory — asserted by the
autofocus acceptance test.

The `--lv-color-destructive-subtle` NET-NEW token must be added to the token file
(`registry/tokens/lievit-tokens.css`) in both `:root` and `.dark` blocks (OKLCH values as specified
in §5) BEFORE the component renders it.

Minimal code to GREEN against the acceptance tests.
The layout propagation mechanism (CSS custom properties + `data-form-layout`) must be tested and
confirmed to reach the `field` PARTIAL without additional params per field — that is the design
constraint that makes the system composable.
