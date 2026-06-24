<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — rich-text-editor

- **tier**: WIRE + ENH (`rich-text.enhancer.ts`, net-new: contenteditable editing engine +
  toolbar roving tabindex + document command dispatch)
- **build sequence**: S2  (every component ships — no MMP cut, `03`)
- **status (current)**: NET-NEW (no existing `registry/jte/rich-text-editor.jte`)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Toolbar (`https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/`) +
      APG Toolbar example (`https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/examples/toolbar/`)
      as the pattern reference for toolbar keyboard + roving tabindex; the contenteditable textbox
      is a native-keyboard-handled element (no APG pattern for rich textbox — BUILT against
      `role="textbox" aria-multiline="true"` semantics per ARIA spec); no react-aria reference
      exists for this exact pattern (it is a gap from the APG side — BUILT against raw APG +
      the APG toolbar example).
    - inventory: ProseMirror feature shape as inventory reference for formatting command set
      (bold/italic/underline/strikethrough/headings/lists/blockquote/link/code/clear-formatting);
      NO ProseMirror / TipTap / Quill source copied; the client-side command dispatch is
      original vanilla-TS over the browser `Selection` + `document.execCommand`-shape (or a
      minimal original replacement where `execCommand` is deprecated); the WIRE contract is
      the lievit server-persisted-value pattern, not a ProseMirror schema.
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; toolbar look inspired by
      Tailwind UI prose toolbar (NO code copied); prose area uses a `prose` utility class
      driven entirely by `--lv-*` tokens.

## 1. What it is

A server-persisted rich-text field: a labelled toolbar of formatting controls above a
`contenteditable` editing region, where the formatted content (HTML string) is the server fact
held in a `@Wire String htmlContent` field. WIRE because the canonical content is server-owned
and must survive page navigation, form submit, and CSP constraints — the client never sends raw
DOM serialisation as truth; it sends a wire action (`update(String html)`) that the server
validates, sanitises, and stores. The irreducible CLIENT behavior — in-toolbar roving tabindex
navigation, formatting command dispatch into the contenteditable, live toolbar-state reflection
(Bold button pressed when caret is in a bold run), and character/word counting — is the shared
`rich-text.enhancer.ts` (net-new, registered as a lifecycle enhancer). The contenteditable
region itself carries `role="textbox" aria-multiline="true"` so it is announced as a multi-line
text field to screen readers; the toolbar carries `role="toolbar"` with roving tabindex per the
APG. The component does NOT embed ProseMirror, TipTap, Quill, or any third-party editing
framework — it is original vanilla-TS over the browser Selection API, keeping the CSP-clean
(script-src self, no eval) constraint that rules the entire lievit runtime. Server-first works
here because the edit cycle is: user types (client-only, ephemeral) → user triggers save
(blur or explicit save button → wire action) → server sanitises + stores → morph reflects the
canonical value. The live editing state between actions is client-ephemeral, exactly as it is in
a plain `<textarea>`.

## 2. API — the WIRE surface + template params

**Java (`RichTextEditorComponent`)**:

| member | kind | meaning |
|---|---|---|
| `htmlContent` `String` | `@Wire` | the stored rich-text HTML (sanitised, server-owned; shown as the initial contenteditable innerHTML and updated on every `update` action) |
| `placeholder` `String` | `@Wire @LievitProperty(locked=true)` | placeholder text shown when `htmlContent` is blank (CSS `[contenteditable]:empty::before`) |
| `toolbar` `List<ToolbarGroup>` | `@Wire @LievitProperty(locked=true)` | ordered list of toolbar groups; each group is a list of `ToolbarItem` (type: TOGGLE, BUTTON, SELECT, SEPARATOR); locked so the client cannot inject actions |
| `minHeight` `String` | `@Wire @LievitProperty(locked=true)` | CSS min-height token reference for the editing region, e.g. `"--lv-space-48"` (default) or a literal like `"12rem"` (used only for sizing, never for colour) |
| `maxHeight` `String` | `@Wire @LievitProperty(locked=true)` | CSS max-height (optional); when set the region scrolls internally |
| `disabled` `boolean` | `@Wire` | when true: `contenteditable="false"` on the region + all toolbar buttons disabled; `aria-disabled="true"` on the root |
| `readonly` `boolean` | `@Wire` | when true: `contenteditable="false"` + `aria-readonly="true"`; toolbar is hidden |
| `required` `boolean` | `@Wire @LievitProperty(locked=true)` | whether the field is required; adds `aria-required="true"` to the region |
| `characterLimit` `int` | `@Wire @LievitProperty(locked=true)` | 0 = no limit; when > 0 the enhancer tracks character count + blocks input past the limit; the template renders a `<span role="status">` counter |
| `wordCount` `boolean` | `@Wire @LievitProperty(locked=true)` | when true, renders a word-count `<span role="status">` alongside the character count |
| `fieldId` `String` | `@Wire @LievitProperty(locked=true)` | the `id` of the hidden `<input type="hidden">` that carries `htmlContent` in a plain form submit (the escape hatch when no wire action is wired) |
| `labelId` `String` | `@Wire @LievitProperty(locked=true)` | the `id` of the external `<label>` element that labels this field; the region's `aria-labelledby` points here |
| `descriptionId` `String` | `@Wire @LievitProperty(locked=true)` | optional; the `id` of an external description element; the region's `aria-describedby` points here when set |
| `update(String html)` | `@LievitAction` | receives the current innerHTML (after enhancer serialises it); server sanitises (allowlist: the same tags the toolbar can produce) + stores in `htmlContent`; fires on blur or explicit save; validation: sanitised result may not exceed `characterLimit` chars (stripped HTML); authz: caller must own the record |
| `triggerUpdate()` | internal; called by the enhancer via `l:change` on the region or by the save button | signals the server to collect the current innerHTML from the `data-pending-html` attribute the enhancer stamps on the region root before firing |

