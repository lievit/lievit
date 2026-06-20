# lievit vs Filament + shadcn/ui — Coverage Audit (completeness-graded)

> Method: **completeness-graded** (a feature is `full` only if every defining sub-feature is
> present and reachable) and **adversarially verified** (each per-area assessment was re-attacked
> at the source; the lone `full` claims were specifically challenged). This is NOT a "does lievit
> have a component named X" inventory — it measures how much of each component's REAL surface lievit ships.

## Verdict

At the **completeness bar (full only)**, lievit covers roughly **8%** of the audited Filament + shadcn
surface: **12 of 147** features are `full`, **114 (78%)** are `partial`, **21 (14%)** are `missing`.
Read the other way: lievit ships *something* for **86%** of the surface (`full` + `partial`), but
*completes* very little of it. The pattern is consistent and honest about itself — lievit is a
**broad, thin** library: nearly every Filament field/column/entry/action and nearly every shadcn
primitive has a counterpart, but the deep configuration surface (closures/utility-injection,
async/relationship machinery, storage+editor depth, client-side enhancers) is where it stops.
The `full` items cluster in **simple, self-contained shadcn presentational primitives** (Alert,
Aspect Ratio, Empty, Label, Progress, Separator, Skeleton, Spinner, Switch, Table) plus exactly
**two Filament features** (the deliberately-minimal `Hidden` field and the three-state `TrashedFilter`).
**Headline gaps**: (1) on the **shadcn side**, every overlay primitive (Dialog/Sheet/Drawer/Alert
Dialog) defers **focus-trap + Escape to an unshipped adopter TS module**, and the heavy interactive
components are absent (`Form`/validation, `Calendar` DayPicker, `Carousel`, `Resizable`, `Sonner`,
`Menubar`, `Scroll Area`, `Typography`); (2) on the **Filament side**, the whole **dynamic-closure /
utility-injection layer** is missing across forms (no `formatStateUsing`/dynamic options beyond a
single `optionsUsing`, no inline create/edit modals on Select, no `Builder`/`Toggle`/`Textarea`
schema field), tables are **intent-only** (filters/groups/summaries carry intent, the host runs the
query; no per-column search, no `ViewColumn`, no `ColumnGroup`), and **Panels/Resources auth is a
coarse functional seam** with boolean-flag auth pages that have **no backing page models**, no
generator, no relation-manager CRUD, and no per-verb policy map. Tenancy isolation is real but
its `delete()` **silently no-ops** cross-tenant (only `update()` throws).

---

## Coverage matrix

### Area: Filament Forms (fields) — 1 full / 20 partial / 3 missing

