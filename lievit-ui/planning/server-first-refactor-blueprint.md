# lievit-ui server-first refactor blueprint (ADR-0012)

STATUS: executable plan, written 2026-06-19 on branch `refactor/server-first-pivot`.
Authority: `docs/adr/0012-server-first-no-lit-partials-wire-htmx.md`.
Supersedes the TWO-TIER plan in `planning/lievit-ui-v2.md` (Lit islands are no longer a tier).

This is the coordination doc for the refactor.
It classifies all 46 Lit islands, maps the internal consumers that force ordering,
sequences the work into parallelizable waves, and plans the gest re-alignment.
It changes NO component code; it is the contract the wave-agents execute against.

The driving rule (from the ADR), applied to every island:
- pure display, no client state -> **PARTIAL** (JTE, zero JS, cannot fail silently).
- stateful interaction whose state/actions belong server-side in typed Java -> **WIRE**.
- simple server swap (load-more, filtered dropdown, tab-content, typeahead) -> **HTMX** pattern.
- genuinely client-heavy (would be too chatty server-side) -> **still server per ADR (no Lit shipped)**, note the UX trade + escape-hatch.
- obsolete / duplicate / not-a-component -> **DROP**.

---

## 1. Convention spec (the predictable structure)

### 1.a JTE partial component (the PARTIAL tier)

The existing 13 partials in `registry/jte/*.jte` are the target conventions; mirror them exactly.

- **File**: `registry/jte/<name>.jte`, kebab-case, no per-component subdir.
  Multi-file families nest one level: `registry/jte/table.jte` + `registry/jte/table/{header,row,cell,...}.jte`.
- **Header doc-comment** (mandatory, the house convention seen in `button-group.jte`, `icon.jte`, `pagination.jte`):
  Apache copyright block, then a `<%-- ... --%>` block with these labelled sections:
  - `lievit-ui <name> partial -- <one-line what>.`
  - `TIER:` why this is markup not an island.
  - `STRUCTURE (scientific decision rule):` cite the source mapped (shadcn / Radix / MUI / WAI-ARIA APG) and why it wins here.
  - `A11y (<model>):` roles, landmarks, live regions, keyboard behaviour deferred to the platform.
  - `Params:` one line per `@param` (type, default, meaning).
  - `Usage:` 1-2 `@template.<name>(...)` call examples.
- **`@param` shape**: typed JTE params with defaults.
  Content/children come in as `gg.jte.Content` slots (`content`, plus optional `leading` / `trailing` / `footer`), rendered with `${content}`; caller fills them with `@`...`` blocks.
  Booleans/enums documented as `"a" | "b"`.
  No data hardcoded inside the partial: option lists, labels, enums-as-strings arrive via `@param` from the controller's typed model.
- **Body**: plain HTML + Tailwind v4 utilities + `--lv-*` tokens.
  Local computed strings via `!{var ... }`.
  Composes other partials with `@template.<name>(...)` (e.g. every partial that needs a glyph calls `@template.icon(name=...)`).
  Zero `<script>`, zero inline `on*=` (the strict CSP refuses them; this is exactly the surface the silent slot bug taught us to keep server-pure).
- **`lievit add` resolution**: a `registry:jte` item in `registry.json` whose `files[].target` lands the `.jte` under the adopter's JTE root (the gest mirror is `apps/gest/src/main/jte/lievit/<name>.jte`, reached as `@template.lievit.<name>`).

### 1.b Wire component (the WIRE tier: Java class + JTE template + meta)

A wire component is the server-side, typed replacement for a stateful island.
Anatomy verified against the real examples
`examples/golden-path-starter/src/main/java/io/lievit/example/auth/RegisterComponent.java`
+ `.../resources/jte/auth/register.jte`, and the richer
`lievit-kit/src/test/java/io/lievit/kit/hello/ListingListComponent.java`
+ `lievit-kit/src/test/resources/jte/admin/listing-list.jte`.

**Three files per wire component:**