**`ToolbarItem` value type** (server-configured, `@LievitProperty(locked=true)` on the list):

| field | type | meaning |
|---|---|---|
| `command` `String` | enum slug | `bold \| italic \| underline \| strikethrough \| heading1 \| heading2 \| heading3 \| blockquote \| code-block \| ordered-list \| unordered-list \| link \| clear-formatting` |
| `ariaLabel` `String` | label | the accessible name of the toolbar button (e.g. `"Bold"`) |
| `iconName` `String` | icon slug | forwarded to `@template.lievit.icon(name=item.iconName(), ariaHidden=true)` |
| `type` `ToolbarItemType` | enum | `TOGGLE` (has pressed state, e.g. Bold) \| `BUTTON` (action, e.g. Clear) \| `SEPARATOR` (visual divider, `role="separator"`) |

**Template params** (one `@param` per `@Wire` field + infrastructure):

| param | type | meaning |
|---|---|---|
| `_component` | `ComponentMetadata` | instance metadata (id, snapshot) |
| `_instance` | `RichTextEditorComponent` | the live wire instance for derived reads |
| `htmlContent` | `String` | the stored HTML (server-trusted; rendered with `$unsafe` inside the contenteditable — see §3 escaping rule) |
| `placeholder` | `String` | placeholder text |
| `toolbar` | `List<ToolbarGroup>` | toolbar groups + items |
| `minHeight` | `String` | editing region min-height |
| `maxHeight` | `String` | editing region max-height (may be null) |
| `disabled` | `boolean` | disabled state |
| `readonly` | `boolean` | readonly state |
| `required` | `boolean` | required flag |
| `characterLimit` | `int` | 0 = no limit |
| `wordCount` | `boolean` | show word count |
| `fieldId` | `String` | hidden input id |
| `labelId` | `String` | the external label id for `aria-labelledby` |
| `descriptionId` | `String` | optional external description id for `aria-describedby` |

**Escaping discipline** (the load-bearing security rule — applies differently here than in most components):

- `htmlContent` is rendered with `$unsafe` inside the `contenteditable` region ONLY after the server has sanitised it through the allowlist (the `update` action runs sanitisation before persisting; what is stored is already clean; the template trusts the server-persisted value, NOT raw user input). The allowlist is the exact set of tags the toolbar commands can produce: `<p> <br> <strong> <em> <u> <s> <h1> <h2> <h3> <blockquote> <pre> <code> <ol> <ul> <li> <a href>` with no `on*` attributes, no `<script>`, no `<style>`. Any value that arrives from outside that allowlist is rejected by the `update` action before it is stored.
- All `ToolbarItem` server-configured strings (`ariaLabel`, `iconName`, `command`) are LOCKED (`@LievitProperty(locked=true)`) — the client cannot inject them — and are rendered into `data-command="..."` via the SAFE `dataAttrs` channel (each value through `Escape.htmlAttribute`).
- The `fieldId`, `labelId`, `descriptionId` fields are LOCKED server-config and rendered as `id=...` via the SAFE channel.
- No per-row DB-derived value feeds into an `attrs` trusted-raw position in this component.

## 3. Variants / sizes / states

**Sizes**: the toolbar controls align with the shared size scale; the toolbar row itself is sized
to `md` by default (height `--lv-space-9`). The editing region size is controlled by `minHeight`
/ `maxHeight` params, not the shared `sm|md|lg` scale (the region is a free-form text area, not
a fixed-height control). Toolbar button sizes track the toolbar's own size (always `md`).

**States**:

| state | how rendered | ARIA reflection |
|---|---|---|
| default | editing region `contenteditable="true"`, toolbar buttons enabled | — |
| `disabled` | region `contenteditable="false"`, all toolbar buttons `disabled` native + `aria-disabled="true"` | `aria-disabled="true"` on the outer wrapper |
| `readonly` | region `contenteditable="false"`, toolbar hidden | `aria-readonly="true"` on the region |
| `required` | — | `aria-required="true"` on the region |
| `aria-invalid` | destructive border + ring on the outer wrapper | `aria-invalid="true"` on the region |
| `aria-busy` | spinner in the status bar; set by the runtime `beforeCall`/`afterCall` hooks during the wire round-trip | `aria-busy="true"` on the outer wrapper (runtime-managed, component does not set this) |
| toolbar button `active` (command is applied at caret) | `aria-pressed="true"` on TOGGLE-type buttons; `aria-checked="true"` on radio-type alignment buttons; updated live by the enhancer | per-button ARIA toggle state |
| `characterLimit` reached | counter turns destructive-coloured; further input blocked by the enhancer | the counter `<span role="status">` announces the limit |

