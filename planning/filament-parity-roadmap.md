# lievit ecosystem -> Filament/Livewire parity roadmap

Status: PLAN (Francesco, 2026-06-20). Coordinated build, subagents execute, the integrator (a
session) verifies + merges. This is the to-be for the gaps Francesco identified while reviewing
gest's UI against Filament/Google Calendar. **The work is LIBRARY work** (generic, reusable, OSS):
lievit core / lievit-ui / lievit-kit fill their gaps; gest is the dogfood consumer. Nothing here is
a gest one-off.

## Locked decisions (Francesco, 2026-06-20)
- Detail view = **SlideOver in the calendar (right panel, Google-style in-context) + a dedicated
  URL-addressable detail page** (both).
- Theme = **light (HouseTree brand) with Google Calendar STRUCTURE/UX** (timegrid, chips, mini-month,
  detail panel). No dark mode this pass.
- People column = **first N avatars + "+K" overflow that opens the detail** (no long list in-cell).
- Execution = write this doc, then run the waves to staging, coordinating subagents.
- CI: `verify-gest.yaml` bumped to `machineType: E2_HIGHCPU_8` (the 1-vCPU default timed out at 2400s).

## What ALREADY exists (gap analysis 2026-06-20 - do NOT rebuild)
- **`@LievitUrl` (lievit-core)**: COMPLETE. Binds a `@Wire` field to the URL query string with
  PUSH/REPLACE history modes, aliasing, keepEmpty. This IS the URL-determinism Francesco wants -
  the calendar just has to USE it (a dogfood), it is not a build. (`dev.lievit.LievitUrl` +
  `component/UrlEffect.java`.)
- **Full pagination (lievit-ui `registry/jte/pagination.jte`)**: COMPLETE - First/Prev/1 2 3/Next/Last
  + ellipsis windowing, real `<a href>`, APG a11y. gest shows "Pagina 1 di 1" because it does NOT
  use it (a dogfood gap).
- **Actions (lievit-kit)**: row + bulk + groups + CRUD + FormAction COMPLETE. Gap = header/toolbar
  actions + URL-navigation actions only.
- **Infolist schema (lievit-kit `schema/infolist/Infolist.java`)**: COMPLETE (Text/Icon/Image/Color/
  Code/KeyValue/View/Repeatable entries, columns layout). Gap = no ViewPage to render it on.
- **Calendar wire (lievit-ui `registry/wire/calendar`)**: COMPLETE event grid (the one shipped in
  the server-first pivot). Gap = not abstracted as a kit widget (minor).
- **rich-select wire (lievit-ui)**: server-side debounced typeahead, single-select. Gap below.

## The real library gaps to build

### lievit-ui
- **L1 - rich-select -> full Combobox** (Filament `Select` parity): add
  (a) `multiple` mode with removable chips/tags, (b) `create-option` (add a value inline),
  (c) `preload` (eager option load for small sets vs the existing on-demand search for large sets),
  (d) rich option labels (leading avatar/icon + secondary subtext line). Keep the server-first model
  (debounced wire search, options server-owned). New registry:wire item or an extended rich-select;
  WAI-ARIA combobox + typed-TS keyboard nav, CSP-clean. Render-asserting `RichSelectComponentIT`
  extended (multiple, create, preload).

### lievit-kit
- **K1 - ViewPage / detail-view** (Filament `ViewRecord` parity, HIGHEST): an `AdminViewView`
  record (peer of `AdminListView`/`AdminFormView`) + a `ViewPageDriver` + a `view` slot in
  `ResourcePages`, rendering an `Infolist` (which already exists) over one record under
  `Operation.VIEW`, URL-addressable (`/{resource}/{id}`). Render-asserting IT.
- **K2 - SlideOver** (Filament slide-over parity): a kit-level `SlideOver` affordance built on the
  existing `drawer` wire, that slides in from the right and hosts arbitrary content - specifically an
  `Infolist` over a record (the calendar detail panel). Distinct from `ConfirmationModal`. IT.