1. **Java class** `registry/wire/<name>/<Name>Component.java`
   ```java
   @LievitComponent(template = "<name>")          // JTE template name under jte/ root
   public class <Name>Component {
     @Wire public <T> field = ...;                // STATE: public @Wire field = one snapshot slot
     @Wire @LievitProperty(locked = true)         // server-owned, client cannot mutate (ids, prices, urls)
     public String redirectTo = "";
     @Wire @LievitProperty(serialize = false)     // server-derived each render, kept out of the snapshot
     View view;

     @LievitAction public void doThing() { ... }  // ACTION: callable from l:click/l:submit, 5s timeout
     @LievitRender void render() { ... }           // lifecycle: runs at mount + before each re-render
   }
   ```
   State lives in `@Wire public` fields (round-trip the signed snapshot).
   Actions are `@LievitAction` methods.
   Validation/authz happen in Java in the action, before the state mutates.

2. **JTE template** `registry/wire/<name>/<name>.jte`
   ```jte
   @import io.lievit.component.ComponentMetadata
   @param <T> field
   @param ComponentMetadata _component
   <div data-lievit-component="${_component.className()}">
     <input value="${field}" l:model="field">     <%-- two-way bind, deferred to next action --%>
     <button type="button" l:click="doThing">Go</button>
   </div>
   ```
   One `@param` per `@Wire` field (name matches exactly) + the always-present `@param ComponentMetadata _component` (and `@param <Type> _instance` when the template reads a non-serialized derived view off the live instance, as `listing-list.jte` does).
   `l:model` binds an input to a field (`.live` / `.lazy` / `.debounce.Xms` variants for the hot paths);
   `l:click` / `l:submit` / `l:keydown.enter` invoke actions;
   `$set('field', value)` mutates a field without a dedicated action (the confirm-arming pattern).
   The server re-renders the template to HTML; the client morphs (Idiomorph), preserving focus and scroll.

   **The body/"children" of a wire component is OWNED template markup, NOT a JTE `Content` slot (Wave 0 finding, verified).** `JteTemplateAdapter.render()` builds the model from ONLY the `@Wire` fields + `_component` + `_instance`; there is no way to pass a `gg.jte.Content` at wire-call time, so a `@param Content content` in a wire template fails to render. The server-first equivalent of children is therefore: put the body markup directly in the wire template's owned region (the adopter edits it, it is copy-in source), or drive it from a `@Wire` field / a getter on `_instance`. This is the correct mental model for every Wave 2 stateful component that "wraps" content (dialog body, drawer/sheet body, accordion panels): the content lives in the component's own template, server-rendered, never projected through a slot. Use boolean `@Wire` flags rendered as JTE boolean attributes (`hidden="${!open}"`), NOT the smart-attribute null-drop (`"${cond ? null : "x"}"`) which JTE rejects on a boolean attribute.

3. **`meta.json`** `registry/wire/<name>/meta.json`
   The copy-in manifest entry: `name`, `type: registry:wire`, the file list with `target` paths for BOTH the `.java` and the `.jte`, `registryDependencies` (tokens + any partials the template composes, e.g. `icon`), npm deps (none for wire), and post-copy `docs`.

   Convention extension (BUILT in Wave 0): the `registry:wire` item type carries two files (Java + JTE), each with a `root` discriminator (`"java"` / `"jte"`), resolved into the adopter's Java source root + JTE root. `lievit.json` declares `roots: { java, jte }` (defaults `src/main/java`, `src/main/jte`); a file with no `root` keeps the legacy single alias-root behaviour, so `registry:ui`/`registry:lib`/`registry:jte` are byte-for-byte unchanged. `build-registry.ts` walks a new `wire/` (and `jte/`) item dir; `add.ts` routes each file to its root. (See risk R5, now closed.)

### 1.c Copy-in layout + how `lievit add` resolves each

`registry.json` is the manifest; each item embeds its file `content` + a `target`.
`lievit add <name>` (CLI in `cli/add.ts` + `cli/lievit-add.ts`) resolves the name + its
`registryDependencies` transitively, joins the adopter's alias root (from `lievit.json`,
default `src`) with each file `target`, and copies (skip if exists, `--overwrite` to replace).

Per to-be tier:
- **PARTIAL** = one `registry:jte` item, one `.jte` file -> adopter JTE root.
- **WIRE** = one `registry:wire` item, two files (`.java` + `.jte`) -> Java source root + JTE root.
- **HTMX pattern** = no shipped component; documented as a recipe (a controller endpoint returning a partial + the `hx-*` attributes on the partial). The partial it swaps in is a normal `registry:jte` item.
- **escape-hatch island** = NOT in the default registry tiers; documented seam only. An adopter who needs one drops a Lit/vanilla module into their own `frontend/src/` (the existing gest island pattern). lievit-ui ships none.

