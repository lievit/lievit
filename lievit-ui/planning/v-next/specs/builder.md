<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — builder (EXEMPLAR: composite block-list, PARTIAL + ENH, progressive enhancement)

- **tier**: PARTIAL + ENH (`builder.enhancer.ts`, the CSP-clean in-place block management)
- **build sequence**: S2  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/builder.jte` + `registry/jte/builder/block.jte` + `registry/jte/builder.enhancer.ts`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG — no single named pattern; BUILT from primitives: `<fieldset>`/`<legend>` for the list, `role="group"` for the add-block menu and each card, `aria-live="polite"` for the announcer. The keyboard model is entirely platform-native (`<button>`, `<input>`, `<select>`, `<textarea>` within each card carry their own semantics; no roving tabindex or focus trap). Filament Builder is the authoritative inventory reference for the block-list pattern in a gestionale context.
    - inventory: Filament Builder (PHP/Livewire) as the inventory reference — the heterogeneous typed-block model, the recursive `blocksContent` + `templates` authoring contract, the `__type` hidden field, the JS-OFF submit path, the JS-ON clone-and-reindex path.
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI card / section patterns (NO code copied)

## 1. What it is

A builder renders an ordered list of **heterogeneous typed blocks**: unlike the `repeater` (which repeats the SAME field schema), a builder lets the adopter mix DIFFERENT block types in a single ordered list (e.g. a page builder that accepts `heading`, `paragraph`, `image`, `callout` blocks in any combination and order).
Each block carries a hidden `<name>[<i>][__type]` field plus its type-specific fields named `<name>[<i>][...]`, so the whole list POSTs as a typed indexed form-array that the server rebuilds into an ordered list of typed records — with zero JavaScript required.
The component is PARTIAL because the list's ordering truth is always the POST body (native inputs, no WIRE round-trip for reordering), and the one irreducible client behavior — in-place block add (clone the per-type `<template>`) and remove (drop a card), followed by re-indexing every surviving field name — is the typed-TS `builder.enhancer.ts`, a progressive enhancement over a working JS-OFF path.

**The JS-OFF path is first-class and MUST work**: adding a block submits the form with `name="<name>__addblock" value="<type>"`; removing submits with `name="<name>__remove" value="<index>"`; the server appends or drops and re-renders. The enhancer makes these in-place, but the POST semantics are identical.

The component ships as two JTE partials (`builder.jte` — the list container — and `builder/block.jte` — one typed block card) plus the `builder.enhancer.ts`. The adopter composes them: the block body is a recursive `gg.jte.Content` slot the adopter authors (any lievit fields, named `<name>[<index>][...]`), keeping the component fully generic across any domain schema.

## 2. API — params

### `builder.jte` (the list container)

| param | type | default | meaning |
|---|---|---|---|
| `name` | `String` | — | **REQUIRED.** The field prefix; all child inputs POST as `<name>[<i>][...]` |
| `count` | `int` | `0` | How many existing block cards are rendered; used to seed the initial reindex |
| `blockTypes` | `java.util.Map<String,String>` | `null` | The add-block menu: type key → button label. If null/empty, the add-block menu is omitted |
| `blocksContent` | `gg.jte.Content` | `null` | **RECURSIVE slot**: the adopter renders existing blocks here, each via `@template.lievit.builder.block(...)`, using real indices |
| `templates` | `gg.jte.Content` | `null` | **JS-ON clone slot**: one `<template data-builder-template="<type>">` per block type, each a complete blank `builder.block(...)` card using `__i__` as the index token (the enhancer substitutes the real index on clone) |
| `label` | `String` | `null` | Visible `<legend>` text for the list `<fieldset>`; omitted when null/blank |
| `addLabel` | `String` | `"Add block"` | Label text prepended to the add-block menu (e.g. "Add content block") |
| `disabled` | `boolean` | `false` | Disables all add and remove controls |
| `cssClass` | `String` | `""` | Extra utility classes on the `<fieldset>` wrapper |

### `builder/block.jte` (one typed block card — sub-partial)

| param | type | default | meaning |
|---|---|---|---|
| `name` | `String` | — | **REQUIRED.** The builder's field prefix (must match the parent builder) |
| `index` | `int` | — | **REQUIRED.** This block's 0-based position (used in field names + aria-label) |
| `type` | `String` | — | **REQUIRED.** The block's type key; POSTs as `<name>[<index>][__type]` |
| `typeLabel` | `String` | `null` | Human-readable card heading / accessible name; defaults to `type` when null/blank |
| `content` | `gg.jte.Content` | `null` | **RECURSIVE slot**: the block's fields (named `<name>[<index>][...]`) authored by the adopter |
| `disabled` | `boolean` | `false` | Disables the per-block remove control |

### Escaping channels (load-bearing security convention)

- `name`, `type`, `index`, and `typeLabel` are JTE-escaped in expressions (`${name}`, `${type}`) via JTE's default HTML-escaping — they are not in the trusted `attrs` channel.
- The `data-builder-add`, `data-builder-template`, and `data-builder-block-type` attribute values come from `blockTypes.getKey()` / `type`, which are author-controlled at template composition time (static, typed Java `Map`). The adopter MUST NOT feed user-submitted strings into `blockTypes` keys.
- The enhancer reads `dataset.builderAdd` / `dataset.builderTemplate` (JavaScript `dataset` API) which returns the already-server-escaped attribute value — no second round of escaping needed in the enhancer.

## 3. Variants / Sizes / States

### Variants

The builder itself has no intent variant — it is a structural layout, not an action.
The add-block buttons use the `outline` visual style (dashed border, transparent background) to distinguish them from primary-action buttons.
The remove button per card uses the `ghost` + `hover:destructive` pattern (icon-only, muted by default, turns destructive on hover) to signal danger without permanently occupying destructive visual weight.

### Sizes

The builder does not expose a `size` param at the list level — the card chrome (heading text, remove button) uses `sm`-height (`--lv-space-8`, 32px) for the remove icon button.
Individual field controls WITHIN a block body inherit their sizes from the adopter's template (they are plain lievit form fields with their own `size` params).

### States

| State | Trigger | Effect |
|---|---|---|
| `disabled` | `disabled=true` on the builder | All add-block buttons + all remove buttons get the native `disabled` attribute; `disabled:cursor-not-allowed disabled:opacity-50` |
| add button `:hover` / `:focus-visible` | pointer / keyboard | `hover:bg-[--lv-color-muted]`; `focus-visible:border-[--lv-color-ring] focus-visible:shadow-[--lv-ring]` |
| remove button `:hover` | pointer | `hover:text-[--lv-color-destructive]` (the destructive signal only on hover; muted at rest) |
| remove button `:focus-visible` | keyboard | `focus-visible:border-[--lv-color-ring] focus-visible:shadow-[--lv-ring]` |
| empty list | `count=0` + no `blocksContent` | The blocks host renders empty; the add-block menu remains visible; no placeholder text (the adopter composes an `empty` partial in `blocksContent` if needed) |
| live announcement | enhancer add/remove | `aria-live="polite"` region receives "Block added" / "Block removed" text (announced once, then cleared on next interaction) |

## 4. The a11y contract

- **WAI-ARIA pattern**: no single APG pattern governs the builder as a whole. The structure is BUILT from these APG primitives:
    - The list: a native `<fieldset>` with a `<legend>` (the labelled group of form controls pattern — APG semantic grouping).
    - The add-block menu: a `role="group"` `<div>` with `aria-label` containing real `<button type="submit">` elements — one per type.
    - Each block card: `role="group"` with `aria-label="<typeLabel> <N>"` (a labelled group, not a `role="region"` — a region implies landmark-level navigation significance; a builder card is a form sub-group).
    - The announcer: a `<span aria-live="polite" class="sr-only">` that receives plain text on add/remove.
    - APG reference: https://www.w3.org/WAI/ARIA/apg/patterns/ (general grouping + live region patterns; no single "block builder" pattern exists in APG — this is a BUILT composition).

- **roles + ARIA**:
    - `<fieldset data-slot="builder">`: the list root; `<legend data-slot="builder-label">` provides the accessible name of the fieldset (rendered only when `label` is non-blank).
    - `<div data-slot="builder-add-menu" role="group" aria-label="${addLabel}">`: the add-block menu; `aria-label` is the group's accessible name (the `addLabel` param). Each child button has its own `aria-label="${addLabel}: ${typeLabel}"` (e.g. "Add block: Heading") so its action is unambiguous when read in isolation by a screen reader.
    - `<div data-slot="builder-block" role="group" aria-label="${typeLabel} ${index + 1}">`: each block card. The label encodes both type and position (e.g. "Heading 1", "Paragraph 2"). The enhancer updates `aria-label` on every reindex so the label stays accurate after add/remove.
    - `<input type="hidden" data-slot="builder-block-type" name="<name>[<i>][__type]">`: form-only; not announced.
    - `<button data-slot="builder-remove" aria-label="Remove ${typeLabel} ${index + 1}">`: the remove action; icon-only → `aria-label` is mandatory (enforced by the spec; failure = accessible-name violation in axe).
    - `<span data-slot="builder-live" aria-live="polite" class="sr-only">`: the status announcer. `polite` is correct (not `assertive`) — add/remove is user-initiated and non-urgent; interrupting the current reading flow is unnecessary.

- **keyboard map**:
  | key | does | who |
  |---|---|---|
  | Tab / Shift+Tab | moves between the `<legend>`, add-block buttons, block cards (each card's fields + remove button), and the announcer (sr-only, not tab-stopped) | platform |
  | Enter / Space (on an add-block button) | triggers the JS-ON clone of that type's `<template>` (enhancer) OR the JS-OFF form submit (`type="submit"`) | platform native `<button>` triggers; enhancer intercepts `click` and calls `e.preventDefault()` on JS-ON |
  | Enter / Space (on a remove button) | drops the block card in place (enhancer) OR the JS-OFF form submit | same as above |
  | (any key on block body fields) | standard field editing | platform native `<input>`, `<select>`, `<textarea>` |

  There is NO roving tabindex, NO arrow navigation between blocks, and NO focus trap — the builder is a flat form sub-group, not a widget. All keyboard interaction is supplied by the platform.

- **focus management**:
    - **On add**: the enhancer focuses the first focusable non-hidden field in the newly-cloned block (`input:not([type=hidden])`, `select`, `textarea`). If no such field exists the enhancer takes no action (focus stays where it was).
    - **On remove**: the enhancer does not manage focus explicitly — after a card is removed the platform may leave focus on `<body>` (the removed element). Improvement: if a card at index `i` is removed, the enhancer SHOULD move focus to the remove button of the preceding card (`i-1`) or, if none, to the first add-block button. This is the correct behavior per the Filament pattern and MUST be implemented.
    - **No trap**: the builder is non-modal; Tab exits naturally.
    - **Scroll**: no scroll management; the browser naturally scrolls the newly-added block into view because focus moves into it.

- **live region**:
    - `aria-live="polite"` region at the end of the `<fieldset>`. The enhancer sets its `textContent` on every add ("Block added") and remove ("Block removed"), then does NOT clear it immediately (a zero-delay clear would prevent the announcement from completing in some SRs). The text is overwritten on the next add/remove; it is permanent until then (sr-only via `class="sr-only"`).
    - The message text SHOULD name the block type: "Heading block added", "Paragraph 2 removed" — this gives the screen reader user better context than "Block added". The enhancer derives this from the card's `aria-label` at the time of the operation.

- **shared mechanism composed**:
    - None of the three shared mechanisms (popover seam, `focus-trap`, `collection-nav`) applies to the builder. It is a flat, non-overlay, non-collection widget.
    - The `reindexFieldName` helper is inlined in `builder.enhancer.ts` (self-contained for the copy-in distribution model) and exported for unit-testing and reuse by the `repeater.enhancer.ts`. It is NOT a separate shared module (the two enhancers are logically siblings, not consumers of a third).

## 5. Tokens

Reads:

| Token | Used for |
|---|---|
| `--lv-font-sans` | wrapper and card font-family |
| `--lv-text-sm` | legend text, add-button label, card heading, muted label |
| `--lv-font-medium` | legend + card heading font-weight |
| `--lv-color-fg` | legend text, add-button text |
| `--lv-color-muted-fg` | card heading text (de-emphasized), add-button label prefix |
| `--lv-color-muted` | add-button hover background |
| `--lv-color-destructive` | remove button hover text |
| `--lv-color-input` | add-button default dashed border; remove button border |
| `--lv-color-border` | card card border |
| `--lv-color-surface` | card card background |
| `--lv-color-bg` | remove button background |
| `--lv-color-ring` | focus-visible border + ring color |
| `--lv-space-1` | icon-label gap inside add-block button |
| `--lv-space-2` | gap between add-block menu items; remove button–heading gap |
| `--lv-space-3` | gap between block cards; gap between card sections |
| `--lv-space-4` | card internal padding |
| `--lv-space-8` | add-block button height (sm tier); remove button size (square) |
| `--lv-radius-md` | add-block button radius; remove button radius |
| `--lv-radius-lg` | card card border-radius |
| `--lv-shadow-xs` | card card shadow; remove button shadow |
| `--lv-ring` | focus-visible ring shadow |

**NET-NEW tokens**: none. The builder's full visual language is covered by the existing v2 token set.
The card uses `--lv-color-surface` (not `--lv-color-popover`) because it is an in-page card, not a floating overlay.
Dark mode re-point is automatic via the existing `.dark, [data-theme="dark"]` block — no new dark-mode rules needed.

## 6. Wire actions (PARTIAL + ENH: the enhancer is the interaction layer, not a WIRE round-trip)

The builder is PARTIAL, not WIRE. The server receives the block list on form submit, not via a wire round-trip. The interaction contract is between the JTE template and the typed-TS enhancer.

### Data attributes as the contract (the `data-*` hook surface)

| Attribute | Element | Meaning |
|---|---|---|
| `data-lievit-builder` | `<fieldset>` (the root) | Mount point: `enhanceBuilder(root)` / `enhanceAllBuilders()` find roots by this attribute |
| `data-builder-enhanced` | `<fieldset>` (root, after mount) | Idempotency marker; set by the enhancer on first mount |
| `data-name="<prefix>"` | `<fieldset>` | The field prefix read by the enhancer for `reindexFieldName` calls |
| `data-disabled="true"` | `<fieldset>` | Read by the enhancer to short-circuit add/remove when the whole builder is disabled |
| `data-builder-blocks` | `<div>` (the live block list) | Enhancer queries this for current cards and appends cloned blocks here |
| `data-builder-block` | `<div>` (each card) | Enhancer queries for cards; also the selector for `reindex()` iteration |
| `data-index="<i>"` | `<div>` (each card) | Current 0-based index; updated by `reindex()` after every add/remove |
| `data-type="<key>"` | `<div>` (each card) | The block's type key; read by `relabel()` for the announcer message |
| `data-builder-block-type` | `<input type="hidden">` | The hidden `__type` field; the enhancer rewrites its `name` on reindex |
| `data-builder-remove` | `<button>` (per card) | Enhancer listens for click events delegated to this; `removeBlock(card)` fires |
| `data-builder-templates` | `<div hidden>` (template host) | Enhancer finds the `<template>` elements here by type |
| `data-builder-template="<key>"` | `<template>` (per type) | Per-type blank card; `templateFor(type)` queries this selector |
| `data-builder-add-menu` | `<div role=group>` | Present for structural clarity; not queried by the enhancer (event delegation on root handles add buttons) |
| `data-builder-add="<key>"` | `<button>` (add-block button) | Enhancer reads this on click; `addBlock(type)` fires with the key |
| `data-builder-live` | `<span aria-live=polite>` | Enhancer updates `textContent` on add/remove for SR announcements |

### Enhancer responsibilities

1. **Mount** (`enhanceBuilder(root: HTMLElement)`): verify `[data-builder-blocks]` exists; set `data-builder-enhanced`; run `reindex()` once to normalize any server-rendered state; attach the single delegated `click` listener to the root.

2. **Add block** (delegated click on `[data-builder-add]`):
   - `e.preventDefault()` to suppress the JS-OFF form submit.
   - Find the `<template data-builder-template="<type>">` inside `[data-builder-templates]`.
   - Clone its `content` (a `DocumentFragment`); find the `[data-builder-block]` root inside the fragment.
   - Append the card to `[data-builder-blocks]`.
   - Call `reindex()` (rewrites all names + aria-labels across ALL surviving cards, including the new one).
   - Focus the first focusable non-hidden field in the new card.
   - Announce: `live.textContent = "<TypeLabel> block added"`.

3. **Remove block** (delegated click on `[data-builder-remove]`):
   - `e.preventDefault()` to suppress the JS-OFF form submit.
   - Find the closest `[data-builder-block]` ancestor of the clicked remove button.
   - Determine the focus target BEFORE removal (the remove button of the preceding card, or the first add-block button as fallback).
   - Remove the card from the DOM.
   - Call `reindex()`.
   - Move focus to the pre-determined target.
   - Announce: `live.textContent = "<TypeLabel> N removed"` (using the pre-removal label).

4. **Reindex** (`reindex()`):
   - Iterate every `[data-builder-block]` in DOM order.
   - For each card at index `i`:
     - `card.setAttribute("data-index", String(i))`.
     - Update `card.setAttribute("aria-label", relabel(card.getAttribute("aria-label"), i))`.
     - For every `[name]` descendant (`input`, `select`, `textarea`): `field.name = reindexFieldName(field.name, prefix, i)`.
     - Update the remove button `aria-label`: `relabel(remove.getAttribute("aria-label"), i)`.

5. **`reindexFieldName(name, prefix, index)`** (exported, DOM-free, unit-testable):
   - Rewrites the FIRST bracket segment: `<prefix>[<old>][rest]` → `<prefix>[<index>][rest]`.
   - Old segment may be a number or the `__i__` template token; anything else is left unchanged.
   - Idempotent: calling twice with the same index produces the same result.

6. **`enhanceAllBuilders(scope: ParentNode = document)`**: queries `[data-lievit-builder]` within `scope`; calls `enhanceBuilder` on each. Should be called after initial page load and after any DOM swap that may have introduced a new builder (Turbo Drive navigation already fires `turbo:load` which the caller should hook).

### JS-OFF fallback (the server path — MUST remain functional)

When the enhancer has not run (or is unavailable):
- Each add-block button is a `<button type="submit" name="<name>__addblock" value="<type>">` inside a `<form>`. The server receives the submit, appends a blank block of the named type to the list, and re-renders the full form. The `count` param increments.
- Each remove button is a `<button type="submit" name="<name>__remove" value="<index>">`. The server receives the submit, drops the block at that index, re-indexes the remaining records, and re-renders.

The server-side handler for `<name>__addblock` and `<name>__remove` is the ADOPTER's responsibility (lievit ships the markup contract; the server logic is in the adopter's Spring controller). The spec defines the POST field names; the adopter implements the handler.

## 7. Acceptance tests

All tests run on a REAL substrate (no mocked runtime):

### Structural / a11y (jsdom, no enhancer mounted)

- **`builder-jte-a11y-structure`**: render `builder.jte` with two block types (`heading`, `paragraph`) and one existing `heading` block card. Assert: root is a `<fieldset data-slot="builder">`; `<legend>` text equals the `label` param; `[data-builder-add-menu]` has `role="group"` and `aria-label` equals `addLabel`; one add-block `<button>` per type exists with the correct `aria-label`; `[data-builder-blocks]` contains one `[data-builder-block]` child; `[data-builder-templates]` is hidden; `[data-builder-live]` has `aria-live="polite"`. Zero axe-core violations (axe rules: `aria-roles`, `aria-required-attr`, `aria-allowed-attr`, `aria-label`, `button-name`).

- **`builder-block-jte-a11y-structure`**: render `builder/block.jte` with `name="b"`, `index=2`, `type="paragraph"`, `typeLabel="Paragrafo"` and a content slot containing an `<input name="b[2][testo]">`. Assert: root is `<div role="group" aria-label="Paragrafo 3">`; hidden input `name="b[2][__type]"` `value="paragraph"` present; remove button `aria-label="Remove Paragrafo 3"` present; content slot rendered with the `<input>`. Zero axe-core violations.

- **`builder-no-label-no-legend`**: render `builder.jte` with `label=null`. Assert: no `<legend>` element in the DOM.

- **`builder-no-types-no-add-menu`**: render `builder.jte` with `blockTypes=null`. Assert: no `[data-builder-add-menu]` in the DOM.

- **`builder-disabled-controls`**: render `builder.jte` with `disabled=true`. Assert: all add-block `<button>` elements have the native `disabled` attribute; render `builder/block.jte` with `disabled=true` and assert the remove `<button>` has `disabled`.

- **`builder-csp-clean`**: assert `builder.jte` markup contains no `<script` and no `\son[a-z]+=` (inline handler) — the existing test in `builder.test.ts` covers this and MUST be preserved in v-next.

- **`builder-escaping-type-key`**: confirm that a `type` value containing `"` or `>` (hostile but author-controlled in practice) is JTE-escaped in the rendered `data-builder-template` attribute and the hidden input `value`; assert the raw character does not appear unescaped in output.

