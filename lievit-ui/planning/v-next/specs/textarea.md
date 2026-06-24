<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — textarea

- **tier**: PARTIAL (`l:model`) + ENH (`textarea-autosize.enhancer.ts` — the irreducible client bit:
  grow-to-content + live char count; NO roving, NO trap, NO framework)
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/textarea.jte`; the `size` param + autosize +
  showCount enhancer are the net-new delta over the current bare partial)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG **textbox** (multi-line) — platform-supplied by the native `<textarea>` element
      (role + caret + all editing keys + `disabled`/`readonly`/`required`/`aria-multiline` for free).
      **Verified**: the APG patterns index (https://www.w3.org/WAI/ARIA/apg/patterns/) has NO dedicated
      "Textbox" pattern page (confirmed 2026-06-23); basic text entry is intentionally covered by the
      native element. The authoritative references are the WAI-ARIA 1.2 `textbox` role definition
      (https://www.w3.org/TR/wai-aria-1.2/#textbox) and the APG practice *Providing Accessible Names and
      Descriptions* (https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/) — visible
      `<label for>` first, `aria-describedby` for hint/error. No react-aria reference needed: the native
      control carries the whole keyboard + focus interaction; the enhancer touches only height + count,
      never the editing model.
    - inventory: Ant Design Input.TextArea as inventory reference (autosize min/maxRows, showCount,
      maxLength, disabled/readonly/invalid states, resize control)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

## 1. What it is

A token-styled multi-line text field: a real native `<textarea>` with the same border-radius, padding
scale, and focus ring as `input`, vertically resizable by default. PARTIAL because the edited value lives
in the native element (uncontrolled); there is no server state to hold and no `@Wire` field. When the
consuming WIRE template wants the typed text on the server, it sets `l:model` on the element via the
`attrs` param or the dedicated `model` param — the partial just renders the styled control. The `name`
attribute makes it POST JS-off in a plain form. Server-first works trivially: there is nothing client
about typing into a `<textarea>`.

The ONE irreducible client bit is cosmetic, not behavioural: **autosize** (grow the box to its content
so the user never scrolls inside a clipped box) and a **live character count** (real-time feedback
against `maxLength`). Both are a thin typed-TS enhancer over the server-rendered element (+ENH tier),
never a framework and never a wire round-trip per keystroke (a server decision between keystrokes would
be chatter for no gain). With `autosize=false` and `showCount=false` the bare partial is a complete,
accessible control on its own; the enhancer is purely additive.

## 2. API — params (the typed surface)

PARTIAL `@param` shape (one per styling / a11y / config knob; no `@Wire` fields — the native element
is the value owner):

| param | type | default | meaning |
|---|---|---|---|
| `name` | `String` | — | the textarea's `name` attribute (required for POST; acts as fallback `id`) |
| `id` | `String` | `null` | the textarea's `id` for `<label for>` association; falls back to `name` when null |
| `value` | `String` | `null` | initial / server-pre-filled text, rendered as the element's text content |
| `placeholder` | `String` | `null` | placeholder hint; NOT a substitute for a visible label (see §4) |
| `rows` | `int` | `3` | initial visible row count; the autosize minimum when `autosize=true` |
| `size` | `String` | `"md"` | `sm \| md \| lg` — controls per-row line-height, padding, and text size (toolbar-aligned with `input`/`button` of the same size) |
| `autosize` | `boolean` | `false` | NET-NEW: grow-to-content via the `textarea-autosize` enhancer |
| `minRows` | `int` | `rows` | autosize floor; the box never shrinks below this many rows |
| `maxRows` | `int` | `0` | autosize ceiling (0 = unbounded); above it the box scrolls internally |
| `maxLength` | `int` | `0` | native `maxlength` cap (0 = none); enables the count output when combined with `showCount` |
| `showCount` | `boolean` | `false` | NET-NEW: render a live "n / maxLength" counter below the field |
| `hint` | `String` | `null` | built-in muted helper text below the field; stamped with `id="<areaId>-hint"` and auto-joined into `aria-describedby` |
| `invalid` | `boolean` | `false` | destructive border + ring + `aria-invalid="true"` |
| `disabled` | `boolean` | `false` | native `disabled` attribute + `disabled:` utilities; the control is removed from the tab sequence |
| `required` | `boolean` | `false` | native `required` attribute; participates in the `<form>` constraint-validation chain |
| `readonly` | `boolean` | `false` | native `readonly`; focusable + copyable, not editable |
| `model` | `String` | `null` | shorthand for emitting `l:model="<model>"` on the element (alternative to passing it via `attrs`) |
| `ariaLabel` | `String` | `null` | `aria-label` when there is no visible `<label for>` (see §4 name rule) |
| `describedBy` | `String` | `null` | ids of EXTERNAL hint/error elements; merged with the built-in hint + count ids into `aria-describedby` |
| `cssClass` | `String` | `""` | extra utility classes on the `<textarea>` |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed strings only (wire directives, `autocomplete`, `spellcheck`) |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` (each value via `Escape.htmlAttribute`) |