BOTH layers are copy-in and owned: the adopter edits the partial's markup AND the wire component's Java/JTE.
The upgrade story collapses (versus the old plan): there is no central Lit/runtime dependency to bump for these; the wire *runtime* stays the dependency, the components are owned source.

---

## 2. Per-component classification (all 46 islands)

Test applied per ADR. "Internal consumers" = code inside this repo that renders the component
(kit Cell renderers, the 4 blocks, partials, examples). "gest?" = does housetree gest actually
ship/use it (template usage on `origin/staging`; counts are distinct-tag occurrences in `apps/gest/src/main/jte`).

| # | component | to-be form | rationale (1 line) | internal consumers | used by gest? | cx |
|---|---|---|---|---|---|---|
| 1 | accordion | WIRE | open-set state + arrow-key nav; panels are server content, state belongs in Java | none | no | M |
| 2 | alert | PARTIAL | variant-styled banner, role driven by variant; zero state | none | yes (as JTE pattern; gest's toast.ts reuses the box) | S |
| 3 | badge | PARTIAL | status pill, pure display | **kit `BadgeColumn` -> `Cell.Badge` -> `<lv-badge>`**; dashboard block | **yes, 27 uses** (shell, scadute, tabs, sidebar-lievit, person_timeline...) | S |
| 4 | breadcrumb | PARTIAL | nav trail of real `<a>`, CSS only | app-shell block (slot default) | yes, 3 (gest has own `_partials`; lievit block default) | S |
| 5 | button | PARTIAL | token button; the click is wired by the consuming wire template via `l:click`, not the button | none | yes, 5 (mfa-reset, calendar trigger) | S |
| 6 | calendar | **SERVER (escape-hatch)** | month grid + range select; chatty server-side. gest already runs the heavier `ht-calendar` escape-hatch | none | no (gest uses custom `ht-calendar`) | L |
| 7 | card | PARTIAL | container + optional header slot | none (gest composes its own) | yes, 3 (gest `_partials/card.jte` already a partial) | S |
| 8 | carousel | **DROP** | autoplay slider, no gestionale use, heavy-client with no server value | none | no | L |
| 9 | chart | **SERVER (escape-hatch)** | SVG data viz; render server-side from typed data into static SVG, or escape-hatch | dashboard block (x2) | no (only in lievit dashboard block, not gest pages) | L |
| 10 | checkbox | PARTIAL | native `<input type=checkbox>` styled by tokens; carries semantics itself, binds via `l:model` on the native element | none | **yes, 15** (calendar audience/filters popover) | S |
| 11 | collapsible | WIRE | single disclosure + keyboard; or HTMX for content-on-demand. WIRE when content is server state | none | no (gest uses `<details>`/`<summary>`) | M |
| 12 | command | WIRE (HTMX typeahead) | searchable palette; server typeahead via HTMX swap, selection state in wire | none | no | M |
| 13 | context-menu | WIRE | right-click menu + submenus; positioning + state server-driven via popover seam | none | no | M |
| 14 | data-table | **SERVER (kit + HTMX)** | sort/paginate server-side (the kit `ListPageDriver` already does this); no client grid | kit list rendering | no (gest uses kit table + JTE) | L |
| 15 | date-picker | **SERVER (escape-hatch)** | calendar panel + input; native `<input type=date>` PARTIAL covers most, escape-hatch for rich range | none | no | L |
| 16 | dialog | WIRE | modal open-state + focus trap; open-state and body are server-driven (gest profile/mfa do this) | alert-dialog partial renders `<lv-dialog>` | **yes, 7** (profile TOTP reset, mfa) | M |
| 17 | drawer | WIRE | side panel, dialog variant; open-state server-driven | gest `activity-drawer` wraps `<lv-drawer>` | yes (via custom activity-drawer island today) | M |
| 18 | dropdown-menu | WIRE (HTMX) | trigger + menu of server actions; gest deliberately uses `<details>`/`<summary>` JS-off instead | app-shell block | **yes, 5** but gest avoids the island (details/summary) | M |
| 19 | field | PARTIAL | label + control + error wrapper, composition only | none | yes (gest composes own field markup) | S |
| 20 | file-upload | WIRE | drag-drop + file list; lievit wire has `l:` uploads feature (runtime `features/uploads.ts`) | none | no | M |
| 21 | hover-card | PARTIAL | hover preview, content already in DOM; CSS/`:hover` + `popover` attr, no state | none | no | S |
| 22 | input | PARTIAL | native `<input>` styled by tokens; binds via `l:model`. The island was never form-associated (gest's bug note) | none | **yes, 6** (mfa-reset, gest notes islands are not form-associated) | S |
| 23 | input-otp | WIRE | segmented OTP, auto-advance + paste; native inputs + small wire/vanilla enhancement | none | no | M |
| 24 | label | PARTIAL | native `<label>` + optional required marker | none | yes (gest uses native) | S |
| 25 | light-dom | **DROP** | Lit base helper (`adoptLightStyles`); meaningless without Lit islands | **every island imports it** | no (vendored, removed with islands) | S |
| 26 | menubar | **DROP** | desktop app File/Edit menubar; no gestionale use | none | no | M |
| 27 | navigation-menu | WIRE (PARTIAL) | site nav with rich panels; mostly nav links (PARTIAL) + optional wire for active state | none | no | M |
| 28 | popover | WIRE (vanilla) | anchored floating panel; native `popover` attr + Anchor Positioning is the server-pure path, content server-rendered | calendar.jte audience filter | **yes, 2** (calendar audience/filters) | M |
| 29 | progress | PARTIAL | `<progress>` / token bar with ARIA; pure display | none | no | S |
| 30 | radio-group | PARTIAL | native radios + roving handled by the platform; binds via `l:model` | none | no | S |
| 31 | resizable | **DROP** | drag-resize panes; no gestionale use, heavy-client | none | no | M |
| 32 | rich-select | WIRE (HTMX) | searchable select; server-filtered options via HTMX, selection in wire/native | none | no (imported but unused in templates) | M |
| 33 | scroll-area | **DROP** | custom scrollbar overlay; native scroll is fine, pointer-only client value | none | no | M |
| 34 | select | PARTIAL | `native-select.jte` already exists and is what gest uses; the island is redundant | none | yes, 1 + gest uses `@template.lievit.native-select` | S |
| 35 | separator | PARTIAL | `<hr role=separator>`, pure CSS | none | **yes, 11** (calendar filter sections) | S |
| 36 | sheet | WIRE | modal side panel, drawer variant with header/footer; open-state server-driven | none | no | M |
| 37 | sidebar | WIRE (PARTIAL) | app nav + collapse + persistence; nav is PARTIAL, collapse is tiny vanilla/wire state | app-shell block | no (gest `_partials/shell.jte` already server-rendered) | L |
| 38 | slider | PARTIAL | native `<input type=range>` carries the semantics; binds via `l:model` | none | no | S |
| 39 | spinner | PARTIAL | CSS animation + `role=status` | none | yes (gest `_base/skeleton.ts` pattern) | S |
| 40 | switch | PARTIAL | native checkbox styled as switch; binds via `l:model` | none | no | S |
| 41 | tabs | WIRE (HTMX) | tab bar + panels; active tab is server state, content via HTMX swap or wire re-render | none | yes (gest activity tabs are server-rendered partials already) | M |
| 42 | textarea | PARTIAL | native `<textarea>` token-styled; binds via `l:model` | none | yes (imported; native) | S |
| 43 | toast | WIRE (vanilla) | transient notify + auto-dismiss; gest's `_base/toast.ts` is the kept vanilla module (PRG flash -> toast) | none | yes (gest custom `toast.ts`, keep as the vanilla seam) | M |
| 44 | toggle | PARTIAL | two-state button `aria-pressed`; tiny state, native + `l:click` or vanilla | none | yes (gest visibility/_partials/toggle.jte already a partial) | S |
| 45 | toggle-group | PARTIAL/WIRE | radio-like group; native radios PARTIAL, or wire if pressed-set is server state | none | no | M |
| 46 | tooltip | PARTIAL | hover label; native `title` / CSS + `popover`, decorative, aria-hidden | none | yes (imported; mostly native) | S |

### Classification summary (counts)

- **PARTIAL: 22** -> alert, badge, breadcrumb, button, card, checkbox, field, hover-card, input, label, progress, radio-group, select, separator, slider, spinner, switch, textarea, toggle, tooltip, (plus the native covers for select/slider/switch already counted). Two more (navigation-menu, sidebar, toggle-group) split PARTIAL-leaning, counted under their primary below.
- **WIRE: 14** -> accordion, collapsible, command, context-menu, dialog, drawer, file-upload, input-otp, navigation-menu, rich-select, sheet, sidebar, tabs, toggle-group, toast (several also expose an HTMX pattern; see column).
- **HTMX pattern (primary or co-equal): 5** -> command (typeahead), dropdown-menu, rich-select, tabs (content swap), data-table (server sort/paginate). These are WIRE-or-HTMX; HTMX is the lighter recipe, wire the richer stateful version.
- **SERVER, no-Lit, escape-hatch flagged: 4** -> calendar, chart, data-table, date-picker (data-table also counts in HTMX; it is the server-render + HTMX-swap path, escape-hatch only if a true client grid is ever needed).
- **DROP: 6** -> carousel, light-dom, menubar, resizable, scroll-area, (and the Lit base). Net DROP of standalone deliverables: carousel, menubar, resizable, scroll-area, light-dom = 5 components + light-dom helper.

Rounded headline: **~22 PARTIAL / ~14 WIRE / ~5 HTMX-pattern / 4 SERVER-heavy(escape-hatch) / 6 DROP**
(several components legitimately carry two labels: a native-element PARTIAL that binds via `l:model`, or a WIRE that also documents an HTMX recipe; the table column is authoritative per component).

---

## 3. Interconnection-driven sequencing (the wave DAG)

The edges that force order (from the consumer map):

- `icon` (partial, already exists) is composed by avatar, empty, alert-dialog, input-group, and every block -> it is the root; it already exists, so it is a no-op dependency, but nothing may regress it.
- `badge` is rendered by **kit `BadgeColumn.cellFor` (lievit-kit/src/main/java/io/lievit/kit/BadgeColumn.java:74) -> `Cell.Badge` -> the list template emits `<lv-badge>`** and by the dashboard block. So **badge must exist as a partial BEFORE the kit's cell rendering switches from `<lv-badge>` to the partial markup**.
- `icon` is likewise rendered by **kit `IconColumn.cellFor` (lievit-kit/.../IconColumn.java:104) -> `Cell.Icon` -> `<lv-icon>`**. The icon partial exists; the kit must switch its `Cell.Icon` rendering from `<lv-icon>` to `@template.icon` / inline svg.
- The 4 blocks (`app-shell`, `dashboard`, `login`, `signup`) compose partials + islands (sidebar, dropdown-menu, badge, chart). Blocks update AFTER the components they render exist as partials/wire.
- `alert-dialog.jte` renders `<lv-dialog>` -> updates after dialog becomes wire.
- `registry.json` is regenerated from the registry tree on any add/remove -> **single-owner file, regenerated once per wave at the wave's end**, never hand-edited in parallel (collision hazard).

**Shared-file hazards (call out before fan-out):**
- `registry/registry.json` (regen, one writer per wave).
- `lievit-kit` Cell rendering (`BadgeColumn`, `IconColumn`, the list template) - one agent owns the kit switch, gated behind badge+icon partials.
- The 4 blocks in `registry/jte/blocks/` - one agent owns blocks, last.
- `registry/components/light-dom/` deletion - happens only after ALL islands are gone (every island imports it).
- The wire runtime under `lievit-ui/runtime/` is the kept dependency; it is NOT touched by component waves.

### The waves

**Wave 0 - mechanism (serial, blocking, one agent).**
Introduce the `registry:wire` item type in `registry.json` + `cli/add.ts` (two-file copy-in: Java + JTE), with a unit test, and scaffold `registry/wire/`.
Establish the wire-component template skeleton + the partial doc-header lint.
No component conversions yet. Everything downstream depends on this.

**Wave 1 - leaf PARTIALS (max parallelism, ~one agent per cluster).**
All pure-display / native-element partials with NO internal consumers. Independent, no collisions except the shared registry.json regen at the end.
Cluster A (status/display): alert, badge, card, separator, progress, spinner, hover-card, tooltip.
Cluster B (native form controls -> partials that bind via `l:model`): input, textarea, label, field, checkbox, radio-group, switch, slider, select (fold into existing `native-select`), toggle.
Cluster C (nav/structure): breadcrumb.
Note: badge ships here but the kit's `Cell.Badge` switch is Wave 4 (badge partial must merely EXIST first).

**Wave 2 - WIRE conversions, leaf (parallel, one agent per component).**
Stateful components with no internal consumers, converted to wire (Java + JTE + meta), each with a wire unit test + a render-asserting slice.
accordion, collapsible, dialog, drawer, sheet, tabs, file-upload, input-otp, toggle-group, command, context-menu, navigation-menu, rich-select.
Hazard: dialog blocks `alert-dialog.jte` (Wave 3) and gest's profile/mfa wire (gest phase).

**Wave 3 - composed PARTIALS + the overlay/popover seam (parallel after 1-2).**
alert-dialog (now composes the dialog wire), the popover seam (native `popover` attr + Anchor Positioning, documented as the server-pure overlay used by dropdown-menu/context-menu/command/calendar-filter), toast (kept as the vanilla module seam), sidebar (nav partial + tiny collapse state).
Depends on dialog (Wave 2) and the partials in Wave 1.

**Wave 4 - kit Cell rendering + the 4 blocks + DROPs (serial-ish, two agents).**
Agent X (kit): switch `BadgeColumn`/`IconColumn` cell rendering from `<lv-badge>`/`<lv-icon>` to the partial markup; update the kit's list template; gate behind badge+icon partials existing.
Agent Y (blocks): rewrite app-shell, dashboard, login, signup to compose partials/wire instead of `<lv-sidebar>`/`<lv-dropdown-menu>`/`<lv-badge>`/`<lv-chart>` islands.
Then DROP: delete carousel, menubar, resizable, scroll-area, and finally `light-dom` (only once no island imports it).
SERVER-heavy (calendar, chart, date-picker, data-table): document the server-render path + escape-hatch seam; ship the static/partial form (e.g. native `<input type=date>`, server-rendered SVG chart, kit server-sorted table); do NOT ship a Lit island.
Regenerate `registry.json` once, review the diff.

DAG (top = first):
```
Wave 0 (registry:wire mechanism)
        |
   +----+--------------------+
   |                         |
Wave 1 PARTIALS (leaf)   Wave 2 WIRE (leaf)
   |  \                    /  |
   |   \                  /   |
   |    Wave 3 (alert-dialog, popover seam, sidebar, toast)
   |                         |
   +-----------+-------------+
               |
   Wave 4 (kit Cell switch  ||  blocks rewrite  ;  then DROPs ; then registry.json regen)
```

---

## 4. gest re-alignment plan

gest already consumes lievit mostly the right way: the JTE partials are vendored at
`apps/gest/src/main/jte/lievit/*` and used via `@template.lievit.<name>` (icon, avatar,
native-select, table family, pagination, button-group, item, kbd, skeleton, empty, the 4 blocks).
The ISLANDS gest actually ships are a SMALL set (14 imports in `apps/gest/frontend/src/main.ts`),
and the templates use a still-smaller set of `<lv-*>` tags. So the re-alignment is bounded.

The island tags gest's pages actually render (distinct-tag counts on `origin/staging`):
`<lv-badge>` 27, `<lv-checkbox>` 15, `<lv-separator>` 11, `<lv-dialog>` 7, `<lv-input>` 6,
`<lv-dropdown-menu>` 5, `<lv-button>` 5, `<lv-popover>` 2, `<lv-select>` 1, `<lv-copy-button>` 1
(custom). Plus the custom islands `ht-calendar`, `activity-drawer`, `property-map`,
`property-gallery`, `docs-search`. (`<lv-chart>`/`<lv-sidebar>`/`<lv-breadcrumb>`/`<lv-card>`
appear only in the vendored lievit BLOCK templates and gest comments, not gest's own pages -
gest already server-renders its shell and cards.)

**Phase G1 - sync the partial tier (low risk).**
Re-vendor the updated `apps/gest/src/main/jte/lievit/*` partials (badge, alert, separator, button, input, checkbox, select->native-select, card, etc.) once Wave 1 lands. Mostly already partials; this is a refresh, not a rewrite.

**Phase G2 - replace the display islands with partials.**
Swap `<lv-badge>` (27), `<lv-separator>` (11) for `@template.lievit.badge` / `.separator`. Pure display, zero behaviour, no wire needed. Remove the badge/separator/alert/tooltip island imports from `main.ts`.

**Phase G3 - replace the form-control islands with native partials bound via `l:model` (or plain native + POST).**
`<lv-input>` (6), `<lv-checkbox>` (15), `<lv-select>` (1), `<lv-button>` (5), textarea -> native partials. gest's own note already records the islands were NOT form-associated (the FormData bug), so native elements are a strict improvement. The calendar audience/filters popover (15 checkboxes driving `calendar-filters.ts` via `lv-change`) becomes native checkboxes whose `change` events the kept vanilla module listens to. Remove input/checkbox/textarea/select/rich-select/button island imports.

**Phase G4 - convert the stateful islands to wire.**
`<lv-dialog>` (7: profile TOTP reset, mfa-reset) -> dialog wire component (gest already drives these with `l:click` in `mfa-reset-lievit.jte`, so they are half-wire already). `<lv-popover>` (2, calendar filter) -> the popover seam (native `popover` + server-rendered content). `<lv-dropdown-menu>` (5) -> gest already uses `<details>`/`<summary>` JS-off in `shell.jte`; finish removing the island. Remove dialog/drawer/dropdown-menu/popover island imports; convert `activity-drawer` to use the drawer wire or keep it as a documented escape-hatch island (human call, see R1).

**Phase G5 - remove the vendored Lit island tree + bundle registrations.**
Delete `apps/gest/frontend/src/lievit-ui/<island>/*` for every dropped/replaced island (keep `icons/`, `lievit-tokens.css`, and the `lievit/` wire runtime). Remove the corresponding `import './lievit-ui/.../*.ts'` lines from `main.ts`. Keep the custom escape-hatch islands that survive the human call (ht-calendar; activity-drawer / property-* / docs-search per R1).

**Phase G6 - VISUAL / E2E verification (the gap that shipped the slot bug).**
This phase is mandatory and is the lesson encoded. For every replaced surface add a Playwright E2E (`apps/gest/e2e/tests/*.spec.ts`) that asserts the REAL rendered DOM/text, not template structure: the badge text is visible, the dialog body content is projected and visible, the calendar filter checkboxes toggle the feed, the login page renders with JS off. Run against a real server render. No island removal merges until its surface has a render-asserting E2E green. (gest contract: E2E = happy-path Playwright, `*Test`/`*IT` for edges.)

Phase count: **6** (G1 partial sync, G2 display, G3 form controls, G4 stateful->wire, G5 remove tree+registrations, G6 visual/E2E verification).

---

## 5. Risks + escape-hatches (human-call flags)

**R1 - the calendar (`ht-calendar`) [FLAG FOR FRANCESCO].**
gest's `ht-calendar` wraps `@event-calendar/core` (Svelte 5, CSP-clean) with drag-create, drag-resize, range fetch, error overlay. This is the canonical genuinely-heavy widget. Server-rendering a drag-resize month grid is the real UX loss the ADR accepts. **Recommendation: keep `ht-calendar` as the documented escape-hatch client island** (it already follows the data-down/events-up + islandFetch pattern, state-owner-is-server). The ADR explicitly allows one escape-hatch island; the calendar is it. lievit-ui still ships NO calendar island. **Human call: confirm ht-calendar stays as the sanctioned escape-hatch and is exempted from the island purge.**

**R2 - other custom gest islands [FLAG].**
`activity-drawer`, `property-map` (Leaflet), `property-gallery` (PhotoSwipe), `docs-search` (MiniSearch) are bespoke client islands, not lievit-ui components. Map (Leaflet) and gallery (PhotoSwipe) are genuinely-heavy third-party widgets -> escape-hatch, keep. `activity-drawer` could become a drawer wire component but currently wraps `<lv-drawer>`; if drawer goes wire, activity-drawer either rewires or stays an escape-hatch. **Human call per island: keep-as-escape-hatch vs convert.** Default recommendation: keep map/gallery/docs-search (heavy third-party), convert activity-drawer to the drawer wire.

**R3 - chart server-render feasibility.**
`<lv-chart>` only lives in the lievit dashboard block, not gest pages, so there is no gest blocker. For the library: ship a server-rendered static SVG chart partial (data in via typed `@param`); flag a client charting island as escape-hatch only if interactive charts are ever needed. Low risk because unused downstream today.

**R4 - the popover/overlay seam is load-bearing.**
dropdown-menu, context-menu, command, calendar-filter all need anchored floating UI. The server-pure path is the native `popover` attribute + CSS Anchor Positioning (no `@floating-ui/dom`, no Lit). This is a thinner-training area; build and visually verify ONE popover seam in Wave 3 before the dependents rely on it. If Anchor Positioning support is insufficient, the fallback is a tiny typed-vanilla positioning module (CSP-clean), NOT Alpine.

**R5 - the `registry:wire` two-file copy-in is new mechanism [CLOSED in Wave 0].**
Built + tested: the `registry:wire` item type copies a `.java` AND a `.jte` into two adopter roots via a per-file `root` discriminator (`java`/`jte`), defaulting to `src/main/{java,jte}`, with `lievit.json.roots` overrides; legacy single-root items are unchanged. Golden tests (`test/wire-collapsible.test.ts`) cover resolution + the two-root copy + byte-identity + back-compat. Exercised end to end by the first wire component (collapsible) through the REAL runtime in `lievit-kit` `CollapsibleComponentIT` (mount -> toggle -> re-render, render-asserting). Wave 2 may fan out. Findings folded into convention 1.b: (a) the body is owned template markup, not a `Content` slot; (b) boolean state renders as a JTE boolean attribute, not the smart-attribute null-drop.

**R6 - silent-render regression (the original bug class).**
The whole pivot exists because client render failed silently and tests asserted structure not projection. Mitigation is mandatory and encoded in G6 and in every wave's exit gate: PARTIALs and WIRE templates get render-asserting tests (the rendered HTML/text is asserted, and the gest surfaces get Playwright). A wave is not done until its components have a test that would have caught a non-projected slot.

**R7 - `light-dom` deletion ordering.**
Every island imports `adoptLightStyles`. Deleting `light-dom` before the last island is gone breaks the build. It is the final DROP in Wave 4, after the block rewrite and kit switch remove the last island consumer.

---

## R1 RESOLVED (Francesco, 2026-06-19): calendar is SERVER-FIRST too. No Lit anywhere.

Override of the blueprint's "keep ht-calendar as escape-hatch island" recommendation. Decision: even the calendar goes server-first (wire), with the wire OPTIMIZATION toolkit pre-arranged to absorb round-trip latency, not a Lit/@event-calendar client island.
- Filters/typeahead: `l:model.debounce` (no round-trip per keystroke).
- Initial grid: `l:lazy` / wire:init (render after first paint) + `l:loading` states for immediate feedback.
- Adjacent-week prefetch + optimistic morph where it helps.
- The one irreducible client bit (event drag-resize) = a small TYPED VANILLA TS module (CSP-clean) that fires a wire action on drop. NOT a Lit island, NOT @event-calendar.
- The month/week/day grid = server-rendered HTML (JTE) from the typed model.
Consequence: the calendar is the single heaviest piece of the refactor (gest's ht-calendar + @event-calendar dependency is retired). It gets its OWN dedicated, careful phase (not a fast wave), built with the debounce/optimization toolkit above. The escape-hatch for genuinely-heavy widgets becomes "a typed-TS micro-enhancement", not "a shipped Lit island"; lievit-ui ships no calendar island.

---

## STATUS: COMPLETE (2026-06-19)

All waves executed on `refactor/server-first-pivot`. Final inventory: **40 JTE partials + 14 wire
components + 0 Lit islands** (`registry/components/` is empty). Gates green on the merged tree:
vitest 876, `check:registry` / `typecheck` / `test:jte-compile` clean, `lievit-kit` verify =
499 units + 82 ITs BUILD SUCCESS.

- Wave 0: `registry:wire` two-root copy-in mechanism (collapsible) + CollapsibleComponentIT.
- Wave 1: ~20 presentation islands -> JTE partials (alert/card/button/input/checkbox/... select->native).
- Wave 2: ~13 leaf stateful islands -> wire (dialog/drawer/sheet/tabs/accordion/toggle-group/command/
  context-menu/navigation-menu/rich-select/file-upload/input-otp), each with a kit IT.
- Wave 3: alert-dialog (on the dialog wire) + popover seam (native popover + CSS anchor) +
  dropdown-menu (native) + sidebar (partial + TS collapse) + toast (partial + enhancer).
- Wave 4: badge/breadcrumb partials; chart (server SVG) + date-picker (native input); data-table
  (server-sorted partial aligned to the kit Table); calendar (server wire grid + debounce/lazy/loading
  + typed-TS drag); DROP carousel/menubar/resizable/scroll-area; kit Cell.Badge/Icon -> partial markup;
  4 blocks rewritten to compose partials; final DROP of the light-dom Lit helper.

Remaining (separate efforts, not part of this library refactor): gest re-alignment phases G1-G6
(the dogfood, ending in mandatory Playwright E2E asserting real rendered DOM), and folding in the
parked docs/CSP branches.