### Enhancer DOM behaviour (jsdom, real `builder.enhancer.ts` mounted)

- **`builder-add-clones-correct-type`**: render a DOM matching `builder.jte` with one existing `heading` card and both `heading` + `paragraph` templates. Mount the enhancer. Click the `paragraph` add button. Assert: two `[data-builder-block]` cards present; the new card's `[data-builder-block-type]` value is `paragraph`; the new card's `name` attributes are `b[1][__type]`, `b[1][testo]`; the click event is `defaultPrevented`.

- **`builder-add-focuses-first-field`**: same setup. After clicking add, assert `document.activeElement` is the first non-hidden input inside the new card.

- **`builder-remove-reindexes-contiguous`**: render three cards (`heading`, `paragraph`, `heading`) at indices 0–2. Mount enhancer. Click the remove button on card 1 (the paragraph). Assert: two cards remain; their `[data-builder-block-type]` names are `b[0][__type]` and `b[1][__type]`; body field names are `b[0][testo]` and `b[1][testo]`; card `aria-label` values are "Heading 1" and "Heading 2".

- **`builder-remove-focuses-preceding-card`**: render two cards. Mount enhancer. Click remove on card 1 (index 1). Assert focus moved to the remove button of card 0. Then render only one card, remove it; assert focus moved to the first add-block button.