**No content slot**: a textarea's "children" are its own text value (`@param String value`), not
projected `gg.jte.Content`. The value arrives via `@param` from the controller's typed model — the
"no data in a partial" rule.

**The two escaping channels** (XSS decision rule, same as `button.jte`):
- `attrs` = TRUSTED raw (`$unsafe`) — static, author-typed strings only. NEVER fed per-row DB-derived data.
- `dataAttrs` = SAFE escaped — each value through `Escape.htmlAttribute`. Used for any dynamic
  per-row value that needs a `data-*` hook (e.g. a row-specific character limit hint).

## 3. Variants / sizes / states

### Variants
None. A textarea is a field, not an action or status surface; the intent vocabulary (`primary`,
`destructive`, `ghost`, etc.) does not apply. Its only chromatic signal is validity: `invalid=true`
recolours to the destructive pair via the `aria-invalid` convention shared across all form controls.
Deliberate restraint per architecture contract §5.a: no gratuitous variants.

### Sizes (`sm | md | lg`, height-based, toolbar-aligned)

The `size` param sets the per-row line-height, vertical padding, horizontal padding, and text size so
that one visible row of the textarea aligns flush with an `input` or `button` of the same size.
Multi-row height is `rows × (row line-height)`; autosize grows from that floor.

| size | text | padding-y | padding-x | border-radius | one-row height aligns with |
|---|---|---|---|---|---|
| `sm` | `--lv-text-xs` | `--lv-space-2` | `--lv-space-3` | `--lv-radius-sm` | `--lv-space-8` (32 px) |
| `md` (default) | `--lv-text-sm` | `--lv-space-2` | `--lv-space-3` | `--lv-radius-md` | `--lv-space-9` (36 px) |
| `lg` | `--lv-text-base` | `--lv-space-3` | `--lv-space-4` | `--lv-radius-md` | `--lv-space-10` (40 px) |

### States

- **default**: border `--lv-color-border`; background `--lv-color-input`; text `--lv-color-fg`.
- **hover**: border subtly darkens (approaches `--lv-color-border` hover step; see §5 for the proposed
  `--lv-color-border-hover` token).
- **focus-visible**: the shared `--lv-ring` focus ring (2 px, `--lv-color-ring`, shared by every
  interactive primitive).
- **disabled**: native `disabled` attribute; `disabled:` Tailwind utilities apply dimming + `cursor-not-allowed`;
  the element is removed from the tab sequence; the count and autosize go inert.
- **readonly**: native `readonly`; still focusable + selectable + copyable; a reduced background
  (`--lv-color-muted`) signals non-editable without the `disabled` dimming.
- **invalid (`aria-invalid`)**: border + ring switch to `--lv-color-destructive` + `--lv-ring-destructive`;
  the count also flips to destructive text when the value is at/over `maxLength`.
- **required**: native `required` (constraint validation) + `aria-required="true"`.
- **resize**: `resize-y` (CSS) by default; controlled by a `resize` CSS utility applied alongside size
  classes. Autosize and user-drag resize coexist: the enhancer stops auto-growing once a user manually
  drags the handle (it marks `data-lv-user-resized`; the morph resets this flag if the server re-renders
  with a different `rows`).
- **aria-busy**: NOT this partial's concern — managed by the consuming WIRE component's runtime during a
  wire round-trip. The textarea partial stays stateless throughout.

## 4. The a11y contract (the heart — platform textbox, fully specified)

**WAI-ARIA pattern**: **textbox (multi-line)**, supplied entirely by the native `<textarea>` element.

