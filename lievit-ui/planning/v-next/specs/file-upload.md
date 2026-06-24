<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — file-upload (WIRE + ENH: drag-drop zone + file list)

- **tier**: WIRE + ENH (`file-upload.enhancer.ts`, the drag-drop + native-picker + progress reporting
  irreducible client behaviors)
- **build sequence**: S1
- **status (current)**: COVERED (verify shipped — re-forge of existing registry entry)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: **BUILT against raw WAI-ARIA APG** — APG does not publish a dedicated file-upload pattern;
      the file list is modelled on APG Listbox (multi-select, keyboard removal);
      the drop-zone is a live-region + interactive region following ARIA best-practices for
      drag-and-drop (ARIA `application` / `button` pattern + `aria-dropeffect` advisory);
      APG Listbox pattern: https://www.w3.org/WAI/ARIA/apg/patterns/listbox/
    - inventory: Ant Design Upload as inventory reference (dragger, file-list, progress,
      multi, accept, directory; image-only crop mode is NOT in scope — see §8)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

## 1. What it is

A file-upload control: a drag-and-drop drop-zone (or a plain "Choose files" button when drag is not the
primary affordance) + a file list showing each accepted file's name, size, upload progress, and a remove
action. The accepted-file set and each file's upload state are server facts (`@Wire List<UploadedFile>`),
so this is WIRE: the server decides which files are valid (name, type, size), tracks their upload state,
and the client morphs on every state change.

The three irreducible client behaviors — (a) intercepting the drag events and firing a wire action when
files are dropped, (b) opening the native OS file picker and forwarding the selected files, and (c)
streaming per-file upload progress back to the server — are owned by a typed-TS enhancer
(`file-upload.enhancer.ts`), CSP-clean, no framework. The enhancer fires wire actions and does nothing
more; the server remains the sole arbiter of the accepted-file list.

Server-first works here because the file list is server state (the Java side validates MIME, size, and
count), the progress is ephemeral client state that the enhancer keeps locally until completion
(the only concession to client-side truth), and the full list-render is always correct after a morph.

## 2. API — the WIRE surface + template params

**Java (`FileUploadComponent`)**:

| member | kind | meaning |
|---|---|---|
| `files` `List<UploadedFile>` | `@Wire` | the accepted-file list; each entry carries `id`, `name`, `size`, `mimeType`, `status` (PENDING \| UPLOADING \| DONE \| ERROR), `errorMessage` (nullable) |
| `accept` `String` | `@Wire @LievitProperty(locked=true)` | MIME-type/extension accept filter forwarded to the native picker and validated server-side (e.g. `"image/*,application/pdf"`) |
| `multiple` `boolean` | `@Wire @LievitProperty(locked=true)` | `true` allows more than one file; `false` replaces on each add |
| `maxFiles` `int` | `@Wire @LievitProperty(locked=true)` | maximum accepted count; 0 = unlimited; validated in `addFiles()` before mutation |
| `maxBytes` `long` | `@Wire @LievitProperty(locked=true)` | per-file max size in bytes; 0 = unlimited; validated in `addFiles()` |
| `disabled` `boolean` | `@Wire @LievitProperty(locked=true)` | disables the zone and the remove actions |
| `dragOver` `boolean` | `@Wire` | ephemeral drag-hover state; toggled by the enhancer via `setDragOver()`; renders the active drop-zone styling |
| `uploadUrl` `String` | `@Wire @LievitProperty(locked=true)` | the endpoint the enhancer POSTs files to (multipart); separate from the wire call URL |
| `addFiles(List<FileDescriptor> incoming)` | `@LievitAction` | validates count + MIME + size for each descriptor; appends accepted files to `files` with status PENDING; rejects with `aria-live` error for those that fail |
| `removeFile(String id)` | `@LievitAction` | removes the file with the given id from `files`; validates id ∈ files (authz: only the current session's files) |
| `setDragOver(boolean active)` | `@LievitAction` | sets `dragOver`; called by the enhancer on `dragenter` / `dragleave` / `dragend` |
| `fileUploadComplete(String id, String storagePath)` | `@LievitAction` | called by the enhancer when the XHR upload finishes; transitions `status` → DONE + stores `storagePath`; validates id ∈ files |
| `fileUploadError(String id, String message)` | `@LievitAction` | called by the enhancer when the XHR upload fails; transitions `status` → ERROR + sets `errorMessage` |
| `maxFilesReached()` | derived getter on `_instance` | true when `files.size() >= maxFiles && maxFiles > 0`; read by the template to disable the zone |

**`UploadedFile` record** (server-side, inside `FileUploadComponent`):
`String id` (server-generated UUID), `String name`, `long size`, `String mimeType`,
`UploadStatus status`, `@Nullable String errorMessage`, `@Nullable String storagePath`.

**`FileDescriptor` record** (serialised from the enhancer JSON payload):
`String name`, `long size`, `String mimeType`. No binary content — the binary is POSTed to `uploadUrl`
separately; `addFiles` only registers the metadata and returns ids for the enhancer to use when POSTing.

**Template params**: one `@param` per `@Wire` field (`files`, `accept`, `multiple`, `maxFiles`,
`maxBytes`, `disabled`, `dragOver`, `uploadUrl`) + `@param ComponentMetadata _component` +
`@param FileUploadComponent _instance` (for `maxFilesReached()`).
No `Content` slot (WIRE has none).

## 3. Variants / sizes / states

### Variants (zone presentation)
| variant | when to use | visual treatment |
|---|---|---|
| `default` | standard file input with zone + list below | dashed border drop-zone, click or drag to add |
| `button` | when a minimal inline "attach" affordance is needed (no large drop area) | single styled button that opens the native picker; drag still works if dropped onto it |
| `image-preview` | images only (`accept` contains `image/*`); shows thumbnail grid in the list | thumbnails at `--lv-space-20` (80px) beside name/size; replaces the file-name-list rows |

The variant is a `@Wire @LievitProperty(locked=true)` param (`String variant` default `"default"`).

### Sizes
`size` is NOT a primary param for file-upload (the zone is layout-driven, not height-based).
The "Choose files" button inside the zone uses the `button` partial with `size="md"` always.
The file-list rows are compact fixed-height (`--lv-space-10`, 40 px).

### States
| state | how it is reflected |
|---|---|
| `disabled` | zone gets `aria-disabled="true"` + `disabled:` utilities; remove buttons disabled; native input `disabled` |
| drag-over active (`dragOver=true`) | zone gets `data-drag-over="true"` → token highlight via CSS selector |
| `maxFilesReached()` = true | zone rendered with `aria-disabled="true"` + explanatory hint; add button hidden |
| file `status=UPLOADING` | progress bar visible on the row; remove button shows a cancel affordance |
| file `status=ERROR` | row gets `aria-invalid` styling, `errorMessage` shown inline; `aria-live` region announces |
| file `status=DONE` | checkmark icon; remove button still available |
| `aria-busy="true"` | set by the runtime during any wire round-trip (runtime-managed, component does nothing) |

## 4. The a11y contract (the heart — BUILT against raw APG)

**WAI-ARIA pattern**: BUILT — no single APG pattern covers file-upload end-to-end.
The implementation composes two well-specified sub-patterns:

1. **Drop-zone**: a real `<button>` (role `button`) is the keyboard-accessible entry point to the native
   file picker. The outer drop-zone `<div>` has `role="region"` + `aria-label="File drop zone"` and
   `aria-dropeffect="copy"` (advisory). When drag-active it announces via the live region.
2. **File list**: `role="listbox"` + `aria-multiselectable="false"` (each file is operated
   individually, not multi-selected for removal); each file row is `role="option"`. Keyboard removal
   follows the APG Listbox multi-select keyboard model adapted for single-action-per-item.

**APG source cited**: https://www.w3.org/WAI/ARIA/apg/patterns/listbox/

### Roles + ARIA emitted by the template

| element | role / ARIA | meaning |
|---|---|---|
| outer zone wrapper `<div>` | `role="region" aria-label="File upload" aria-dropeffect="copy"` | landmark scoping the whole widget |
| drop-zone inner surface `<div>` | `aria-disabled="${disabled \|\| maxFilesReached()}"` `data-drag-over="${dragOver}"` | visual drop target; not itself interactive (the button inside is) |
| "Choose files" `<button>` | native `<button>` — role button, keyboard for free; `aria-disabled` when zone disabled; `aria-label="Choose files"` | the keyboard entry point to the native picker |
| hidden `<input type="file">` | `aria-hidden="true"` `tabindex="-1"` `accept="..."` `multiple` | wired by the enhancer; kept in the DOM but hidden from the a11y tree (the button is the accessible surface) |
| file list `<ul>` | `role="listbox" aria-label="Uploaded files" aria-multiselectable="false"` | the accepted-file list; labelled independently |
| each file row `<li>` | `role="option" aria-selected="false" id="file-<id>"` | a file in the list; `aria-selected` stays false (no multi-select; the Remove button is the action) |
| file name `<span>` | `id="file-label-<id>"` | anchors the row's accessible label |
| status `<span>` | `aria-label="<status description>"` e.g. "Uploading 45%" / "Upload complete" / "Error: file too large" | machine-readable status alongside the visual progress bar |
| remove `<button>` | native `<button>` `aria-label="Remove <filename>"` | removes the file; accessible name includes the filename so each is distinguishable |
| progress bar `<div>` | `role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Upload progress for <filename>"` | present only when `status=UPLOADING`; hidden via `hidden` attr otherwise |
| live region `<div>` | `role="status" aria-live="polite" aria-atomic="false"` | announces additions ("2 files added"), completions ("Report.pdf uploaded"), errors ("photo.jpg: file too large") |
| error summary `<p>` (inside live region) | — | rendered by the template when `files` contains ERROR entries; text is the concatenated messages |

### Keyboard interaction map

| key | does | who |
|---|---|---|
| Tab | moves focus into the zone; cycles through: "Choose files" button → each Remove button in the file list | platform |
| Shift+Tab | reverse cycle | platform |
| Enter / Space | on "Choose files" button: opens the native OS file picker | platform (native button) |
| Enter / Space | on a Remove button: fires `removeFile(id)` wire action | platform (native button) |
| ArrowDown | while focus is on a Remove button inside the listbox: moves focus to the Remove button of the next file row | enhancer (`file-upload.enhancer.ts` — roving within the list) |
| ArrowUp | moves focus to the Remove button of the previous file row | enhancer |
| Home | moves focus to the Remove button of the first file row | enhancer |
| End | moves focus to the Remove button of the last file row | enhancer |
| Delete / Backspace | while focus is on any row's Remove button: fires `removeFile(id)` and moves focus to the next row (or previous if last) | enhancer |
| Escape | if the native file picker dialog is open, closes it | platform (OS picker) |

Note: the listbox itself does NOT implement arrow-roving for `aria-activedescendant` (that is the
`collection-nav` pattern for single-selection). Here each row's Remove button is a real focusable
element and the enhancer provides light arrow-key roving WITHIN the list for ergonomic keyboard
navigation. This is the simpler, correct model for a list of independent-action items.

### Focus management
- **Initial focus**: when files are added, focus remains on the "Choose files" button (the user's last
  action point). The live region announces the addition. Focus does NOT jump to the list.
- **After remove**: when a file is removed via keyboard (Delete/Backspace or Enter on Remove), focus
  moves to the next file row's Remove button, or to the previous if the removed item was last, or to
  the "Choose files" button if the list is now empty. The enhancer manages this transition.
- **No trap**: file-upload is not a modal. Tab can exit freely.
- **No `collection-nav` enhancer**: the file-list arrow roving is self-contained in
  `file-upload.enhancer.ts` (a small pattern, not the full listbox/menu roving that `collection-nav`
  serves). This keeps the dependency graph clean. If the list ever needs typeahead or `aria-activedescendant`
  selection, migrate to `collection-nav` then.

### Live region
The live region (`role="status" aria-live="polite"`) announces:
- On successful add: "N file(s) added." (atomic message set by the template after `addFiles` returns)
- On upload complete: `"<filename> uploaded successfully."`
- On upload error: `"<filename>: <errorMessage>."`
- On remove: `"<filename> removed."` (the message is set server-side so the morph includes it)

The live region is always in the DOM (empty when silent); it is NOT inserted dynamically (dynamic
insertion is unreliable in some screen readers).

### Shared mechanisms composed
- **No `focus-trap`**: the drop-zone is not a modal.
- **No `collection-nav`**: light roving only (see above).
- **No `popover seam`**: no overlay.
- The enhancer is standalone (`file-upload.enhancer.ts`), registered via the lievit directive/lifecycle
  registry (ADR-0019). It does NOT use any other shared enhancer.

## 5. Tokens

### Consumed tokens (all `--lv-*`, no literals)

| token | where used |
|---|---|
| `--lv-color-border` | drop-zone dashed border (default state) |
| `--lv-color-accent` | drop-zone border + background tint on drag-over |
| `--lv-color-accent-fg` | "Choose files" button text / icon color inside the zone |
| `--lv-color-primary` | progress bar fill |
| `--lv-color-primary-fg` | progress bar text (percentage label) |
| `--lv-color-destructive` | ERROR state row border + icon |
| `--lv-color-destructive-fg` | ERROR state error message text |
| `--lv-color-success` | DONE state checkmark icon |
| `--lv-color-success-fg` | (used if a background pill is ever added to DONE rows) |
| `--lv-color-muted` | file size / secondary text in file rows |
| `--lv-color-muted-fg` | placeholder / hint text inside the drop-zone |
| `--lv-color-popover` | file-list row background |
| `--lv-color-popover-fg` | file-list row primary text |
| `--lv-color-fg` | top-level text (zone label) |
| `--lv-space-2` | icon gap inside a file row |
| `--lv-space-3` | internal padding of file rows |
| `--lv-space-4` | zone internal padding (compact), gap between zone and list |
| `--lv-space-6` | zone internal padding (default/roomy) |
| `--lv-space-10` | file-list row height (40 px, compact fixed-height) |
| `--lv-space-20` | image-preview thumbnail size (80 px) |
| `--lv-radius-md` | file-list row corner radius |
| `--lv-radius-lg` | drop-zone corner radius |
| `--lv-ring` | focus-visible ring on "Choose files" button + Remove buttons |
| `--lv-shadow-xs` | subtle shadow on file-list rows |
| `--lv-text-sm` | file name / status label |
| `--lv-text-xs` | file size secondary text |
| `--lv-font-sans` | all text |
| `--lv-motion-duration-fast` | drag-over border/bg transition |

### NET-NEW tokens proposed

| token | value (OKLCH, light) | value (dark) | justification |
|---|---|---|---|
| `--lv-color-success` | `oklch(0.62 0.17 145)` | `oklch(0.72 0.17 145)` | DONE-state checkmark; distinct from `primary`; additive; goes in `:root` + `.dark` |
| `--lv-color-success-fg` | `oklch(0.98 0.01 145)` | `oklch(0.15 0.04 145)` | foreground over `--lv-color-success`; same additive rule |

If `--lv-color-success` + `--lv-color-success-fg` already exist in the v2 token set (check
`registry/tokens/lievit-tokens.css` before adding), use the existing names and skip this addition.

## 6. Wire / island integration

### Server-rendered JTE structure (`file-upload.jte`)

The template emits the following element tree (sketch — exact markup is the implementation's job):

```
<div data-slot="file-upload"
     data-variant="${variant}"
     data-lievit-component="..." data-lievit-id="..." data-lievit-snapshot="..."
     role="region" aria-label="File upload">

  <!-- Live region: always present, empty when silent -->
  <div role="status" aria-live="polite" aria-atomic="false"
       id="<cid>-live" data-slot="live-region"></div>

  <!-- Drop zone -->
  <div data-slot="drop-zone"
       aria-disabled="${disabled || _instance.maxFilesReached()}"
       data-drag-over="${dragOver}"
       class="[drop-zone classes using --lv-* tokens]">

    <!-- Hidden native input -->
    <input type="file"
           id="<cid>-input"
           aria-hidden="true"
           tabindex="-1"
           !{accept != null && !accept.isEmpty() ? "accept=\"" + accept + "\"" : ""}
           ${multiple ? "multiple" : ""}
           ${disabled || _instance.maxFilesReached() ? "disabled" : ""}
           data-lievit-file-input="true">

    <!-- Icon slot: cloud-upload icon (icon partial) -->
    @template.lievit.icon(name="cloud-upload", cssClass="...", ariaHidden=true)

    <!-- Zone prompt text -->
    <p data-slot="zone-prompt" class="[--lv-color-muted-fg text]">
      Drag files here or
      <button type="button"
              id="<cid>-trigger"
              data-lievit-file-trigger="true"
              aria-label="Choose files"
              ${disabled || _instance.maxFilesReached() ? "disabled" : ""}
              class="[inline-button classes]">
        choose files
      </button>
    </p>

    <!-- Accept hint -->
    !{var acceptHint = accept != null && !accept.isEmpty() ? accept : "any file type"}
    <p data-slot="accept-hint" class="[--lv-text-xs --lv-color-muted-fg]">
      Accepted: ${acceptHint}
      ${maxBytes > 0 ? " · max " + _instance.formatBytes(maxBytes) : ""}
      ${maxFiles > 0 ? " · up to " + maxFiles + " files" : ""}
    </p>
  </div>

  <!-- File list: only rendered when files is non-empty -->
  @if(!files.isEmpty())
  <ul role="listbox"
      aria-label="Uploaded files"
      aria-multiselectable="false"
      id="<cid>-list"
      data-slot="file-list">

    @for(UploadedFile f : files)
    <li role="option"
        aria-selected="false"
        id="file-${f.id()}"
        data-slot="file-row"
        data-status="${f.status().name().toLowerCase()}"
        class="[row classes]">

      <!-- File type icon -->
      @template.lievit.icon(name="[mime-derived icon]", ariaHidden=true, cssClass="...")

      <!-- Name + status region -->
      <div data-slot="file-info">
        <span id="file-label-${f.id()}" class="[--lv-text-sm font-medium]">${f.name()}</span>
        <span class="[--lv-text-xs --lv-color-muted-fg]">${_instance.formatBytes(f.size())}</span>

        <!-- Error message (ERROR status only) -->
        @if(f.status() == UploadStatus.ERROR)
        <span class="[--lv-color-destructive-fg --lv-text-xs]">${f.errorMessage()}</span>
        @endif
      </div>

      <!-- Progress bar (UPLOADING status only) -->
      @if(f.status() == UploadStatus.UPLOADING)
      <div role="progressbar"
           aria-valuenow="0"
           aria-valuemin="0"
           aria-valuemax="100"
           aria-label="Upload progress for ${f.name()}"
           data-lievit-progress-id="${f.id()}"
           data-slot="progress-bar"
           class="[progress bar classes]">
        <div data-slot="progress-fill" style="width: 0%"></div>
      </div>
      @endif

      <!-- Status label (all statuses) -->
      <span aria-label="${_instance.statusLabel(f)}" data-slot="status-label" class="[sr-only or icon]">
        @template.lievit.icon(name="${_instance.statusIconName(f)}", ariaHidden=true)
      </span>

      <!-- Remove / Cancel button -->
      <button type="button"
              aria-label="${f.status() == UploadStatus.UPLOADING ? "Cancel upload of " + f.name() : "Remove " + f.name()}"
              data-lievit-remove-id="${f.id()}"
              l:click="removeFile"
              !{attrs}
              class="[remove button classes]"
              ${disabled ? "disabled" : ""}>
        @template.lievit.icon(name="${f.status() == UploadStatus.UPLOADING ? "x-circle" : "trash-2"}", ariaHidden=true)
      </button>

    </li>
    @endfor
  </ul>
  @endif

</div>
```

Key conventions:
- `data-lievit-file-input="true"` and `data-lievit-file-trigger="true"` are the enhancer's mount anchors.
- `data-lievit-remove-id="<id>"` on the Remove button gives the enhancer the file id for focus management.
- `data-lievit-progress-id="<id>"` on the progress bar lets the enhancer update `aria-valuenow` and the
  fill width CLIENT-SIDE during upload (the only client-side DOM mutation the enhancer performs outside a
  wire round-trip).
- The Remove button uses the SAFE `l:click="removeFile"` directive; the file id is read from
  `data-lievit-remove-id` by the action dispatcher (the `wireArgs` channel), NOT passed as `attrs`.
- `!{attrs}` (trusted-raw) is ONLY for static author-provided attributes; per-row dynamic values MUST go
  through the `data-lievit-remove-id` channel.

### Typed-TS enhancer responsibilities (`file-upload.enhancer.ts`)

The enhancer is mounted by the lievit runtime lifecycle registry when the component root is present.
It owns three concerns and nothing else:

**A. Drag events → wire actions**
- Listens `dragenter` / `dragover` / `dragleave` / `drop` on the drop-zone element.
- On `dragenter` / `dragover`: calls `event.preventDefault()` (enables the drop) + fires
  `setDragOver(true)` wire action (debounced to avoid rapid re-renders).
- On `dragleave` / `dragend`: fires `setDragOver(false)`.
- On `drop`: collects `event.dataTransfer.files`, extracts `{name, size, mimeType}` descriptors,
  fires `addFiles(descriptors)` wire action. The server validates and returns the accepted file list.

**B. Native picker → wire actions**
- Listens `click` on `[data-lievit-file-trigger]` → programmatically clicks the hidden
  `[data-lievit-file-input]` (no opener attribute needed — the button and the input are co-located
  inside the component root; the click is NOT a user-gesture replay, it is a direct programmatic
  `.click()` which browsers allow when triggered by a real click handler).
- Listens `change` on `[data-lievit-file-input]` → collects `event.target.files`, extracts
  descriptors, fires `addFiles(descriptors)`. Resets the input's value so the same file can be
  re-added after a remove.

**C. Upload XHR + progress reporting**
- After each `addFiles` wire round-trip resolves (the morph has updated the DOM with the new file ids),
  the enhancer reads the current file ids from the rendered `[data-lievit-progress-id]` elements whose
  status is PENDING (i.e., the newly accepted files).
- For each PENDING file, it fires an XHR / `fetch` multipart POST to `uploadUrl` (obtained from a
  `data-upload-url` attribute on the component root, stamped by the template from `_component.uploadUrl`).
- During XHR progress: updates `[data-lievit-progress-id="${id}"]` → sets `aria-valuenow` + fill width.
  This is the ONLY client-side DOM mutation outside a wire round-trip, and it is ephemeral view state
  (progress percentage).
- On XHR success: fires `fileUploadComplete(id, storagePath)` wire action.
- On XHR failure: fires `fileUploadError(id, message)` wire action.

**D. Arrow-key roving within the file list**
- Listens `keydown` on the component root (event delegation).
- When focus is on a `[data-lievit-remove-id]` button:
  - ArrowDown / ArrowUp: move focus to the next / previous Remove button in the list.
  - Home / End: focus the first / last Remove button.
  - Delete / Backspace: read the button's `data-lievit-remove-id`, compute focus target (next or prev),
    fire `removeFile(id)` wire action, then restore focus after the morph.
- Focus restore after morph: the enhancer records the next/prev id before the wire call, then in the
  lifecycle's `onAfterMorph` hook it focuses `[data-lievit-remove-id="${nextId}"]` or the trigger
  button if the list is now empty.

**What the enhancer NEVER does**:
- Never renders a file row (only the server renders the list).
- Never validates MIME / size (server validates in `addFiles`).
- Never stores the authoritative file list (it reads it from the morphed DOM after each round-trip).
- Never mutates any attribute except `aria-valuenow` + `style.width` on the progress bar.

## 7. Acceptance tests

All tests run on a REAL substrate (the client-island-fidelity rule). No mocked `$lievit`.

### Render
- **zone-renders-idle**: drop-zone renders with `role="region"`, a visible `<button>` labelled "Choose files",
  the hidden `<input type="file">` with `aria-hidden="true"`; the file list is absent when `files` is empty.
- **zone-renders-with-files**: when `files` is non-empty, `<ul role="listbox">` is present; each file row
  has `role="option"`, the correct `aria-label` on the Remove button (`"Remove <filename>"`), and the
  file name is visible text.
- **zone-renders-uploading**: an UPLOADING file row has `role="progressbar"` with `aria-valuenow="0"`,
  visible; a DONE row has no `role="progressbar"`; an ERROR row shows the `errorMessage` text.
- **zone-disabled**: when `disabled=true`, the "Choose files" button is `disabled`, all Remove buttons
  are `disabled`, the zone has `aria-disabled="true"`.
- **zone-max-files-reached**: when `_instance.maxFilesReached()` is true, the zone has
  `aria-disabled="true"`, the "Choose files" button is `disabled`.
- **variant-button**: the `button` variant renders NO large drop-zone div, only the picker button;
  `data-variant="button"` is present on the root.
- **variant-image-preview**: the `image-preview` variant renders file rows with an `<img>` thumbnail
  element alongside the name; confirmed present in the DOM.
- **JTE compiles + renders**: covered by `test/jte-compile`.

### axe-core
- **axe-idle**: zero axe violations on the idle (no files) rendered DOM.
- **axe-with-files**: zero axe violations with three files in varying statuses (PENDING, UPLOADING, ERROR).
- **axe-accessible-name**: the "Choose files" button has an accessible name; each Remove button has an
  accessible name that includes the filename; the progressbar has an accessible name.
- **axe-live-region**: the live region `role="status"` is present; no violations.

### Keyboard (real LievitRuntime + real `file-upload.enhancer.ts` mounted in jsdom)
- **tab-reaches-trigger**: Tab from outside the component lands on the "Choose files" button first.
- **tab-reaches-remove-buttons**: Tab from the trigger reaches the first Remove button; subsequent Tabs
  cycle through the rest.
- **enter-on-trigger-fires-picker**: Enter on the "Choose files" button triggers a `click` on the hidden
  input (assert the input's `click` event fired — simulate the picker open).
- **arrowdown-within-list**: ArrowDown while focused on the first Remove button moves focus to the second
  Remove button (assert `document.activeElement` is `[data-lievit-remove-id="${secondId}"]`).
- **arrowup-within-list**: ArrowUp from the second Remove button returns focus to the first.
- **home-end-within-list**: Home moves to first, End moves to last Remove button.
- **delete-on-remove-button-fires-action**: Delete while focused on a Remove button fires the
  `removeFile` wire action (assert the action call).
- **focus-after-remove-middle**: removing the middle file (of three) moves focus to what was the third
  file's Remove button.
- **focus-after-remove-last**: removing the last file (of one) moves focus to the "Choose files" button.
- **keyboard-disabled-state**: when `disabled=true`, Enter on the "Choose files" button does NOT fire
  the picker; Remove buttons are not keyboard-reachable via Tab.

### Focus
- **live-region-announces-add**: after `addFiles` fires and the morph completes, the live-region text
  contains "file(s) added" (assert `[role="status"]` text content includes the count).
- **live-region-announces-error**: after `fileUploadError` fires, the live-region includes the filename
  and an error fragment.
- **live-region-announces-done**: after `fileUploadComplete`, the live-region includes the filename and
  "uploaded".

### Wire round-trip IT (lievit-kit, real runtime, `CollapsibleComponentIT` pattern)
- **add-files-round-trip**: mount component → fire `addFiles([{name:"report.pdf", size:1024, mimeType:"application/pdf"}])` →
  re-render asserts: `<ul role="listbox">` present, one `<li role="option">` whose text includes
  "report.pdf".
- **remove-file-round-trip**: add a file → get its id from the rendered DOM → fire `removeFile(id)` →
  re-render asserts: no `<li>` with that id remains.
- **drag-over-round-trip**: fire `setDragOver(true)` → re-render asserts `data-drag-over="true"` on the
  zone; fire `setDragOver(false)` → re-render asserts `data-drag-over="false"`.
- **upload-complete-round-trip**: add a file → fire `fileUploadComplete(id, "/storage/report.pdf")` →
  re-render asserts the row `data-status="done"`, no progressbar in the row.
- **upload-error-round-trip**: add a file → fire `fileUploadError(id, "File too large")` → re-render
  asserts row `data-status="error"`, error message text "File too large" visible.
- **max-files-validation**: add files up to `maxFiles` limit → fire `addFiles` with one more →
  re-render asserts: `files.size()` unchanged, live-region includes a rejection message.
- **mime-validation**: fire `addFiles([{name:"evil.exe", mimeType:"application/octet-stream"}])` when
  `accept="image/*"` → re-render asserts: no new file row added, live-region announces rejection.

### Playwright (gesture fidelity, legacy-VM oracle)
- **drag-drop-adds-file**: using Playwright's `page.dispatchEvent` to simulate a `drop` event with a
  `DataTransfer` containing a test file → assert the file row appears in the rendered DOM with the
  correct filename.
- **progress-bar-updates**: simulate an XHR progress event at 50% → assert the progressbar
  `aria-valuenow="50"` on the REAL substrate (not jsdom).
- **native-picker-removes-file**: click "Choose files" → (Playwright intercepts the file chooser via
  `page.waitForFileChooser()`) → provide a test file → assert the file row appears.
- **remove-via-button**: click the Remove button on a file row → assert the row disappears.

### Escaping (XSS abuse-case)
- **hostile-filename-renders-inert**: a `FileDescriptor` with `name = '"><script>alert(1)</script>'`
  rendered in a file row via the template must emit the name as escaped text, never as an HTML tag;
  assert the `<script>` tag is absent from the rendered HTML and the escaped string is present as text.
- **hostile-remove-id-renders-inert**: a file `id` containing `"` or `>` rendered in
  `data-lievit-remove-id` must be escaped via the `dataAttrs`/`wireArgs` channel; assert the rendered
  attribute value is inert.

## 8. Agent instructions

Generate ORIGINAL code over `--lv-*` tokens. You MAY read Ant Design Upload + React Aria
(conceptually — useDropzone-style APIs as pattern references) + Tailwind UI as references for PATTERN
and LOOK. You MUST NOT paste literal source from ANY of them (no ant-design / react-aria / Tailwind-UI
code or class strings) — the output is always original generation. (The one bright line, `02-licensing.md`.)

The `collection-nav` and `focus-trap` shared enhancers are NOT composed here — this component owns its
own lightweight list-roving in `file-upload.enhancer.ts`. Do NOT import or invoke `collection-nav` or
`focus-trap`; the file-list roving is too light to warrant the dependency.

Mirror `button.jte`'s house conventions exactly: header doc-comment, typed `@param`, `data-slot="file-upload"`,
`data-variant`, the two escaping channels. The WIRE template has NO `Content` slot (server-first
refactor blueprint §1.b). All file row content is OWNED template markup.

Validate file ids in `removeFile` and `fileUploadComplete`/`fileUploadError` actions: the id MUST be
present in `files` and the component MUST belong to the current session before mutating state. Log a
warning and no-op on unknown ids rather than throwing (the upload XHR can race a concurrent remove).

The progress bar width is the ONLY permitted client-side DOM mutation outside a wire round-trip.
Everything else — the file list, status icons, error messages — is server-rendered on the next morph.
A native-fetch XHR (`XMLHttpRequest`, not `fetch`) is preferred for the upload so that `onprogress`
events are available without streaming.

Minimal code to GREEN against the acceptance tests above. The keyboard map is the contract — assert ALL
of it, particularly Delete/Backspace focus-restore (that is the behaviour most likely to regress).

### Non-goals / anti-patterns

- **No client-side file-list rendering.** The accepted-file list is always server-rendered. The enhancer
  NEVER inserts or removes `<li>` elements; it only fires wire actions and awaits the morph.
- **No client-side MIME/size validation.** The server validates in `addFiles`. Client-side pre-flight is
  a UX convenience; if added in a future enhancement, it is advisory only — the server remains
  authoritative.
- **No image crop.** Ant Design Upload's crop mode is explicitly out of scope. Cropping is a different
  surface (compose a separate image-crop component if needed).
- **No chunked / resumable upload protocol.** The enhancer uses a single multipart POST per file.
  Resumable upload (e.g. TUS protocol) is a future enhancement, not a v-next scope item.
- **No Turbo Streams.** The state update after upload complete / error is a lievit wire round-trip
  (`fileUploadComplete` / `fileUploadError` actions → server re-render → morph), not a Turbo frame swap
  (ADR-0086, delivery boundary locked).
- **No Alpine.js / Lit / any framework.** The enhancer is typed-vanilla-TS, CSP-clean, no external runtime.
- **No directory upload** (`webkitdirectory`). Ant Design's directory mode is not in scope for S1.
  The `accept` filter covers the common case; directory traversal adds disproportionate complexity.
- **No drag-reorder of the file list.** Order is server-controlled. Reorder is in scope only for
  components that explicitly need it (builder, repeater).
- **No `paste` from clipboard.** Paste-to-upload is a future enhancement; the drop and picker paths cover
  the S1 use cases.