- **`builder-announce-add`**: mount enhancer. Click add (paragraph). Assert `[data-builder-live].textContent` contains "added" (case-insensitive).

- **`builder-announce-remove`**: mount enhancer with one card. Click remove. Assert `[data-builder-live].textContent` contains "removed".

- **`builder-unknown-type-adds-nothing`**: mount enhancer. Synthesize a click on a `[data-builder-add="video"]` button where no `[data-builder-template="video"]` exists. Assert zero cards added; no JS error thrown.

- **`builder-idempotent-mount`**: call `enhanceBuilder(root)` twice. Assert `[data-builder-enhanced]` present; a single click on an add button results in exactly one new card.

- **`builder-enhance-all-wires-multiple-roots`**: create two separate `[data-lievit-builder]` roots in the document. Call `enhanceAllBuilders()`. Assert both have `[data-builder-enhanced]`.

- **`builder-reindex-field-name-unit`** (pure function, no DOM): `reindexFieldName("b[3][testo]", "b", 1)` → `"b[1][testo]"`; `reindexFieldName("b[__i__][__type]", "b", 0)` → `"b[0][__type]"`; `reindexFieldName("altro[0][x]", "b", 2)` → `"altro[0][x]"` (unchanged).

### JTE compilation

- **`builder-jte-compiles`**: covered by the `test/jte-compile` real-compiler + render gate. Both `builder.jte` and `builder/block.jte` must compile without error and render non-empty HTML with minimal params.