**APG verification**: the W3C APG patterns index (https://www.w3.org/WAI/ARIA/apg/patterns/),
checked 2026-06-23, lists NO dedicated "Textbox" pattern page. The APG covers only the AUGMENTED
textbox patterns (Combobox, Spinbutton); a plain multi-line field is intentionally deferred to the
native `<textarea>`. The authoritative references are:
- WAI-ARIA 1.2 `textbox` role: https://www.w3.org/TR/wai-aria-1.2/#textbox
- APG *Providing Accessible Names and Descriptions*: https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/
- HTML Living Standard `<textarea>`: https://html.spec.whatwg.org/multipage/form-elements.html#the-textarea-element

### Roles + ARIA (every attribute the template emits)

| attribute | value | who sets it | note |
|---|---|---|---|
| (implicit role) | `textbox` | platform (`<textarea>`) | never set by the template; redundant and risks de-syncing `aria-multiline` |
| (implicit `aria-multiline`) | `true` | platform (`<textarea>`) | browsers expose this automatically; do NOT add it manually |
| `id` | `<areaId>` | template | `id` param else `name`; target for `<label for>` + `aria-labelledby` |
| `name` | `<name>` | template | POST field name; works JS-off |
| `aria-label` | `<ariaLabel>` | template | the accessible NAME when no `<label for>` is present; REQUIRED in that case |
| `aria-describedby` | joined ids | template | space-joined from: `describedBy` (external) + `<areaId>-hint` (built-in hint) + `<areaId>-count` (when `showCount`); absent when all are null |
| `aria-invalid` | `"true"` or absent | template | present only when `invalid=true`; omitted (NOT `"false"`) otherwise, per APG convention |
| `aria-required` | implicit | platform | the native `required` attribute exposes this automatically |
| `disabled` | native | template | native `disabled`; the platform handles the a11y semantics; no separate `aria-disabled` |
| `readonly` | native | template | native `readonly`; the platform exposes `aria-readonly="true"` |
| `maxlength` | `<maxLength>` | template | when `maxLength > 0`; native constraint + the enhancer count |

**The accessible-name rule (load-bearing, same class as the icon-only button rule)**:
A textbox with no accessible name is a WCAG 4.1.2 failure. This partial does NOT render its own
`<label>` (that is the `field` / `label` wrapper's job). The contract: EITHER the caller wraps this
partial in `field` / `<label for>` (preferred — APG Rule 2, visible text) OR passes `ariaLabel`. The
axe test in §7 asserts a violation when neither is present, so the rule is machine-enforced.

### Keyboard map (all platform-supplied — the enhancer adds ZERO key handling)

| key | does | who |
|---|---|---|
| printable characters | insert text at the caret position | platform (native `<textarea>`) |
| Enter / Return | insert a newline — NOT a form submit (textarea-specific platform behaviour) | platform |
| Tab | move focus OUT of the field; **a textarea does NOT trap Tab** | platform |
| Shift+Tab | move focus to the previous interactive control | platform |
| ArrowLeft / ArrowRight | move caret one character left / right | platform |
| ArrowUp / ArrowDown | move caret one line up / down | platform |
| Home / End | move caret to start / end of the current line | platform |
| Ctrl/Cmd+Home / Ctrl/Cmd+End | move caret to the start / end of all text | platform |
| Backspace | delete the character before the caret | platform |
| Delete | delete the character after the caret | platform |
| Ctrl/Cmd+A | select all text in the field | platform |
| Ctrl/Cmd+C / X / V | copy / cut / paste selection | platform |
| Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z | undo / redo (browser-managed edit history) | platform |
| PageUp / PageDown | scroll the text when the box has overflow | platform |
| Ctrl/Cmd+Enter | no native meaning in a textarea — wired by the CONSUMING template via `attrs="l:keydown.ctrl.enter=\"save\""` when a "submit on Ctrl+Enter" UX is wanted | consuming template |

The `textarea-autosize` enhancer listens ONLY to the `input` event and `lievit:morphed`. It calls
`preventDefault()` on NOTHING and changes no key behaviour. The acceptance test for "enhancer swallows
no key" (§7) is non-optional.

### Focus management
Platform. The `<textarea>` is a natural tab-stop in document order. `:focus-visible` → `--lv-ring`.
No focus trap, no roving tabindex, no focus restoration — this is a single form field, not an overlay.
A consuming template that wants initial focus on this field uses the standard `autofocus` attribute or
a lifecycle hook in its own component; that logic belongs to the consumer, not this partial. Autosize
MUST NOT move the caret or steal focus when it resizes (the caret-survives-grow assertion in §7).

### Live region
The character count output is NOT a `aria-live` region by default — a politely announced count on
every keystroke is noise for screen reader users. Instead: the `<output data-slot="textarea-count">`
is included in `aria-describedby` so the current count is discoverable when the user explores the
field, and the enhancer fires ONE announcement via the shared announcer at the moment the value
crosses the `maxLength` threshold ("character limit reached"). Per-character count announcements are
deliberately absent.

### Shared mechanisms composed
NONE of the three shared a11y mechanisms (popover seam / focus-trap / collection-nav) — a textarea
needs no overlay, no focus trap, and no roving collection (architecture contract §2.b). The one
shared mechanism it MAY use is the **shared announcer** for the single over-limit announcement. The
`textarea-autosize` enhancer is local and single-purpose; it is the exemplar of "an enhancer is the
irreducible client bit, not a framework" (architecture contract §1).

## 5. Tokens

Tokens consumed (all `var(--lv-*)`, NEVER a literal; the token-lint enforces it):

| token | used for |
|---|---|
| `--lv-color-input` | textarea background (default state) |
| `--lv-color-muted` | background for `readonly` state |
| `--lv-color-bg` | wrapper background when a count sibling is rendered |
| `--lv-color-border` | border (default) |
| `--lv-color-border-hover` | border on `:hover` (see NET-NEW below) |
| `--lv-color-destructive` | border + count text in `aria-invalid` / over-limit state |
| `--lv-color-ring` | focus ring colour |
| `--lv-ring` | focus-visible outline shorthand (ring + offset) |
| `--lv-ring-destructive` | focus ring in `aria-invalid` state (see NET-NEW below) |
| `--lv-color-fg` | text inside the field |
| `--lv-color-fg-muted` | placeholder text |
| `--lv-color-fg-subtle` | hint text + count text (below-limit) |
| `--lv-color-fg-disabled` | text + placeholder in the `disabled` state |
| `--lv-space-1` | gap between the textarea and the hint / count line |
| `--lv-space-2` | padding-y `sm` and `md` |
| `--lv-space-3` | padding-x `sm` and `md`; padding-y `lg` |
| `--lv-space-4` | padding-x `lg` |
| `--lv-text-xs` | font size `sm`; also count + hint text (always small regardless of control size) |
| `--lv-text-sm` | font size `md` (default) |
| `--lv-text-base` | font size `lg` |
| `--lv-radius-sm` | border-radius `sm` |
| `--lv-radius-md` | border-radius `md` and `lg` |
| `--lv-font-sans` | font family |
| `--lv-font-mono` | font family for `<code>`/log contexts (set via `cssClass` by the consumer, not the default) |

**NET-NEW tokens proposed** (additive, justified; each goes in `:root` and `.dark { ... }` blocks,
authored in OKLCH, never literal):

- `--lv-color-border-hover`: a hover border colour one OKLCH lightness step below `--lv-color-border`
  for light mode (and one step above in dark mode), same chroma and hue. Shared by `input`,
  `native-select`, and `textarea` — proposing once here. Example light value:
  `oklch(0.72 0.01 255)` (vs `--lv-color-border` ≈ `oklch(0.82 0.01 255)`).

- `--lv-ring-destructive`: the focus ring in the `aria-invalid` / destructive state. A reduced-opacity
  tint of `--lv-color-destructive` that reads as a ring (not a solid fill) while staying visually tied
  to the error colour. Shared by all form controls that carry an invalid state. Example light value:
  `oklch(0.65 0.22 28 / 0.4)` (same hue as `--lv-color-destructive`, 40% alpha for ring appearance).

No other net-new tokens are required. All structural tokens (spacing, radius, type) are existing.

## 6. Wire / enhancer integration (PARTIAL+ENH — no `@Wire`, no server round-trip per keystroke)

### Server-rendered JTE structure

The partial renders either a bare `<textarea>` (when no count/hint sibling is needed) or a wrapper
`<div>` grouping the `<textarea>` with the hint and/or count. The wrapper exists ONLY when at least
one sibling is rendered — no unnecessary `<div>` overhead.

**Structural shape (pseudocode; the implementation mirrors `button.jte` house conventions exactly)**:

```
<!-- when hint OR showCount: the wrapper groups them -->
<div data-slot="textarea-wrapper" class="[wrapperCssClass] flex flex-col gap-[--lv-space-1]">

  <textarea
    data-slot="textarea"
    data-size="${size}"
    data-lv-invalid="${invalid}"         ← data-hook; the enhancer reads this, never a class branch
    id="<areaId>"
    name="<name>"
    rows="<effectiveMinRows>"
    [maxlength="<maxLength>" when maxLength>0]
    [disabled]  [required]  [readonly]
    aria-required="${required}"
    [aria-label="<ariaLabel>" when ariaLabel != null]
    [aria-describedby="<joined>" when joined != null]  ← external + hint + count ids
    [aria-invalid="true" when invalid]                 ← absent (not "false") otherwise
    [data-lv-autosize when autosize]
    [data-lv-min-rows="<minRows>" when autosize]
    [data-lv-max-rows="<maxRows>" when autosize && maxRows>0]
    [data-lv-count-for="<areaId>" when showCount]
    class="[size+state token classes] [cssClass]"
    $unsafe{attrs}
    [escaped data-* from dataAttrs]
  ><value/></textarea>
  <!--  value appears as text content, NOT a value= attribute (HTML spec for <textarea>)  -->

  <!-- built-in hint (when hint != null) -->
  <span data-slot="textarea-hint" id="<areaId>-hint"
        class="text-[--lv-text-xs] text-[--lv-color-fg-subtle]">${hint}</span>

  <!-- live count (when showCount) -->
  <output data-slot="textarea-count" id="<areaId>-count"
          for="<areaId>"
          class="text-[--lv-text-xs] text-[--lv-color-fg-subtle] self-end">
    <!-- enhancer writes: n / max -->
  </output>

</div>
<!-- when NEITHER hint NOR showCount, the <textarea> is the sole root element (no wrapper) -->
```

Key JTE conventions (mirrors `button.jte` exactly):
- `data-slot="textarea"` on the `<textarea>` root (CSS + test targeting).
- `data-slot="textarea-wrapper"`, `textarea-hint`, `textarea-count` on sibling elements.
- `data-size="${size}"` and `data-lv-invalid="${invalid}"` as data-hook attributes (styling + tests).
- `$unsafe{attrs}` emits the trusted raw wire directives exactly as authored.
- `dataAttrs` values each go through `Escape.htmlAttribute` before emission.
- Zero `<script>`, zero `on*=` anywhere in the partial (strict CSP).
- `<output for="<areaId>">` is the semantically correct element for a computed result associated with
  a form control (the HTML `<output>` element); it gives `role="status"` implicitly in some browsers,
  which aligns with the live-ish nature of the count. The enhancer populates its `textContent`.

**Local computed variables** (JTE `!{var ...}`, never hardcoded strings in the body):

```java
!{var areaId = id != null ? id : name}
!{var effectiveMinRows = autosize ? minRows : rows}
!{var hasHint = hint != null && !hint.isEmpty()}
!{var hasCount = showCount}
!{var hasWrapper = hasHint || hasCount}
!{var hintId = hasHint ? areaId + "-hint" : null}
!{var countId = hasCount ? areaId + "-count" : null}
!{var joinedDescribedBy = Stream.of(describedBy, hintId, countId)
    .filter(s -> s != null && !s.isEmpty()).collect(joining(" "))}
!{var joinedDescribedBy = joinedDescribedBy.isEmpty() ? null : joinedDescribedBy}
```

### Enhancer: `textarea-autosize.enhancer.ts` (+ENH, CSP-clean, typed TS)

**Mount condition**: `data-lv-autosize` attribute present on a `<textarea>` element.
**Count activation**: `data-lv-count-for="<areaId>"` on the root (when `showCount`).

**What it does (and ONLY this)**:

1. **Autosize — initial fit**: on mount, compute `scrollHeight` with `height` forced to `"auto"`,
   then set the element's `style.height` to `clamp(minHeight, scrollHeight, maxHeight)` where:
   - `minHeight = effectiveMinRows × lineHeight + paddingTop + paddingBottom` (from `getComputedStyle`)
   - `maxHeight = maxRows > 0 ? maxRows × lineHeight + paddingTop + paddingBottom : Infinity`
   CSP-clean: `lineHeight` read via `getComputedStyle`, never a hardcoded constant.

2. **Autosize — on `input`**: same clamp; set `height = "auto"` → read `scrollHeight` → set final height.
   Runs synchronously on every `input` event so the box snaps to content with no visible lag.

3. **Autosize — user-drag stop**: if the user manually resizes (the `mouseup` + height-change heuristic),
   set `data-lv-user-resized` on the element and stop auto-growing until the next morph/re-render.

4. **Count — on `input`**: read `textarea.value.length`, compute `remaining = maxLength - length`, write
   to the `<output>` `textContent` as `"<length> / <maxLength>"` (or `"<length>"` when `maxLength=0`).
   When `length >= maxLength`, add a CSS class that switches the count to `--lv-color-destructive` text;
   also call the shared announcer ONCE at the threshold (idempotent: once announced, not again until the
   user drops below the limit).

5. **Morph-resync** (`lievit:morphed` event on the element): recalculate autosize height + update count
   after a wire round-trip re-renders the `value`. The morph preserves element identity, so the enhancer
   is NOT unmounted/remounted; this event is the only re-trigger needed.

6. **Idempotent mount** (`data-lv-textarea-enhanced` guard): `enhanceTextareaAutosize(root)` is a no-op
   if already run. `enhanceAllTextareaAutosize(scope)` runs on initial `DOMContentLoaded` and after every
   morph via the lifecycle registry — the same contract as `input-otp.enhancer.ts`.

**What it does NOT do** (the hard boundary):
- Does NOT intercept, swallow, or `preventDefault()` any keystrokes.
- Does NOT move the caret or steal focus.
- Does NOT fire a wire action (the value is the native element's; the count is cosmetic).
- Does NOT compose `collection-nav`, `focus-trap`, or the popover seam.
- Does NOT mount on elements without `data-lv-autosize`.
- Does NOT hand-roll its own morph lifecycle — it uses the lifecycle registry.

**Registration** (the canonical +ENH pattern):

```typescript
// In textarea-autosize.enhancer.ts
LievitRuntime.registerLifecycle({
  afterMorph(scope: Element) { enhanceAllTextareaAutosize(scope); }
});
// Called once on init:
enhanceAllTextareaAutosize(document.body);
```

### The wire binding path (when `model` is set)

The consuming WIRE template sets `l:model="fieldName"` on the `<textarea>` via either:
- `model="body"` param → the partial emits `l:model="body"` via a dedicated `!{var}` (not through
  `attrs`; the `model` param is the safe explicit channel for this common case).
- `attrs="l:model=\"body\" l:model.debounce.300ms"` → the raw trusted string path for callers that
  need debounce or advanced options.

The partial remains stateless: it renders the initial `value` from `@param` on each server render; the
native element holds the live-typed value; the morph preserves whatever the user typed (the runtime's
identity-preserving patch does this automatically, architecture contract §6).

## 7. Acceptance tests (the gate — refute-by-default, REAL substrate)

The component is DONE only when ALL tests pass on the REAL substrate — NOT a mocked `$lievit` (the
client-island-fidelity lesson: the empty-body slide-over bug and the wrong-verb reschedule bug both
passed on a fake substrate):

### Render tests (jsdom + real JTE compile; no mocks)

- **render/default**: renders a bare `<textarea data-slot="textarea" data-size="md">` with no
  wrapper `<div>`, no hint span, no count output; `rows=3`; no `aria-invalid`; no `aria-describedby`.
- **render/wrapper-appears-with-hint**: when `hint="Enter notes here"`, a `<div data-slot=
  "textarea-wrapper">` wraps a `<textarea>` + `<span data-slot="textarea-hint" id="<areaId>-hint">`;
  the hint id appears in `aria-describedby` on the `<textarea>`.
- **render/wrapper-appears-with-count**: when `showCount=true`, the wrapper wraps a `<textarea>` +
  `<output data-slot="textarea-count" id="<areaId>-count" for="<areaId>">`;
  the count id appears in `aria-describedby` on the `<textarea>`.
- **render/no-wrapper-without-hint-or-count**: when `hint=null`, `showCount=false`, no wrapper
  `<div>` is present — the `<textarea>` is the sole root element.
- **render/describedby-joins-all-sources**: when `describedBy="ext-error"`, `hint="help"`, and
  `showCount=true`, `aria-describedby` is `"ext-error <areaId>-hint <areaId>-count"` (space-joined,
  order: external → built-in hint → count).
- **render/value-as-text-content**: `value="line 1\nline 2"` is the `<textarea>` text content, NOT a
  `value=` attribute (HTML spec for `<textarea>`).
- **render/aria-invalid-present-not-false**: when `invalid=true`, `aria-invalid="true"` is on the
  `<textarea>`; when `invalid=false`, the attribute is ABSENT (not `aria-invalid="false"`).
- **render/required**: when `required=true`, both native `required` and `aria-required="true"` are
  present.
- **render/disabled**: native `disabled` is present; no `aria-disabled` (native `disabled` on a real
  `<textarea>` is sufficient and correct).
- **render/readonly**: native `readonly` is present; `aria-readonly` is absent (the platform exposes it).
- **render/sizes**: for each of `sm`, `md`, `lg`: `data-size` matches; the rendered class contains
  the correct text + padding token references (`--lv-text-xs` / `--lv-space-2` etc.).
- **render/autosize-data-attrs**: when `autosize=true, minRows=2, maxRows=8`, the `<textarea>` has
  `data-lv-autosize`, `data-lv-min-rows="2"`, `data-lv-max-rows="8"`.
- **render/count-data-attr**: when `showCount=true`, the `<textarea>` has `data-lv-count-for="<areaId>"`.
- **render/model-param**: when `model="body"`, the `<textarea>` has `l:model="body"` in its rendered
  output (the dedicated model param emits the directive, not `attrs`).
- **render/maxlength-attr**: when `maxLength=200`, `maxlength="200"` is on the `<textarea>`.

### Accessibility tests (axe-core on rendered DOM)

- **axe/paired-label-no-violations**: a `<label for="t1">Description</label>` + `<textarea id="t1">` pair
  passes axe with zero violations (the test renders both elements — the partial contributes the `id`,
  the caller contributes the `<label>`).
- **axe/no-label-violation**: a `<textarea>` rendered without any associated label, `ariaLabel`, or
  `aria-labelledby` FAILS the axe `label` rule with exactly one violation on `#<areaId>` — this test
  asserts the rule fires, confirming the gate is meaningful.
- **axe/aria-label-satisfies**: `ariaLabel="User notes"` passes axe with zero violations (no external
  `<label>` needed when `aria-label` is set).
- **axe/aria-invalid-with-described-error**: `invalid=true` + `describedBy="err-id"` (and a `<span
  id="err-id">` in the test DOM) passes axe with zero violations.
- **axe/disabled-no-violations**: `disabled=true` passes axe with zero violations.
- **axe/readonly-no-violations**: `readonly=true` passes axe with zero violations.

### Keyboard tests (platform; assert OBSERVABLE outcomes in jsdom)

- **keyboard/tab-into**: Tab moves focus to the `<textarea>` (`document.activeElement === textarea`).
- **keyboard/tab-out**: Shift+Tab from the focused `<textarea>` moves focus AWAY; Tab moves focus AWAY —
  the field does NOT trap Tab (contrast with `dialog`).
- **keyboard/enter-inserts-newline**: pressing Enter in a focused `<textarea>` inserts `"\n"` into
  `textarea.value` (assert `textarea.value.includes("\n")`).
- **keyboard/enter-does-NOT-submit**: pressing Enter does NOT fire a `submit` event on a containing
  `<form>` (assert form `submit` listener is never called — `<textarea>` overrides `<input>`'s submit
  on Enter intentionally).
- **keyboard/ctrl-a-selects-all**: Ctrl+A gives `selectionStart === 0 &&
  selectionEnd === textarea.value.length`.
- **keyboard/disabled-not-focusable**: Tab does NOT land on a `disabled` textarea (assert
  `document.activeElement !== textarea` after Tab with `disabled=true`).
- **keyboard/enhancer-swallows-no-key**: after mounting the `textarea-autosize` enhancer on a real
  `LievitRuntime`, typing characters still reaches `textarea.value` (assert `textarea.value` updates);
  the enhancer registers zero `keydown`/`keyup` listeners (assert via `getEventListeners` or spy).

### Enhancer tests (jsdom + real `LievitRuntime` + real enhancer — NOT mocked `$lievit`)

- **enhancer/autosize-grows-on-input**: mount `<textarea data-lv-autosize data-lv-min-rows="2">` with
  two lines of text, capture initial `height`; fire an `input` event after setting the value to 10 lines;
  assert `textarea.style.height` increased.
- **enhancer/autosize-capped-at-max-rows**: `data-lv-min-rows="2" data-lv-max-rows="4"`; fill with
  10 lines; assert `height ≤ (lineHeight × 4 + paddingTop + paddingBottom)` and `overflowY` is
  scrollable.
- **enhancer/autosize-shrinks-on-clear**: after growing, clear the value and fire `input`; assert
  `height` returns to the `minRows` floor.
- **enhancer/caret-survives-grow**: while the textarea is focused with the caret at a known position,
  fire `input` causing growth; assert `selectionStart` and `selectionEnd` are unchanged (no caret jump).
- **enhancer/user-drag-stops-autosize**: simulate a user drag (set a custom height via `style.height`,
  fire `mouseup`); assert `data-lv-user-resized` is set; assert a subsequent `input` event does NOT
  change `style.height`.
- **enhancer/count-updates-on-input**: mount with `data-lv-count-for` + an `<output>` sibling,
  `maxLength=100`; type 50 characters; assert `output.textContent === "50 / 100"`.
- **enhancer/count-zero-to-start**: on mount with `value=""`, count shows `"0 / 100"` immediately
  (not empty).
- **enhancer/count-over-limit-destructive**: type 101 characters into a `maxLength=100` field; assert
  the count output has the destructive CSS class; assert the announcer was called once with a
  "character limit reached" message.
- **enhancer/count-under-limit-clears-destructive**: from over-limit, delete chars back under the limit;
  assert the destructive class is removed; the announcer is NOT called again until the threshold is
  re-crossed.
- **enhancer/morph-resync**: simulate a `lievit:morphed` event on the textarea after changing
  `value` externally (e.g. server re-render); assert `height` and count are recomputed without a
  second mount call (no double-bind).
- **enhancer/idempotent-mount**: call `enhanceAllTextareaAutosize` twice on the same root; assert
  exactly one `input` listener is registered (the `data-lv-textarea-enhanced` guard works).
- **enhancer/no-mount-without-data-attr**: a `<textarea>` WITHOUT `data-lv-autosize` inside the scope
  is NOT enhanced (assert `data-lv-textarea-enhanced` is absent).
- **enhancer/disabled-textarea-inert**: `disabled=true`; the enhancer does NOT resize or update the
  count (the `input` event never fires on a disabled element; assert no side effects).

### Wire binding test (real runtime, `l:model` path)

- **wire/model-binding**: mount a host WIRE component that renders a `<textarea l:model="note">` via
  this partial (with `model="note"`); type characters; assert the wire field `note` on the host
  component is updated on `input` via the `l:model` directive (assert on a real `LievitRuntime`,
  NOT a mock; the `CollapsibleComponentIT` pattern).

### Escaping / security tests

- **escaping/hostile-dataAttrs**: `dataAttrs = Map.of("x", "\"><script>alert(1)</script>")` renders
  as `data-x="&quot;&gt;&lt;script&gt;..."` — no unescaped `<script>` in the output.
- **escaping/value-auto-escaped-by-jte**: `value = "<img src=x onerror=alert(1)>"` renders as
  text content, HTML-escaped by the JTE template engine; no script executes.
- **escaping/attrs-trusted-only**: document (via a comment in the test file) that passing a
  DB-derived string via `attrs` would produce unescaped output — confirm `attrs` is ONLY used with
  static author strings. No automated test for the intentional trust boundary; document the boundary
  explicitly in the test file.

### JTE compile + render gate

- **jte-compile/textarea-jte**: the real JTE compiler successfully compiles `textarea.jte` — covered
  by the `test/jte-compile` gate that runs on every build.
- **jte-render/default-params**: a smoke render with all params at their defaults (no NPE on null
  `value`, null `id`, null `hint`, null `ariaLabel`).
- **jte-render/all-booleans-true**: a smoke render with `autosize=true, showCount=true, invalid=true,
  disabled=true, required=true, readonly=true` exercises the conditional branches without NPE.

## 8. Non-goals / anti-patterns

- **Rich text / WYSIWYG**: this is a PLAIN text field. Markdown preview, syntax highlighting, bold/italic
  toolbar, `contenteditable` — these are the `rich-text-editor` component (S2, `+ENH`). A textarea with
  a Markdown preview panel is a composition of this partial + a `preview` partial in the consuming
  template, never a textarea variant.

- **`contenteditable` as the implementation**: use a native `<textarea>`. `contenteditable` elements
  have inconsistent ARIA semantics across browsers, require custom caret handling, and break
  `selectionStart`/`selectionEnd`. The native element gives everything for free; do not replace it.

- **Auto-submit on Enter**: the partial does NOT wire Enter for submission. A consuming WIRE template that
  wants Ctrl+Enter to submit uses `attrs="l:keydown.ctrl.enter=\"save\""`. The partial is agnostic; it
  must not swallow Enter.

- **Managed / controlled value**: the partial renders `value` as the initial text content and stays out of
  the way. `l:model` on the consuming template is the wire binding. There is no `onChange` callback, no
  reactive state in this partial. Do not add client-side value management to the partial or enhancer.

- **Per-keystroke wire round-trip**: a server call on every keypress is a chat pattern, not a feature.
  The `l:model.debounce` directive (caller's decision) limits round-trips; the count + autosize are
  deliberately client-only for this reason. The enhancer fires NO wire action.

- **Stacking additional enhancers on this partial**: the `textarea-autosize` enhancer is the ONLY
  enhancer this partial registers. The `mentions` component (S2) composes its OWN enhancer OVER a
  textarea's raw element — that is a separate component (`mentions`), not an extension of this
  partial's enhancer. Do not add mentions, tagging, or command triggering here.

- **Character count as the validation gate**: `maxLength` is informational UI. Server-side length
  validation is the consuming WIRE component's Java action responsibility. The `maxlength` HTML
  attribute is a UX convenience, not the security boundary (truncation can be bypassed; validate in Java).

- **`role="textbox"` on the element**: the native `<textarea>` already exposes `role=textbox` and
  `aria-multiline=true` implicitly. Adding the role attribute is redundant and risks de-syncing
  ARIA properties. Never add `role="textbox"` in the template.

- **Solving the label problem**: the partial does not render a `<label>`. Use the `field` wrapper for a
  complete labeled field. Using this partial raw without a `<label for>` or `ariaLabel` is a WCAG 4.1.2
  failure — the axe test asserts it loudly. The partial is not responsible for solving it; it is
  responsible for making the violation visible.

- **Resize with a custom drag handle**: the `resize` CSS axis is a Tailwind utility passed via
  `cssClass`. A custom drag handle that enforces min/max constraints belongs to a future
  `resizable-panes` component, not here.

## Agent instructions (the discipline reminders, verbatim)

- Generate ORIGINAL code over `--lv-*` tokens. You MAY read Ant Design Input.TextArea (autosize,
  `showCount`) + shadcn `<Textarea>` + Tailwind UI form elements as references for PATTERN and LOOK.
  You MUST NOT paste literal source or class strings from any of them — output is always original
  generation (the one bright line, `02`).
- Mirror `button.jte` house conventions EXACTLY: header doc-comment with credits line, typed `@param`
  with defaults, `data-slot`, the two escaping channels (`attrs` trusted-raw vs `dataAttrs` escaped),
  ZERO `<script>`, ZERO inline `on*=`. The DELTA over the current `registry/jte/textarea.jte` is: the
  `size` param, the `autosize`/`minRows`/`maxRows`/`showCount`/`maxLength`/`hint`/`model` params, the
  `<output>` count sibling, the net-new `textarea-autosize.enhancer.ts`, and the explicit a11y test gate.
- The native `<textarea>` IS the textbox. Do NOT add `role="textbox"`. Do NOT re-implement caret,
  keyboard, or selection. Do NOT swallow keystrokes in the enhancer. The enhancer touches height and
  count ONLY.
- Do NOT compose popover seam / focus-trap / collection-nav (this component needs none of them).
  The only shared mechanism allowed is the announcer, for the single over-limit threshold announcement.
- The enhancer follows the `input-otp` enhancer contract: CSP-clean (listeners in code, no inline),
  idempotent (`data-lv-textarea-enhanced` guard), swap-safe (`enhanceAll*` re-runs after morph via
  the lifecycle registry), fires NO wire action.
- The `<output>` element is the semantically correct choice for the count (it expresses a computed
  result associated with a form control via the `for` attribute, like a `<label for>` but for output).
  Do not use `<span>` with `aria-live` for the count (the `<output>` element is the idiomatic choice;
  the shared announcer handles the one threshold announcement separately).
- Render the count and hint ONLY when their params are non-null/non-false — no empty
  `<span>` in the DOM when unused (DOM cleanliness; the render test asserts no wrapper without trigger).
- `aria-invalid` must be ABSENT (not `"false"`) when `invalid=false` — per APG convention (the render
  test asserts this).
- Minimal code to GREEN against the acceptance tests in §7. The escaping and the "enhancer swallows no
  key" tests are non-optional — they assert the XSS boundary and the platform-first invariant.