| Feature | Grade | Evidence (lievit file) | Missing for complete |
|---|---|---|---|
| TextInput | partial | `schema/TextInput.java` | copyable, dynamic/RawJs mask, readOnly, inputMode/autocapitalize, trim, utility injection |
| Select | partial | `schema/Select.java` | inline create/edit modals, async `getSearchResultsUsing`/`getOptionLabelUsing`, Eloquent relationship(), option groups, native(false) |
| Checkbox | partial | `schema/Checkbox.java` | inline(), accepted()/declined(), utility injection |
| Toggle | **missing** | — (no `schema/Toggle.java`; `ToggleButtons` is segmented choice) | the entire boolean Toggle field (on/off icon+color, accepted/declined) |
| Radio | partial | `schema/Radio.java` | optionsUsing closure, descriptions(), boolean() mode, disableOptionWhen() |
| CheckboxList | partial | `schema/CheckboxList.java` | descriptions(), columns()/grid, relationship(), bulk-toggle customization |
| Textarea | **missing** | — (only legacy `TextareaField`, outside schema engine) | rows/autosize/readOnly/length/trim — no schema-engine Textarea |
| DateTimePicker / TimePicker | partial | `schema/DateTimePicker.java`, `schema/TimePicker.java` | date-only DatePicker, format()/displayFormat()/locale(), timezone(), disabledDates(), firstDayOfWeek |
| FileUpload | partial | `schema/FileUpload.java` | disk/directory/visibility, image editor, previews, filename controls, security — most under-built field |
| RichEditor | partial | `schema/RichEditor.java` | blocks/mentions/merge-tags, attachment config, json() TipTap output, sanitization, plugins |
| MarkdownEditor | partial | `schema/MarkdownEditor.java` | attachment dir/types/size config, drag-drop upload, utility injection |
| Repeater | partial | `schema/Repeater.java` (395 lines) | relationship-persistence hooks, table()/simple() variants, action customization, distinct() |
| Builder | **missing** | — (no `Block::make` typed container) | the entire Builder field (typed blocks + per-block schema) |
| KeyValue | partial | `schema/KeyValue.java` | key/value placeholders, editable-locks, action customization |
| TagsInput | partial | `schema/TagsInput.java` | splitKeys, reorderable, color, per-tag validation, dynamic suggestions |
| ColorPicker | partial | `schema/ColorPicker.java` | distinct rgba() format, field-level visual-panel contract |
| Hidden | **full** | `schema/Hidden.java` | — (defining surface: carry value, no UI, persist when hidden, programmatic default — all present) |
| Cross-cutting field anatomy | partial | `SchemaField.java`, `SchemaComponent.java` | placeholder/readOnly/extraAttributes/id/autofocus on fields, JS visibility variants, below/above content |
| Reactive / live state | partial | `SchemaComponent.java`, `schema/LiveMode.java` | formatStateUsing/dehydrateStateUsing transform closures, afterStateUpdatedJs, partial-render control |
| Validation helpers | partial | `schema/Rules.java` (~25 of ~82) | format validators, prohibited family, scoped DB rules, date relations, multipleOf, nullable |
| Layout: Grid/Flex/Fieldset | partial | `schema/Grid.java`, `Flex.java`, `Fieldset.java` | columnStart/order, container queries, gap/dense, Flex grow/from, Fieldset contained |
| Layout: Section | partial | `schema/Section.java` | icon(), persistCollapsed(), secondary() |
| Layout: Tabs | partial | `schema/Tabs.java` | iconPosition, badgeColor, activeTab, contained/vertical/scrollable |
| Layout: Wizard | partial | `schema/Wizard.java` | step icon/description, skippable, persistStep, submit/next/prev action customization |

### Area: Filament Tables — 1 full / 24 partial / 6 missing