**Toolbar item types and their ARIA roles**:

| ToolbarItemType | HTML element | role | state attribute |
|---|---|---|---|
| `TOGGLE` | `<button>` | implicit `button` | `aria-pressed="true/false"` (updated by enhancer) |
| `BUTTON` | `<button>` | implicit `button` | `aria-disabled` when action not applicable |
| `SEPARATOR` | `<div>` | `role="separator"` | — |

**Toolbar groups**: each group of related commands (e.g. text-style: bold/italic/underline) is
wrapped in a `<div role="group" aria-label="<groupLabel>">` inside the toolbar. Groups are
purely structural / visual; they do not interrupt the roving tabindex sequence (the enhancer
roving covers ALL enabled controls across all groups as a flat list, per APG). A `SEPARATOR`
item renders a `role="separator"` divider between groups inside the `role="toolbar"` container.

## 4. The a11y contract (the heart — non-negotiable, fully specified)

**WAI-ARIA patterns**: APG Toolbar (`https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/`) for the
formatting control bar; `role="textbox" aria-multiline="true"` per the ARIA spec for the
`contenteditable` editing region (no dedicated APG pattern — BUILT against the ARIA textbox role
semantics). Verified against the APG Toolbar example
(`https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/examples/toolbar/`) on 2026-06-24.

**Roles + ARIA emitted by the template** (static structure, always server-rendered):