- **K3 - URL-navigation + header actions** (Filament `Action::url()` + header actions): an action
  whose outcome is "navigate to a URL/page" (open a detail page, open the calendar on a date, an
  external link) + the ability to place actions in the table HEADER/toolbar (not only per-row/bulk).
  Extend `AdminAction`/`ActionPlacement`/`AdminActionResult`. IT.
- **K4 - AvatarStackColumn + TagsColumn overflow** (Filament stacked image column): a column that
  renders the first N items (avatars or names) then a "+K" overflow badge linking to the row's detail
  (or a tooltip). Add overflow/limit to `TagsColumn`; new `AvatarStackColumn` (or extend
  `ImageColumn` with a stacked/limited mode). Unit + render IT.
- **K5 - lazy/async Select form field** (Filament `BelongsToField` searchable + server-paged): make
  the kit `Select`/`BelongsToField` form field use the upgraded rich-select Combobox (L1) with
  server-side search (no all-options-every-render); preload for small sets, lazy search for large
  (persone/immobili). Depends on L1.

## gest dogfood (use the above + the already-existing features)
- **G-URL - calendar URL-determinism**: bind the calendar wire's `view`/`anchor`/audience+filter
  `@Wire` fields with `@LievitUrl` (PUSH for view/date, REPLACE for the debounced filters) AND add
  the date-in-path routes (`/attivita/calendario/day/2026/6/19`, `/week/2026/Wnn`, `/month/2026/6`)
  so the URL is copy-paste/reload/bookmark deterministic, Google-Calendar-style. Nav = links/wire
  that change the URL. Mini-month in the sidebar (click a day -> that day).
- **G-PAGE - activity detail page + calendar SlideOver**: dogfood K1 (ViewPage+Infolist) as the
  `/attivita/{id}` detail (the modern `gm.php?...id=` - tipologia/sottotipologia/stato/quando/titolo/
  luogo + Persone/Utenti/Immobili/Incarichi/Trattative sections + actions Modifica/Clona/Eseguito/
  Annullato) AND dogfood K2 (SlideOver) as the right-side detail panel when clicking a calendar event.
- **G-TABLE - activity table to Filament-grade**: use the existing full pagination (replace
  "Pagina 1 di 1"); dogfood K4 for the Persone column (N avatars + "+K" -> detail); dogfood K3 for
  per-row quick actions (open-in-calendar, open-detail) + the "Quando" date linking to the calendar
  day (`/day/Y/M/D`, Google-style).
- **G-SELECT - selectors to Filament-grade**: dogfood L1/K5 - assegnatari = preloaded multiple
  combobox; persone + immobili = lazy server-search multiple combobox (the legacy long checkbox lists
  in the create form become searchable comboboxes).

## Wave plan (subagents; the integrator verifies + merges each wave green before the next)
- **Wave A (lievit-ui)**: L1 Combobox. -> publish lievit (the gest dogfood pins it).
- **Wave B (lievit-kit, parallel where independent)**: K1 ViewPage · K2 SlideOver · K3 actions ·
  K4 columns · K5 lazy-Select (K5 after L1). -> publish lievit.
- **Wave C (gest dogfood, after publish)**: G-URL · G-PAGE · G-TABLE · G-SELECT (parallel by area).
- **Wave D (verify + E2E + push)**: full gest verify + Playwright E2E for the new surfaces (detail
  page real DOM, calendar URL round-trip, combobox search, pagination), merge to staging + push.

## Conventions (every wave honors)
- lievit-ui new components = registry:wire two-file copy-in (`<Name>Component.java` + `<name>.jte` +
  `meta.json`), WAI-ARIA, CSP-clean, render-asserting `lievit-kit` IT through the real runtime.
- lievit-kit new capabilities = the existing kit patterns (drivers/views/schema) + a render-asserting
  IT (`*ComponentIT` / page IT) - the silent-slot lesson: assert the rendered DOM, not structure.
- gest dogfood = server-first (partials/wire), strict CSP (no inline script), the gest gates
  (`-Dgroups=unit test`, `verify`, `check-directives`, the `_generated` regen). gest -> staging only.
- Pin discipline: bump the lievit JitPack pin in gest's pom + `LIEVIT_CLI_REF` together; JitPack
  builds on first resolve.