| Feature | Grade | Evidence (lievit file) | Missing for complete |
|---|---|---|---|
| TextColumn | partial | `kit/TextColumn.java` | badge/icon/color/size/weight, date/since, numeric/locale, html/markdown, list formatting, placeholder/default |
| IconColumn | partial | `kit/IconColumn.java` | size, true/false color pair, per-icon tooltip, wrap, boolean() defaults |
| ImageColumn | partial | `kit/ImageColumn.java` | disk/visibility, height/width, defaultImageUrl, checkFileExistence, extraImgAttributes |
| ColorColumn | partial | `kit/ColorColumn.java` | copyMessage/copyMessageDuration, wrap |
| SelectColumn (editable) | partial | `kit/SelectColumn.java`, `EditableColumn.java` | async search, relationship options, before/after hooks (EditableColumn = single applyEdit) |
| ToggleColumn (editable) | partial | `kit/ToggleColumn.java` | before/after hooks, disabled(), on/off color+icon |
| CheckboxColumn (editable) | **missing** | — (no CheckboxColumn) | inline boolean checkbox column |
| Custom columns | **missing** | — (Cell is a sealed hierarchy) | `ViewColumn::make()` arbitrary view + state injection |
| Sorting | partial | `Column.java` | multi-column, query closure, persistSortInSession |
| Searching | partial | `Column.java` | individual-column input, query/relationship/JSON search, persistence |
| State/formatting/tooltips | partial | `Column.java`, `TextColumn.java`, `Summarizer.java` | state()/getStateUsing/default, extraAttributes, column action(), relationship aggregates, utility injection |
| Alignment/visibility/width | partial | `Column.java` | alignment (enum unwired), width/grow, static visible/hidden, wrapHeader |
| Column groups | **missing** | — (no ColumnGroup) | `ColumnGroup::make` header grouping |
| Summaries | partial | `Summarizer.java` | numeric/money formatting, query() scoping, hidden/excludeNull, groupsOnly |
| Custom filters | partial | `Filter.java` (intent-only) | query()/baseQuery closure, schema(), toggle() variant, indicateUsing, default() |
| SelectFilter | partial | `kit/SelectFilter.java` | relationship option resolution, preload, getOptionLabelUsing closures, default() |
| TernaryFilter | partial | `kit/TernaryFilter.java` (final) | per-state labels, query closures, nullable(), attribute() |
| TrashedFilter | **full** | `kit/TrashedFilter.java` | — (core three-state soft-delete contract present; lacks Filament's ternary-label customization, flagged cosmetic) |
| QueryBuilder filter | partial | `Predicate.java`, `Constraint.java` | nested AND/OR groups (biggest gap), custom operators, DateConstraint time(), SelectConstraint searchable/multiple |
| Filter layout & persistence | **missing** | — (Filter carries no rendering) | filtersLayout, defer/apply, persistFiltersInSession, default filters + indicators |
| Row/record actions | partial | `Action.java` | url() on Action (separate UrlAction), RecordActionsPosition, recordAction/recordUrl row-click |
| Bulk actions | partial | `kit/BulkAction.java` | fetchSelectedRecords(false), selectability hooks, notification titles, groupedBulkActions |
| Header/toolbar actions | partial | `ActionRegistry` | distinct toolbarActions slot, url() on header actions |
| Layout (Split/Stack/Grid/Panel) | **missing** | — (those are FORM layout in schema/*) | table-cell Split/Stack/Grid/Panel, contentGrid, stackedOnMobile |
| Grouping | partial | `kit/Group.java` | description/collapsed-default, date() grouping, custom queries, groupsOnly + summaries |
| Pagination | partial | `kit/Table.java` | paginated(false), extreme links, paginationMode (simple/cursor), queryStringIdentifier |
| Searching (table-level) | partial | `Table.java`, `Column.isSearchable` | debounce/placeholder config, persistence, individual-column input |
| Reordering | partial | `Table.reorderable` | direction arg, trigger action, before/after hooks, paginatedWhileReordering |
| Polling | **missing** | — (no poll on Table/TableWidget) | poll('10s'), deferLoading() |
| Empty state | partial | `Table.emptyState` | emptyStateIcon, emptyStateActions CTA, fully custom view |
| Record URL/row styling | partial | `Table.striped`, `Column.url` | whole-row recordUrl/recordAction (url is per-column), recordClasses, table-level header/description, configureUsing |

### Area: Filament Infolists + Actions — 0 full / 13 partial / 3 missing

| Feature | Grade | Evidence (lievit file) | Missing for complete |
|---|---|---|---|
| TextEntry | partial | `TextEntry.java`, `Entry.java` | icon/size/weight, date/since, numeric/locale, prefix/suffix (form-only), html/markdown, list formatting, url, helperText/hint, closure color |
| IconEntry | partial | `IconEntry.java` | size enum, boolean auto-detect, true/false color helpers, tooltip |
| ImageEntry | partial | `ImageEntry.java` | visibility/temporary URL, size/square helper, defaultImageUrl, stacked/ring/overlap, limit, checkFileExistence, url |
| ColorEntry | partial | `ColorEntry.java` | copyMessage(), copyMessageDuration() |
| KeyValueEntry | partial | `KeyValueEntry.java` | **unwired**: no shipped view-model invokes `resolveMap()` (Infolist.resolve/AdminViewView/SlideOver flatten to `String.valueOf(map)`); no end-to-end test |
| RepeatableEntry | partial | `RepeatableEntry.java` | grid(), contained() per-item card, nested LAYOUT components inside each item |
| Section (layout) | **missing** | — (`AdminViewView` = one unnamed section) | infolist Section schema (heading/description/icon/aside/collapsible/actions) |
| Tabs (layout) | **missing** | — (Infolist.schema accepts Entry[] only) | infolist Tab children, activeTab, persistTab, contained, vertical |
| Grid/Fieldset/Split (layout) | partial | `Infolist.columns(int)`, `RepeatableEntry.columns` | per-breakpoint columns, columnSpan/Start, Fieldset, Split for entries |
| Action trigger button | partial | `AdminAction.java` | translateLabel, responsive/hidden label, iconPosition, badgeColor, keyBindings, extraAttributes |
| Action modals | partial | `ConfirmationModal.java`, `ModalConfig.java`, `SlideOver.java` | modalIconColor/alignment, modalContent, extra footer actions, modalCloseButton, sticky header/footer, width-as-enum |
| Action forms | partial | `FormAction.java` | disabledForm() read-only, arguments() context channel |
| Action wizards | **missing** | — (`FormAction.form` is single `Form<T>`) | multistep wizard inside an action modal |
| Action lifecycle | partial | `AdminAction.run()`, `AdminActionResult` | before()/after()/halt()/cancel(), per-action success/failure notification builders, mountUsing, replaceMountedAction, keyBindings, arguments |
| Action grouping | partial | `ActionGroup.java` | color/size, button-vs-dropdown toggle, tooltip, dropdown placement/width/offset, nested groups, dividers |
| Prebuilt actions & contexts | partial | CreateAction…ExportAction, `UrlAction`, `NotificationAction` | global-search action context; ViewAction = authorize-only modal (infolist render is separate full page); no named accessSelectedRecords |

### Area: Filament Panels / Resources / Notifications / Widgets / Tenancy — 0 full / 17 partial / 0 missing

| Feature | Grade | Evidence (lievit file) | Missing for complete |
|---|---|---|---|
| Panels: configuration | partial | `Panel.java` (final) | font(), spa(), unsavedChangesAlerts, middleware stacks, auto-discovery, domain routing, semantic-color API |
| Panels: authentication | partial | `Panel` flags, `PanelAccessGate.java`, `AccountWidget.java` | **no backing pages** for login/register/reset/verify (boolean flags only), MFA, email-change verify, avatar provider, full profile |
| Panels: navigation/groups/clusters | partial | `NavigationItem.java`, `NavigationGroup.java` | badge tooltip, parentItem nesting, sidebar-width/global-collapse knobs, top-nav dropdown, breadcrumbs, replaceable sidebar/topbar |
| Panels: dashboard | partial | `Dashboard.java` | page-filters pipeline (InteractsWithPageFilters/$pageFilters), multiple dashboards |
| Resources: CRUD pages | partial | `Resource.java`, `ResourcePages.java`, `CreateAction.java` | generator, mutate/after hooks, simple/modal resources, separate schema classes, arbitrary custom pages, sub-navigation |
| Resources: relation managers | partial | `RelationManagerView.java` | inline create/edit/delete, pivot editing, per-relation authz, nested resources, tenant-awareness |
| Resources: global search/scoping | partial | `GlobalSearchResult.java`, `Table.reorderable` | result actions, getEloquentQuery scope seam, recordTitle accessor, search-across-relations, policy-gated reorder |
| Resources: soft deletes/authz/bulk | partial | `AdminAuthorizer.java` (functional seam), `SoftDeleteRepository`, `ImportAction.java` | per-verb policy map (AdminOperation is coarse), sensitive-attribute protection, import/export as AdminAction subclasses |
| Notifications: flash/toast | partial | `AdminNotification.java`, `NotificationAction.java` | JS send()/window API, HTML/Markdown body, dispatchSelf/dispatchTo + payload, global alignment, close-by-id |
| Notifications: database/broadcast | partial | `DatabaseNotificationStore.java` (interface; in-memory impl only) | persistent JDBC store + table migration, bell rendering, broadcast driver parity, Laravel Notification bridge |
| Widgets: stats | partial | `StatWidget.java` | polling on the stat, extraAttributes, StatsOverviewWidget container with shared poll |
| Widgets: chart | partial | `ChartWidget.java` + 8 variants | reactive to dashboard page filters (framework lacks the pipeline) |
| Widgets: table/custom | partial | `TableWidget.java` | full interactivity (fixed single page), polling, page-filters, register widgets on resource pages, disable defaults |
| Tenancy: setup/identity | partial | `Tenancy.java`, `HasTenants`, `Tenant`, `TenantContext` | slugAttribute/ownershipRelationship config, tenantDomain/subdomain, HasName/HasAvatar/HasCurrentTenantLabel |
| Tenancy: pages/menu | partial | `Tenancy.java`, `TenantMenu.java` | RegisterTenant/EditTenantProfile pages (boolean flags only), searchableTenantMenu, tenantMenuItems |
| Tenancy: scoping/isolation | partial | `TenantScope.java` | named relationship config (raw lambdas), per-resource opt-out, scopedUnique/scopedExists, **delete() silently no-ops cross-tenant** (only update() throws), tenant middleware |
| Tenancy: billing | partial | `Tenancy.java`, `BillingProvider.java` (abstract) | concrete provider, per-resource gating, billing route slug, billing menu item |

### Area: shadcn/ui — 10 full / 40 partial / 9 missing

| Feature | Grade | Evidence (lievit file) | Missing for complete |
|---|---|---|---|
| Accordion | partial | `wire/accordion` | collapsible flag, per-item disabled, height animation, Item/Trigger/Content composition |
| Alert | **full** | `jte/alert.jte` | — (variants + heading/content + role assertive/polite) |
| Alert Dialog | partial | `wire/alert-dialog` | **focus-trap + Escape NOT shipped** (deferred to adopter TS), focus-on-cancel default |
| Aspect Ratio | **full** | `jte/aspect-ratio.jte` | — (native CSS ratio + child constraint) |
| Avatar | partial | `jte/avatar.jte` | delayMs, async broken-image swap (opt-in adopter TS, not shipped) |
| Badge | partial | `jte/badge` | asChild polymorphic render, shadcn variant taxonomy |
| Breadcrumb | partial | `jte/breadcrumb` | ellipsis/collapsed dropdown, responsive collapse, asChild |
| Button | partial | `jte/button` | secondary/outline/link variants, size variants, loading state |
| Button Group | partial | `jte/button-group` | Separator, Text addon, split-button sub-components |
| Calendar | **missing** | `wire/calendar` is an EVENT calendar | DayPicker date-selection: modes, disabled/min/max dates, captionLayout, numberOfMonths, presets, week numbers, RTL |
| Card | partial | `jte/card` | Title/Description/Content/Footer/Action as distinct slots |
| Carousel | **missing** | — | orientation, prev/next, Embla options, basis sizing, setApi, keyboard/drag |
| Chart | partial | `jte/chart.jte` (bar-only SVG) | types beyond bar, ChartContainer/config, tooltip/legend, multi-series |
| Checkbox | partial | `jte/checkbox.jte` | indeterminate, aria-invalid/error state |
| Collapsible | partial | `wire/collapsible` | disabled, expand/collapse animation |
| Combobox | partial | `wire/rich-select` | grouped items, clear button, drawer-on-mobile, RHF/TanStack adapters |
| Command | partial | `wire/command` (no enhancer ships) | fuzzy filter, CommandDialog (cmd-K), CommandSeparator, keyboard nav |
| Context Menu | partial | `wire/context-menu` + `.ts` | submenus (dropped), labels, inset items |
| Data Table | partial | `jte/data-table` | row selection, column visibility, filtering, row actions, TanStack helpers |
| Date Picker | partial | `jte/date-picker.jte` (native input) | range, date+time, presets, Calendar-in-Popover, disabled-dates |
| Dialog | partial | `wire/dialog` | **focus-trap + Escape NOT shipped**, Trigger/Header/Footer/Title/Description/Close slots |
| Direction | **missing** | — | DirectionProvider (RTL/LTR) |
| Drawer | partial | `wire/drawer` | drag-to-dismiss/vaul, snap points, responsive Dialog-on-desktop, **focus-trap NOT shipped**, composable slots |
| Dropdown Menu | partial | `jte/dropdown-menu` | submenus, groups+labels, inset items, roving keyboard nav |
| Empty | **full** | `jte/empty.jte` | — (header/media/title/description/content + action slot via params) |
| Field | partial | `jte/field` | FieldGroup/Set/Legend, orientation, Separator, auto aria-invalid, FieldContent slot |
| Hover Card | partial | `jte/hover-card` | open/close delays, positioning props, controlled open |
| Input | partial | `jte/input.jte` | file-specific affordance, built-in helper text |
| Input Group | partial | `jte/input-group` | Textarea variant, spinner/loading addon, block-end alignment, Button sub-component |
| Input OTP | partial | `jte/input-otp` + enhancer | Separator, explicit Group primitive, onComplete |
| Item | partial | `jte/item.jte` | Title/Description slots, asChild, ItemGroup/Separator |
| Kbd | partial | `jte/kbd.jte` | KbdGroup |
| Label | **full** | `jte/label.jte` | — (for-assoc + required marker + peer styling) |
| Menubar | **missing** | — | MenubarMenu/Trigger/Content app-bar, items, submenus, keyboard nav |
| Native Select | partial | `jte/native-select` | optgroup, size variants |
| Navigation Menu | partial | `jte/navigation-menu` | viewport shared panel, animated indicator, asChild, keyboard open |
| Pagination | partial | `jte/pagination.jte` | asChild router-Link (only gap) |
| Popover | partial | `jte/popover` + `wire/popover` | full positioning, PopoverAnchor, PopoverClose, controlled open |
| Progress | **full** | `jte/progress.jte` | — (determinate + indeterminate + full ARIA) |
| Radio Group | partial | `jte/radio-group` | aria-invalid/error state (only gap) |
| Resizable | **missing** | — | PanelGroup, Panel sizing/collapsible, ResizableHandle, persisted layout |
| Scroll Area | **missing** | — | custom scrollbar, ScrollBar component, type modes |
| Select | partial | `jte/native-select` + `wire/rich-select` | styled composable Select (Trigger/Value/Content/Item), Group/Label/Separator, scroll buttons |
| Separator | **full** | `jte/separator.jte` | — (orientation + decorative/semantic) |
| Sheet | partial | `wire/sheet` | **focus-trap + Escape NOT shipped**, composable Trigger slot |
| Skeleton | **full** | `jte/skeleton.jte` | — (pulse + shape + sizing) |
| Slider | partial | `jte/slider` | range/multiple thumbs, controlled, vertical orientation |
| Sonner | **missing** | `jte/toast` is a static banner | Toaster mount + imperative toast() API, promise toasts, action/cancel, stacking |
| Spinner | **full** | `jte/spinner.jte` | — (animated + sizing + a11y + motion-reduce) |
| Switch | **full** | `jte/switch.jte` | — (toggle + controlled + disabled + label + ARIA) |
| Table | **full** | `jte/table.jte` + 7 sub-parts | — (full composable primitive set) |
| Tabs | partial | `wire/tabs` | orientation, activation mode, composable List/Trigger/Content slots |
| Textarea | partial | `jte/textarea.jte` | built-in helper text (only gap) |
| Toast | partial | `jte/toast` + enhancer | useToast/Toaster provider, action button, swipe-to-dismiss, programmatic |
| Toggle | partial | `jte/toggle.jte` | controlled pressed + onPressedChange (toggling is caller's action) |
| Toggle Group | partial | `wire/toggle-group` | variants/sizes propagation, vertical orientation |
| Tooltip | partial | `jte/tooltip.jte` | TooltipProvider (delays), positioning + arrow, controlled open |
| Typography | **missing** | — | h1-h4/p/blockquote/list/code/lead/muted styles |
| Form | **missing** | `jte/field` is the closest | framework-pluggable validation (RHF/TanStack), Zod schema, Form*/FormField/FormMessage set, auto aria-wiring |

---

## Prioritized gap backlog

Ordered by what a real Filament/shadcn adopter hits **first and hardest**. Each line = the gap + the concrete work to close it.

### P0 — adopters hit these on day one

1. **Overlay focus-trap + Escape (Dialog / Sheet / Drawer / Alert Dialog)** — all four ship the
   markup but **defer the focus-trap + Escape/overlay-dismiss to an unshipped adopter TS module**.
   This is a broken accessibility + UX promise across the entire overlay family. *Work*: ship one
   typed-TS `dialog`/`overlay` enhancer (focus-trap, Escape, focus-restore, optional overlay-dismiss)
   wired by `main.ts`, used by all four `wire/*` overlays. Single highest-leverage fix.

2. **shadcn `Form` + validation** — `missing`. The single most-used shadcn composite has no
   counterpart beyond `Field` (layout-only). *Work*: a server-side validation→message orchestration
   that auto-binds `aria-invalid`/`aria-describedby` and renders field-level + form-level messages
   (the htmx/server analogue of FormField/FormMessage), so adopters stop hand-wiring error ids.

3. **Filament dynamic-closure / utility-injection layer (forms)** — pervasive `partial` across every
   field: only `Select.optionsUsing` is reactive; there is no `formatStateUsing`/`dehydrateStateUsing`,
   no `$state/$get/$record` injection, no `disableOptionWhen`, no dynamic mask/datalist. *Work*: add a
   closure-with-EvaluationContext seam to `SchemaComponent` and thread it through options/format/disable/
   visibility/default so fields become genuinely reactive, not static.

4. **Filament auth pages are boolean flags with no backing pages** — `Panels: authentication` ships
   `registration()/passwordReset()/emailVerification()` toggles that **render nothing** (no page
   models), and the authorizer is a coarse functional seam. *Work*: implement the four auth page models
   + a per-verb policy map (`view/create/update/delete/restore/forceDelete/reorder`) behind
   `AdminAuthorizer`. Until then "auth" is a placeholder.

### P1 — hit as soon as you build a real CRUD/table screen

5. **Tables are intent-only / non-interactive** — filters, groups, summaries carry intent and the host
   runs the query; **no per-column search** (one global only), **no `ViewColumn`** (sealed Cell), **no
   `ColumnGroup`**, no filter layout/persistence, no whole-row record URL, no polling. *Work*: (a) add a
   query-closure seam to `Filter`/`SelectFilter`; (b) add per-column `searchable` with an individual
   input; (c) add `ViewColumn` escape hatch; (d) ship `ColumnGroup` + a filter-layout/persistence model.

6. **Resources have no generator, no relation-manager CRUD, no mutate/after hooks** — `RelationManagerView`
   is read + link/unlink only; CreateAction hardcodes redirect+notification with no `mutateFormDataBefore*`/
   `after*`. *Work*: add the lifecycle hooks to the page drivers, inline create/edit/delete on relation
   managers (+ pivot editing), and at minimum a scaffolding generator for the list/create/edit/view quadruple.

7. **`KeyValueEntry` is unwired (correctness bug, not just thinness)** — `resolveMap()` exists but **no
   shipped view-model calls it**; every render path flattens to `String.valueOf(map)`. *Work*: invoke
   `resolveMap()` in `Infolist.resolve`/`AdminViewView`/`SlideOver` and pin it with an end-to-end test.
   Same class of "promise the code never reaches" — audit other entries for it.

8. **shadcn `Calendar` DayPicker** — `missing` (the existing calendar is an event scheduler). Blocks any
   real date-range/disabled-dates/DOB picker; `Date Picker` stays a bare native input with nothing to
   compose. *Work*: a server-rendered DayPicker grid with selection modes (single/multiple/range),
   disabled/min/max matchers, captionLayout, numberOfMonths — then `Date Picker` composes it in a popover.

### P2 — polish + completeness that adopters work around

9. **Tenancy `delete()` silently no-ops cross-tenant** — isolation is real but `update()` throws while
   `delete()` quietly does nothing on a cross-tenant id (neither is a 404). *Work*: make cross-tenant
   write semantics uniform (throw or 404 consistently) + add `scopedUnique`/`scopedExists` and a
   per-resource opt-out.

10. **Heavy shadcn primitives still absent** — `Carousel`, `Resizable`, `Scroll Area`, `Menubar`,
    `Sonner` (imperative toast), `Typography`, `Direction` (RTL). *Work*: prioritize by adopter demand;
    `Sonner` (imperative `toast()` + Toaster) and `Typography` are the cheapest high-value wins, the rest
    are heavier client-side components. Plus the FileUpload depth gap (storage/editor/previews) on the
    Filament side, the most under-built single field.

---

## How to re-run this audit (docs-first + adversarial)

1. **Docs-first per area**: take the OFFICIAL Filament docs (Forms / Tables / Infolists / Actions /
   Panels-Resources-Notifications-Widgets-Tenancy) and shadcn/ui component index as the **reference
   surface** — never the model's memory. Enumerate every component and, per component, its defining
   sub-features (every fluent method / prop that a real adopter relies on).
2. **Grade against the source, not the file name**: for each feature, open the lievit file and grade
   `full` only if EVERY defining sub-feature is present AND reachable through a shipped render/resolve
   path. `partial` = exists but materially thinner. `missing` = no real counterpart. A class existing
   ≠ the feature existing (see `KeyValueEntry`, where the method ships but no view-model calls it).
3. **Adversarially verify every grade, attack the `full`s hardest**: re-read the source to refute the
   claim. Specifically try to *demote* each `full` (the rare ones) — find one missing defining
   sub-feature and it drops to `partial`. Specifically try to *promote* `missing` (find any shipped
   counterpart). Record refutations inline. This pass produced real corrections: `KeyValueEntry`
   full→partial (unwired), Tenancy delete-no-op nuance, ForceDelete/NotificationAction over-counted as
   missing.
4. **Watch the load-bearing distinctions**: presentation partial (`.jte`) ≠ a Java field builder;
   intent-carrier (`Filter`/`Summarizer`/`Group`) ≠ query execution; a doc-promised TS enhancer ≠ a
   shipped one (grep the dir for the `.ts`); a boolean flag ≠ a backing page model.
5. **Count honestly**: report `full`/`partial`/`missing` and the `full`-only % as the completeness bar.
   Do not let "ships something" inflate into "covers".