| element | role / attribute | value | source |
|---|---|---|---|
| outer wrapper `<div>` | `data-slot="rich-text-editor"` | — | styling + test hook |
| outer wrapper | `aria-disabled` | `"true"` when `disabled` | state |
| toolbar `<div>` | `role="toolbar"` | — | APG Toolbar |
| toolbar | `aria-label` | e.g. `"Text formatting"` (from the first group's label or a default) OR `aria-labelledby` if a visible toolbar heading exists | APG requirement: toolbar must have an accessible name |
| toolbar | `aria-controls` | the `id` of the editing region | APG Toolbar (`aria-controls` links toolbar to its controlled element) |
| toolbar | `aria-orientation` | `"horizontal"` (default; explicit per APG) | APG Toolbar |
| each toolbar TOGGLE `<button>` | `aria-pressed` | `"false"` (initial; enhancer flips it live) | ARIA toggle button |
| each toolbar TOGGLE `<button>` | `aria-label` | the item's `ariaLabel` | accessible name |
| each toolbar `<button>` | `tabindex` | `"0"` for the first enabled; `"-1"` for all others (initial state; enhancer manages roving) | APG roving tabindex |
| SEPARATOR `<div>` | `role="separator"` | — | APG |
| editing region `<div>` | `contenteditable` | `"true"` or `"false"` | editing |
| editing region | `role` | `"textbox"` | ARIA textbox |
| editing region | `aria-multiline` | `"true"` | ARIA textbox multi-line |
| editing region | `aria-labelledby` | `fieldId` → `labelId` | accessible name from external label |
| editing region | `aria-describedby` | `descriptionId` (when set) | optional description |
| editing region | `aria-required` | `"true"` when `required` | form semantics |
| editing region | `aria-readonly` | `"true"` when `readonly` | form semantics |
| editing region | `aria-invalid` | `"true"` when invalid | form semantics |
| editing region | `id` | a stable id (used by the toolbar's `aria-controls`) | cross-reference |
| character counter `<span>` | `role="status"` | — | live region, polite; announces count changes to screen readers |
| word counter `<span>` | `role="status"` | — | live region, polite |
| hidden `<input type="hidden">` | — | holds `htmlContent` for plain form submit | escape hatch |

**Keyboard interaction map** (the load-bearing table — verified against APG Toolbar 2026-06-24):

| key | context | does | who supplies it |
|---|---|---|---|
| Tab | anywhere on page | moves focus INTO the toolbar (to the last focused control, or the first enabled control if never visited) | platform + APG roving tabindex (`rich-text.enhancer.ts`) |
| Tab | focus is inside the toolbar | moves focus OUT of the toolbar (past all toolbar controls as a single tab stop) and INTO the editing region | platform + roving tabindex (Tab exits the single tab stop; the region is the next natural tab stop) |
| Tab | focus is inside the editing region | moves focus OUT of the editing region to the next focusable in page order | platform (`contenteditable` is a native focus stop) |
| Shift+Tab | focus is in the editing region | moves focus back into the toolbar (to the last focused control, per APG "returns to the last focused control") | platform + roving tabindex |
| Shift+Tab | focus is inside the toolbar | moves focus OUT of the toolbar (to the previous focusable in page order) | platform |
| Right Arrow | focus is inside the toolbar | moves focus to the NEXT enabled toolbar control (wraps from last to first) | `rich-text.enhancer.ts` (roving tabindex, per APG) |
| Left Arrow | focus is inside the toolbar | moves focus to the PREVIOUS enabled toolbar control (wraps from first to last) | `rich-text.enhancer.ts` (roving tabindex, per APG) |
| Home | focus is inside the toolbar | moves focus to the FIRST enabled toolbar control | `rich-text.enhancer.ts` (APG optional, implemented) |
| End | focus is inside the toolbar | moves focus to the LAST enabled toolbar control | `rich-text.enhancer.ts` (APG optional, implemented) |
| Enter / Space | focus is on a TOGGLE toolbar button | toggles `aria-pressed`; dispatches the formatting command into the editing region; does NOT move focus | platform (`<button>` activation) + enhancer (command dispatch + ARIA update) |
| Enter / Space | focus is on a BUTTON toolbar button | dispatches the action (e.g. clear-formatting, insert-link); does NOT move focus | platform + enhancer |
| any printable character, Backspace, Delete, Arrow keys | focus is inside the editing region | native editing (browser handles all text editing, caret movement, selection); the enhancer does NOT intercept plain editing keys | platform (contenteditable) |
| Ctrl+B / Cmd+B | focus is inside the editing region | apply/remove Bold formatting (same as clicking the Bold toolbar button) | `rich-text.enhancer.ts` (keyboard shortcut → command dispatch) |
| Ctrl+I / Cmd+I | focus is inside the editing region | apply/remove Italic | `rich-text.enhancer.ts` |
| Ctrl+U / Cmd+U | focus is inside the editing region | apply/remove Underline | `rich-text.enhancer.ts` |
| Ctrl+Z / Cmd+Z | focus is inside the editing region | undo (browser native undo stack inside the contenteditable) | platform (browser undo) |
| Ctrl+Shift+Z / Cmd+Shift+Z | focus is inside the editing region | redo | platform (browser redo) |
| Escape | focus is inside the editing region | (no action by the editor itself; Esc is not claimed; the page may use it for an enclosing dialog — the component does not intercept it) | — (intentionally not intercepted) |

**Focus management**:

- **Initial focus**: the toolbar is NOT auto-focused on mount. Focus enters the toolbar only when the user Tabs into it.
- **Roving tabindex** (APG Toolbar specification): at any moment exactly ONE toolbar control has `tabindex="0"` (the page's Tab sequence sees the toolbar as a single stop). All other controls have `tabindex="-1"`. When the user arrow-navigates inside the toolbar the enhancer moves `tabindex="0"` to the newly focused control. The initially-focused control (first visit) is the first enabled button in DOM order. On subsequent Tab-back the last focused control regains `tabindex="0"`.
- **Toolbar → editing region**: Tab from the toolbar exits the roving group and lands on the `contenteditable` region (the next natural tab stop in DOM order, immediately after the toolbar in the markup).
- **Editing region → toolbar**: Shift+Tab from the editing region returns to the last focused toolbar control (or the first enabled one if never visited); the roving tabindex state is preserved.
- **No focus trap**: the rich-text editor is NOT modal; focus can freely Tab out. If this component is inside a `dialog`, the dialog's `focus-trap.enhancer.ts` handles the trap — this component is transparent to it.
- **Command dispatch does not move focus**: when the user activates a toolbar button (Enter/Space or click), the formatting is applied to the editing region's current selection without moving focus away from the toolbar button. The user must Tab into the editing region to continue typing.
- **After a wire round-trip** (the `update` action): the runtime morph preserves focus and the caret position inside the editing region (the morph's identity-preserving algorithm handles this). The toolbar `aria-pressed` states are refreshed by the enhancer's `selectionchange` listener after the morph.

**Live regions**:

- The character counter `<span role="status">` is a polite live region. When `characterLimit > 0`, the enhancer updates its text content on each `input` event; the browser announces changes politely (not on every keystroke — the enhancer debounces the counter update to 500 ms to avoid screen-reader chatter).
- The word counter `<span role="status">` behaves identically when `wordCount=true`.
- There is no `role="alert"` on the limit-reached condition. When the limit is reached the counter is recoloured (CSS, visual) AND the enhancer announces once via the shared live-region announcer (`role="status"` with a one-shot text like "Character limit reached") so screen-reader users are informed without being interrupted mid-typing.
- No inline `aria-live` regions are used beyond these two counters: a rich-text editor is not a toast or a status widget.

**Shared mechanisms composed**:

- `rich-text.enhancer.ts` (NET-NEW, specific to this component): roving tabindex for the toolbar +
  `selectionchange` listener for updating `aria-pressed` states + command dispatch (formatting
  commands into the contenteditable) + keyboard shortcuts + character/word counting. This enhancer
  is NOT shared with other components (the roving toolbar pattern is shared conceptually but the
  command-dispatch side is editor-specific). The roving tabindex logic mirrors the APG pattern
  reference exactly.
- The **shared live-region announcer** (from the `collection-nav` family, already exists): used
  for the one-shot "Character limit reached" announcement and for screen-reader feedback on
  formatting actions when a user's AT does not automatically announce `aria-pressed` changes.
- NO focus-trap (the editor is non-modal).
- NO popover seam (no overlay).
- NO `collection-nav.enhancer.ts` (the toolbar roving is editor-specific command dispatch, not a
  list/menu pattern; using `collection-nav` would force a semantic mismatch).

## 5. Tokens

**Colour tokens consumed** (all OKLCH, per architecture contract §4):

| token | where used |
|---|---|
| `--lv-color-bg` | outer wrapper background |
| `--lv-color-border` | outer wrapper border, toolbar bottom border |
| `--lv-color-input` | editing region background |
| `--lv-color-fg` | editing region foreground text |
| `--lv-color-muted` | placeholder text, counter text at rest |
| `--lv-color-muted-fg` | secondary labels |
| `--lv-color-accent` | toolbar button hover background |
| `--lv-color-accent-fg` | toolbar button hover foreground |
| `--lv-color-primary` | active/pressed toolbar button background |
| `--lv-color-primary-fg` | active/pressed toolbar button foreground |
| `--lv-color-destructive` | counter text when limit reached, `aria-invalid` border |
| `--lv-color-destructive-fg` | destructive foreground |
| `--lv-ring` | focus-visible ring on all focusable controls within the editor |

**Structural tokens consumed**:

| token | where used |
|---|---|
| `--lv-space-1` | separator margin |
| `--lv-space-2` | toolbar button padding horizontal (sm) |
| `--lv-space-3` | toolbar button padding horizontal (md) |
| `--lv-space-4` | editing region padding |
| `--lv-space-6` | status bar padding horizontal |
| `--lv-space-8` | toolbar control height (sm size) |
| `--lv-space-9` | toolbar control height (md, default) |
| `--lv-space-48` | editing region default min-height |
| `--lv-radius-sm` | toolbar button border-radius |
| `--lv-radius-md` | outer wrapper border-radius |
| `--lv-text-xs` | counter / status bar text size |
| `--lv-text-sm` | toolbar button label (sr-only, or visible label if text-style) |
| `--lv-text-base` | editing region default font size |
| `--lv-font-sans` | toolbar + status bar font |
| `--lv-font-mono` | `<code>` / `<pre>` regions inside the editing area |
| `--lv-shadow-xs` | outer wrapper subtle shadow |

**NET-NEW tokens proposed** (justified, additive; go in `:root` + `.dark` blocks):

| token | value (light, OKLCH) | value (dark, OKLCH) | justification |
|---|---|---|---|
| `--lv-color-editor-prose-heading` | `oklch(0.25 0.01 250)` | `oklch(0.92 0.01 250)` | heading foreground inside the prose area (distinct from UI text, matches Tailwind-UI prose heading tone); avoids overloading `--lv-color-fg` which is the UI chrome token |
| `--lv-color-editor-prose-quote` | `oklch(0.55 0.01 250)` | `oklch(0.65 0.01 250)` | blockquote text and border (muted but distinctly editorial, not the same as `--lv-color-muted` which is for placeholders) |
| `--lv-color-editor-prose-code-bg` | `oklch(0.94 0.005 250)` | `oklch(0.22 0.01 250)` | inline `<code>` background inside the prose (code blocks need a distinct tinted surface; `--lv-color-input` is the right reading token for the region background, not for inline code chips) |
| `--lv-space-48` | `12rem` | (structural, theme-invariant) | default min-height of the editing region (12rem / ~192px); the space scale does not currently include this step; editing regions need a minimum usable height that is larger than any form-field token |

Note: `--lv-space-48` is the one genuinely-new structural token. If the token system already
resolves this step via a different name, use that and drop this proposal. All four are additive;
no existing token changes value.

## 6. Wire actions + enhancer integration

**Wire directives the template binds**:

| directive | on element | what it does |
|---|---|---|
| `l:change="triggerUpdate"` | the editing region `<div>` | fires on the `blur` event (or on explicit save-button click if `autoSave=false`) to collect the current innerHTML and POST it to the server |
| (no `l:model` on the region) | — | `l:model` is not used here: the value is not a simple form field but a rich HTML string; it is serialised and sent via a named action, not via the `l:model` mechanism |

**Server action signatures**:

```java
@LievitAction
public void update(String html) {
    // 1. sanitise html through the allowlist (same tag set as the toolbar commands can produce)
    // 2. validate: sanitised length ≤ characterLimit (when > 0)
    // 3. authz: the calling principal must own the record being edited
    // 4. mutate: this.htmlContent = sanitisedHtml
    // re-render is automatic (lievit re-renders on action return)
}

@LievitAction
public void triggerUpdate() {
    // Called by l:change; the enhancer stamps the current innerHTML on
    // data-pending-html="..." (SAFE — the attribute value is the raw HTML string, read by
    // the server action resolver from the wire request body, not from an html attribute);
    // the server resolver reads the wire request's submitted field, not the DOM attribute.
    // This is a thin adapter: the real work is in update(String html).
}
```

**Round-trip flow**:

1. User types in the editing region (client-only; no round-trip per keystroke).
2. User blurs the region (or clicks an explicit Save toolbar button) → the `blur` event fires →
   the enhancer serialises `editingRegion.innerHTML` into the wire request body →
   `l:change="triggerUpdate"` fires → POST to `/lievit/{id}/call` with `action=triggerUpdate` +
   the HTML body → server receives the raw HTML, passes to `update(html)` → sanitises → stores
   → re-renders the template with the cleaned `htmlContent` → returns `text/html` →
   the runtime morphs the region with the sanitised HTML.
3. If the sanitised HTML differs from what the user typed (e.g. a disallowed tag was stripped),
   the morph reflects the canonical version (the server always wins — "state has one owner").
4. The toolbar `aria-pressed` states are recomputed by the enhancer's `selectionchange` listener
   after the morph (a `MutationObserver` on the region triggers a re-poll of the
   `document.queryCommandState` equivalents for the new content).

**Enhancer responsibilities** (`rich-text.enhancer.ts`, registered as a lifecycle enhancer):

| responsibility | mechanism |
|---|---|
| Roving tabindex on the toolbar | on `keydown` inside `role="toolbar"`: Right/Left/Home/End → `tabindex` rotation + `.focus()` on the target control; initial state: first enabled control gets `tabindex="0"` |
| Toolbar `aria-pressed` state reflection | `document.addEventListener('selectionchange', ...)` → for each TOGGLE button query whether the command is active at the current caret (`document.queryCommandState(command)` or equivalent Selection API) → set `aria-pressed="true/false"` on the button |
| Formatting command dispatch | on toolbar button click/Enter/Space: derive the `data-command` from the button's dataset → dispatch the corresponding formatting operation into the editing region (bold: `document.execCommand('bold')` or equivalent; headings: wrap/unwrap the selected block in `<h1>`/`<h2>`/`<h3>`; lists: toggle `<ol>`/`<ul>`; blockquote: wrap/unwrap; link: prompt-free inline `<a href>` injection from a transient overlay — see §8 non-goal on a full link-picker dialog) |
| Keyboard shortcuts | `keydown` on the editing region: Ctrl/Cmd+B → bold; Ctrl/Cmd+I → italic; Ctrl/Cmd+U → underline → same dispatch path as toolbar buttons |
| Character / word counting | `input` event on the region → count characters (`.textContent.length`) and words (split on whitespace) → update counter `<span>` text; debounce at 500 ms for screen-reader polite announcement; block `input` events when at the character limit |
| innerHTML serialisation before wire | on `blur` (and on save button click): read `editingRegion.innerHTML` → attach to the wire request body as the `html` parameter for `triggerUpdate` → allow the `l:change` directive to fire |
| Post-morph re-attach | lifecycle `onComponentUpdate` hook: after the runtime morph replaces the DOM, re-attach all event listeners on the new editing region node (the morph may replace the node identity for the region if the server returned different content) |

**The enhancer registers via the directive/lifecycle registries** (ADR-0019: registry IS the API).
It does NOT patch the runtime core. It is mounted once per component instance on `onComponentInit`
and cleaned up on `onComponentDestroy`.

## 7. Acceptance tests (the gate — refute-by-default)

Every test runs on a REAL substrate. A mock that hides command-dispatch failures (the
client-island-fidelity lesson) is not acceptable.

**Render tests (real `LievitRuntime` + jsdom with real `rich-text.enhancer.ts` mounted)**:

| test name | what it asserts |
|---|---|
| `renders_toolbar_with_role_toolbar` | the toolbar `<div>` has `role="toolbar"`, `aria-orientation="horizontal"`, and `aria-controls` pointing to the editing region's `id` |
| `renders_toolbar_accessible_name` | the toolbar has either `aria-label` or `aria-labelledby` (not empty); accessing the element's accessible name yields a non-empty string |
| `renders_editing_region_with_textbox_role` | the contenteditable `<div>` has `role="textbox"`, `aria-multiline="true"`, `contenteditable="true"` |
| `renders_htmlContent_inside_region` | when `htmlContent="<p>Hello <strong>world</strong></p>"` the region's innerHTML contains that exact sanitised markup (the `$unsafe` channel is used because the server has already sanitised it) |
| `renders_placeholder_when_empty` | when `htmlContent` is blank the CSS `[contenteditable]:empty::before` pseudo renders the placeholder text (assert the CSS custom property is set; jsdom cannot render pseudo-elements, so assert the attribute hook `data-placeholder` is present for the CSS rule to target) |
| `renders_hidden_input_with_htmlContent` | a `<input type="hidden">` with `id=fieldId` and `value=htmlContent` is present (the plain-form-submit escape hatch) |
| `renders_character_counter_with_role_status` | when `characterLimit > 0` a `<span role="status">` is in the DOM with the current count |
| `renders_disabled_state` | when `disabled=true`: `contenteditable="false"` on the region, all `<button>` elements in the toolbar have `disabled` attribute, outer wrapper has `aria-disabled="true"` |
| `renders_readonly_state` | when `readonly=true`: `contenteditable="false"` on the region, `aria-readonly="true"` on the region, toolbar is absent from DOM |
| `renders_aria_invalid` | when `aria-invalid="true"` is set on the outer wrapper the destructive token class is applied |
| `toolbar_buttons_have_initial_roving_tabindex` | the first enabled toolbar button has `tabindex="0"`, all others have `tabindex="-1"` |
| `toggle_buttons_have_aria_pressed_false_initially` | all TOGGLE-type buttons render with `aria-pressed="false"` before any selection |
| `separator_items_render_role_separator` | a `SEPARATOR` ToolbarItem renders a `<div role="separator">` |
| `data_variant_and_slot_present` | `data-slot="rich-text-editor"` on the outer wrapper |

**axe-core assertions (zero violations)**:

| test name | APG / WCAG rules asserted |
|---|---|
| `axe_toolbar_region_no_violations` | `aria-required-attr` (toolbar has label), `aria-valid-attr-value`, `button-name` (each button has an accessible name via `aria-label`), `landmark-unique` |
| `axe_editing_region_no_violations` | `aria-allowed-role` (`textbox` on a `<div>` with `contenteditable`), `aria-required-attr` (`aria-multiline`, `aria-labelledby`/`aria-label`), `label` (region has an accessible name via `aria-labelledby`) |
| `axe_full_component_no_violations` | zero axe violations on the full rendered outer wrapper (includes toolbar + region + counter + hidden input) |
| `axe_disabled_state_no_violations` | zero violations when `disabled=true` (verifies `aria-disabled` is on the right element, not just `disabled` native) |

**Keyboard tests** (real `rich-text.enhancer.ts` + jsdom keyboard simulation):

| test name | key asserted | what it asserts |
|---|---|---|
| `right_arrow_moves_toolbar_focus_to_next_button` | Right Arrow (in toolbar) | the next enabled button receives `tabindex="0"` + `focus()` |
| `left_arrow_moves_toolbar_focus_to_previous_button` | Left Arrow (in toolbar) | the previous enabled button receives focus |
| `right_arrow_wraps_from_last_to_first` | Right Arrow on last button | focus wraps to the first enabled button |
| `left_arrow_wraps_from_first_to_last` | Left Arrow on first button | focus wraps to the last enabled button |
| `home_moves_focus_to_first_toolbar_button` | Home (in toolbar) | first enabled button receives focus |
| `end_moves_focus_to_last_toolbar_button` | End (in toolbar) | last enabled button receives focus |
| `tab_exits_toolbar_to_editing_region` | Tab (from toolbar) | focus moves to the editing region (the next natural tab stop) |
| `shift_tab_from_region_returns_to_toolbar` | Shift+Tab (in editing region) | focus returns to the toolbar's last focused control |
| `enter_on_toggle_button_dispatches_command` | Enter on Bold button (TOGGLE) | the enhancer dispatches the bold command; `aria-pressed` on the Bold button becomes `"true"` after dispatch |
| `space_on_toggle_button_dispatches_command` | Space on Bold button | same as Enter (native `<button>` Space activation) |
| `ctrl_b_in_region_dispatches_bold` | Ctrl+B (in editing region) | bold command dispatched; Bold toolbar button `aria-pressed` reflects the new state |
| `ctrl_i_in_region_dispatches_italic` | Ctrl+I | italic command dispatched |
| `ctrl_u_in_region_dispatches_underline` | Ctrl+U | underline command dispatched |
| `escape_in_region_is_not_intercepted` | Escape (in editing region) | the event propagates (not stopped); focus stays in the editing region; no unexpected behavior |
| `disabled_toolbar_buttons_not_keyboard_reachable` | Right Arrow skipping disabled | disabled buttons are skipped in the roving sequence; roving jumps to the next enabled control |

**Focus tests**:

| test name | what it asserts |
|---|---|
| `roving_tabindex_single_tab_stop` | at all times exactly ONE toolbar control has `tabindex="0"` and all others have `tabindex="-1"` |
| `roving_state_preserved_across_tab_cycle` | Tab out of toolbar then Shift+Tab back: the same control that was focused before Tab exit has `tabindex="0"` on re-entry |
| `command_dispatch_does_not_steal_focus` | activating a Bold button (Enter) keeps focus on the Bold button, not on the editing region |
| `no_focus_trap_in_non_modal_context` | Tab from the last toolbar button exits the component's subtree entirely (focus lands outside the wrapper) |

**Wire round-trip IT** (lievit-kit, real runtime, `CollapsibleComponentIT` pattern):

| test name | what it asserts |
|---|---|
| `blur_triggers_update_action` | mount → type some HTML into the region → blur → the wire `update` action is called → the server re-renders → the morph reflects the sanitised `htmlContent` in the region |
| `sanitisation_strips_disallowed_tags` | `htmlContent` sent with a `<script>` tag → server sanitises → re-rendered DOM does not contain `<script>` |
| `sanitisation_strips_disallowed_attributes` | `htmlContent` with `onclick="..."` attribute → server sanitises → re-rendered DOM does not contain `onclick` |
| `character_limit_rejection` | send HTML whose stripped text length exceeds `characterLimit` → the action returns an error → `aria-invalid="true"` is set on the region |
| `readonly_does_not_call_update` | when `readonly=true` the `update` action is never registered; a crafted POST to `update` is rejected (authz) |

**JTE compiles + renders**: covered by `test/jte-compile` real-compiler + render gate (the
`$unsafe` usage of `htmlContent` is the only non-default escaping; the gate exercises it with
both clean and sanitised-dirty values).

**Escaping tests**:

| test name | what it asserts |
|---|---|
| `htmlContent_unsafe_channel_requires_server_sanitisation` | a `htmlContent` value containing `<script>alert(1)</script>` renders inert in the DOM only AFTER the server has sanitised it; the test verifies the sanitiser in `update()` strips the script tag BEFORE `htmlContent` is stored and re-rendered |
| `toolbarItem_data_command_is_escaped` | a `ToolbarItem` with `command="bold\"><script>"` has its `data-command` attribute value HTML-escaped (via `Escape.htmlAttribute`), rendering inert |

**Playwright tests** (gesture fidelity, legacy-VM oracle):

| test name | what it asserts |
|---|---|
| `user_can_type_and_bold_text` | real `page.click` into region → type text → `page.keyboard.press('Control+B')` → assert the selection is wrapped in `<strong>` in the region's innerHTML; toolbar Bold button has `aria-pressed="true"` |
| `toolbar_keyboard_navigation_real_browser` | real `page.keyboard.press('Tab')` into toolbar → Right Arrow → Right Arrow → Enter on Italic button → region receives italic formatting; assert no accessibility violations via axe Playwright integration |
| `blur_save_round_trip` | type → blur → assert the region reflects the sanitised content from the server (not a fake morph) |

## 8. Non-goals / anti-patterns

- **NOT a ProseMirror / TipTap / Quill wrapper**. Those frameworks bring their own virtual DOM,
  plugin systems, and execution models that conflict with the lievit wire protocol, the CSP
  constraints (no eval, no inline script), and the bespoke morph. The command dispatch is
  original vanilla-TS. If a future adopter needs schema-validated collaborative editing, that
  is out of scope for lievit-ui and belongs in a bespoke workspace.
- **NOT a markdown editor**. The component stores and emits HTML, not Markdown. A Markdown
  preview panel is a separate component that composes a `<pre>` partial and a prose partial;
  it is not a variant of this component.
- **NOT a full document editor** (Google Docs / Notion style). The scope is a labelled form
  field for short-to-medium rich-text input (e.g. a product description, a note, a
  formatted email body). Collaborative editing, comment threads, version history, and inline
  images (beyond a URL-based `<img>` if added to the toolbar in the future) are out of scope.
- **No inline image upload**. Uploading images belongs to the `file-upload` component (S1,
  COVERED). If images are required in the editor a future extension adds an `image` command
  that triggers the `file-upload` wire component and inserts the returned URL; that is not
  shipped in this spec.
- **No link-picker dialog within this spec**. The `link` toolbar command inserts/edits a
  `<a href>` via a minimal transient URL-input popover (a small `<popover>` native element,
  CSP-clean) attached to the enhancer. A full link-picker with search is a future extension
  that composes the `combobox` component. The base spec ships only the URL-input popover.
- **No `l:model` binding**. The rich-text content is not a simple form field value; it is
  serialised HTML. The `l:model` directive (used for `<input>` / `<textarea>`) is deliberately
  NOT used here. The enhancer serialises + sends via the named `update` action on blur.
- **No client-side formatting UNDO stack managed by the server**. Browser undo (Ctrl+Z) within
  a single edit session is native to the `contenteditable`. The server holds only the
  last-saved canonical value; an undo that crosses a save boundary is not supported.
- **No gratuitous variants**. The component has no `variant` param (it is always the same
  neutral editing surface). The `size` param applies only to the toolbar control height, not to
  the editing region (that is sized by `minHeight`/`maxHeight`). No `ghost` or `outline` editor
  variant.
- **No `<script>` in the template**. The strict CSP (script-src self, no eval, no inline)
  prohibits it. All client behavior is in `rich-text.enhancer.ts`, registered via the
  lifecycle registry.
- **No Lit / Alpine / React**. The enhancer is vanilla-TS, CSP-clean, dependency-free. ADR-0012
  holds unconditionally.
- **Agent instructions**: generate ORIGINAL code over `--lv-*` tokens. You MAY read the APG
  Toolbar example, ProseMirror docs, and Tailwind UI prose styles as PATTERN references for
  the interaction model and the visual look. You MUST NOT paste literal source from any of them
  (the one bright line, `02-licensing.md`). Compose the shared live-region announcer; do NOT
  hand-roll a separate live region. Mirror `button.jte`'s house conventions exactly (header
  doc-comment with credits, typed `@param`, `data-slot`, the two escaping channels, zero
  `<script>`). The `htmlContent` value is the ONE place in the entire library where a `$unsafe`
  render is used; it is safe ONLY because the server sanitises BEFORE storing; never render
  raw user input with `$unsafe`. Minimal code to GREEN against the acceptance tests; the
  keyboard map is the contract — assert ALL of it.