### Playwright / gesture fidelity (legacy-VM oracle)

- **`builder-e2e-add-and-submit`** (Playwright): navigate to a page that uses the builder. Click "Add block: Heading". Assert a new card appears with a text input. Fill the input. Submit the form. Assert the server's response shows the submitted `heading` block data (proving the POST contract is intact end-to-end).

- **`builder-e2e-remove-and-submit`** (Playwright): start with two pre-rendered blocks. Click remove on the first. Assert one card remains, re-indexed to 0. Submit. Assert only one block record in the server response.

- **`builder-e2e-keyboard-navigation`** (Playwright): Tab through the add menu buttons; press Space/Enter on "Add paragraph"; assert the paragraph card appeared and the first field is focused. Tab to the remove button; press Enter; assert the card removed.

## 8. Agent instructions

- Generate ORIGINAL code over `--lv-*` tokens. You MAY read the Filament Builder source (PHP) as an INVENTORY reference for the block-list authoring model and the JS-OFF submit path; you MUST NOT paste any PHP, Blade, or Livewire literal source. The lievit output is JTE + typed TypeScript, which is always original.
- The JS-OFF path is NON-NEGOTIABLE: the add-block buttons MUST remain `<button type="submit">` elements with `name` and `value` attributes; the enhancer MUST call `e.preventDefault()` on JS-ON and never remove or replace the submit semantics of those buttons.
- The `templates` slot MUST render inside a `hidden` container (`[data-builder-templates]`); the `<template>` elements inside are NOT rendered to the user, only cloned by the enhancer.
- The `reindexFieldName` helper MUST remain exported and DOM-free so it is unit-testable in isolation and reusable by the `repeater.enhancer.ts`.
- The `builder.enhancer.ts` MUST be self-contained (no cross-file imports of shared helpers) because it is delivered as a copy-in artifact under the distribution model (`01-distribution-consumable.md`).
- Mirror `button.jte`'s house conventions exactly: header `<%-- --%>` doc-comment with all labelled sections; typed `@param` with defaults; `data-slot="<name>"` on each structural element; `!{var ...}` for local computed strings; zero `<script>` or inline `on*=` handlers.
- The `builder/block.jte` is a SUB-PARTIAL: it lives at `lievit/builder/block.jte`, reached as `@template.lievit.builder.block(...)`. This is not a typo; the directory structure under `builder/` is intentional (it groups the block card with its parent, consistent with the existing registry layout).
- Focus management on remove is a MUST-implement correctness requirement (§4 focus management, §7 `builder-remove-focuses-preceding-card` test): a screen reader or keyboard user who removes a block must have focus land somewhere predictable, not on `<body>`.
- The announce text SHOULD include the block type name and number: "Heading 2 removed" beats "Block removed". Derive it from the card's `aria-label` before removal.
- Minimal code to GREEN against the acceptance tests in §7; refactor only while green. The keyboard map in §4 is the contract — every row must have a passing test.
