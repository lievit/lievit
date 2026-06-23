# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) once it leaves 0.x.

## [Unreleased]

### Fixed

- **`l:navigate` SPA navigation hardened on its hard edges (ADR-0084).** ADR-0084 keeps `navigate.ts`
  rather than adopting a heavy dep (Turbo Drive / hx-boost fight the CSP-clean bundle + the wire/morph
  swap), and flags it as the #1 place to find robustness bugs before 1.0; this pass de-risks the hard
  edges and pins each with a golden test (`test/navigate-harden.test.ts`):
  - **In-flight navigation race**: a second click (or any navigation) issued before the first fetch
    resolved let the slower fetch win the morph + `pushState`, desyncing the visible body from the
    address bar. A monotonic navigation token now supersedes a stale in-flight navigation: a fetch
    that resolves after a newer navigation began aborts (no swap, no `pushState`, no scroll).
  - **Back/forward during an in-flight forward navigation**: `popState` now bumps the same token, so
    a slow forward fetch that resolves after a Back cannot overwrite the restored page.
  - **Cache invalidation was defeated by `go()`'s own snapshot**: `go` snapshotted the page being
    left and *then* read the cache for the target, so navigating to the current URL (or a `popState`
    whose entry had been invalidated) handed back the just-stored snapshot and short-circuited the
    fetch, replaying the stale page. The target is now read from the cache BEFORE the leaving page is
    snapshotted. A new opt-in `lievit:navigate-invalidate` event (`{ url }` to drop one snapshot, no
    detail to clear all) lets the wire layer evict a page made stale by a mutation.
  - **`popState` restored scroll even when the swap forced a full reload** (changed tracked bundle):
    `scrollTo` on a page about to be replaced is pointless and visibly wrong; it now fires only when
    the swap actually happened.
  - **Failed prefetch poisoned the URL forever**: a `l:navigate.hover` prefetch that failed left the
    URL in the in-flight set, so a later hover never retried; a failed prefetch is now evicted so a
    subsequent hover re-prefetches.
  - **Progress-bar leak**: a superseded navigation could leave its top-of-page bar up; the
    successor navigation now clears it (idempotent).
  - **Tab title was not synced**: the head merge is additive (never replaces `<title>`), so the URL
    changed but the tab kept the old title; the swap now syncs `document.title` to the incoming page.
  - **Focus was lost on every navigation (a11y)**: a body swap dropped keyboard focus to `<body>`
    (nothing announced, keyboard user dumped at the top of the tab order). Focus now moves to the new
    page's primary target (`[autofocus]` → `<main>`/`[role=main]` → first heading), made
    programmatically focusable with `tabindex="-1"` without joining the tab order, never stealing
    focus the page placed itself. All changes are CSP-clean (no inline script, no `eval`,
    `createElement` for any injected node).
- **The validation gate is now intent-driven, not shape-driven** (three silent-drop bugs collapsed
  into one correct decision): a failing `@Wire`-field validation used to skip a single `else` block
  that bundled three unrelated intents (real form-submit actions, framework magic mutations, inbound
  events), so any unrelated invalid field silently dropped all three. The dispatcher now gates ONLY
  the real form-submit `@LievitAction` calls. A magic `$set` / `$toggle` mutation applies regardless
  of an unrelated invalid field (the "click expand, nothing happens because an email field is empty"
  bug is gone), and an inbound dispatched `@LievitOn` event is delivered independent of validation
  (an event is not a form submit). One POST carrying a magic mutation and a real submit gates each
  intent independently. Net less code: the gate no longer bundles three concerns behind one `if`.
- **`LievitFormObject` typed fields now round-trip without loss** (the kit-CRUD blocker): the
  form-object dehydrate / rehydrate / dotted-update paths went through `FormField.read` / `write`
  (numeric coercion only), so a typed sub-field bypassed the synthesizer registry: a `LocalDate`
  threw on the raw `Field.set`, a `BigDecimal` lost its scale, an enum could not bind. The three
  paths now reuse the existing synthesizer golden path (`synthesizers.dehydrate` / `hydrate` /
  `hydrateForUpdate(formField.type(), value)`), the same machinery a top-level `@Wire` field uses
  (ADR-0020), so a form object can hold typed fields, not just String / primitive.
- **`@LievitOn` no longer drops a handler when two listeners share an event name.**
  `EventListenerMetadata.resolve()` collapsed the listeners into a `Map<resolvedName, Method>`, so a
  component declaring two `@LievitOn("saved")` methods kept only the last-declared one and silently
  dropped the other (Livewire fires *all* matching listeners). `resolve()` now returns a
  `List<ResolvedListener>` (reflection order) and `EventInvoker.invokeMatching` invokes every pair
  whose name matches. A two-handlers-one-event test pins both firing.
- **`@LievitRender` single-file vs multi-file ambiguity now fails fast at reflect time.** A component
  declaring both a named `@LievitComponent(template="...")` AND a markup-returning `@LievitRender`
  method was undefined (the adapter silently picked a winner). `ComponentMetadata.of` now rejects the
  combo at startup with a message naming both halves and the fix; the two legal modes (named template
  + void prepare-hook, or empty template + markup-returning render) are unaffected.
### Security

- **Reserved-key smuggling at the dehydrate/hydrate boundary is closed** (`SynthesizerRegistry`,
  ADR-0020): the typed-tuple envelope was detected purely structurally, so a client-controlled plain
  `Map` or `DynamicObject` whose key was literally `@w` (or any reserved `@`-sigil key, e.g. `@memo`)
  was mis-read as a typed-state tuple on the next hydrate, corrupting integrity or self-DoSing the
  request (a 422/500; the `ClassInstantiationGuard` already capped the blast radius at integrity +
  self-DoS, never RCE). Reserved-sigil keys on the plain-map / `DynamicObject` path are now escaped on
  dehydrate (a leading `@` is doubled: `@w` → `@@w`) and unescaped on hydrate, so user data can never be
  shaped into an envelope. The documented invariant "a `DynamicObject` / plain map can never smuggle a
  typed object" is now literally true by construction, not by coincidence. Plain maps without sigil keys
  are untouched, so the Counter snapshot stays byte-identical. New round-trip tests pin a user map keyed
  `@w` (and a `DynamicObject` keyed `@w`) reconstructing as DATA.
- **`ChecksumFailureLimiter` no longer grows unbounded under IP rotation** (memory-DoS): the per-client
  `ConcurrentHashMap` never evicted a client whose deque had drained, so a rotating-IP attacker turned
  the anti-brute-force control into a memory-DoS vector (the "bounded by the active client set" claim
  was false). Drained entries are now evicted on touch under the deque lock (value-checked remove, no
  lost in-flight failure), plus an amortized sweep on `recordFailure` once the map outgrows the
  plausible active set, so the map collapses back to the currently-active clients. No new dependency
  (`lievit-core` stays pure-Java, zero-Spring); a test pins that 2000 rotated IPs collapse to the live
  set after the window elapses.

### Changed

- **Removed the vestigial Lit references from `lievit-ui` and the README** (an honesty fix: Lit was
  deliberately dismantled but two surfaces still advertised it). The `lievit-ui` client is the
  dependency-free TypeScript runtime; nothing in the shipped code imports Lit, and the test suite
  actively gates against any `import ... from "lit"` / `LitElement`. Concretely: dropped the unused
  `lit` dependency from `lievit-ui/package.json` (and its lockfile entry + the stale package
  description), dropped the dead `"lit"` entry from the esbuild externals in `build-islands.ts`, and
  corrected the README Stack line, the lievit-ui feature-matrix row (now "68 copy-in server-rendered
  JTE component primitives driven by a dependency-free TypeScript client runtime", not "28 light-DOM
  Lit components"), and the Custom-elements section (the `<lievit-*>` tags are plain native custom
  elements reserved by ADR-0005, not "Lit-based"; loading/error UX ships today as runtime attribute
  directives, `<lievit-stream>` is reserved for the roadmap `stream` effect). `npm ci` + the full
  vitest suite (1773 tests) + `tsc` stay green with Lit absent, proving nothing imported it.
- **The public-annotation surface is now documented by role, not by a count.** The "seven / eight /
  nine annotations" slogan had drifted out of sync with the actual 20 runtime `@interface` types,
  teaching a false invariant. `package-info.java` replaces the integer with a stable ROLE taxonomy
  (bootstrap / component / state / action / events / lifecycle / authorization / loading / page), and
  a build-time `AnnotationTaxonomyInvariantTest` asserts the documented set equals the actual set of
  runtime annotations in `io.lievit`, so the doc can never silently drift again. The per-annotation
  javadoc "one of the seven public annotations" lines were updated to the role-based language.

- **`dropdown-menu` gains an optional `triggerClass` param** (backflow from gest, dogfood-then-extract):
  extra utility classes applied to the trigger `<button>` itself (the wrapper's `cssClass` left the
  inline-flex button content-tight). Empty default, backward-compatible. `kit/page/user-menu` uses it
  for a new `inFooter` placement: the user menu can now render as a full-width sidebar-FOOTER row
  (`triggerClass = "w-full justify-between"`, opens upward, name + chevron `lv-sidebar-collapsible` so a
  collapsed icon rail shows the avatar only), the Filament panel user-menu placement, in addition to the
  default compact topbar trigger.
- **Table chrome Filament-fidelity pass** (backflow from gest): the data-column header cells
  (`lievit-ui` `table/head` + `lievit-kit` `kit/table/sortable-head`) lighten from the heavy 70%-surface
  band to a subtle 35% tint with a small muted-semibold label (faithful `fi-ta-header-cell`); data cells
  (`table/cell`) get comfortable `px-3 py-3` padding (was cramped `p-2`); and `kit/table` shows an
  `l:loading.delay` spinner on the results row during a wire call (Filament's `fi-ta` async indicator).
- **lievit-ui is now a SERVER component library** (ADR-0012): the 46 light-DOM Lit islands were
  retired in favour of one predictable, convention-driven model: JTE partials for presentation,
  lievit-wire components (typed Java state + `l:*`) for stateful interactivity, htmx/native for
  simple swaps, and a typed-vanilla-TS micro-enhancement as the rare client escape hatch. Root
  cause of the pivot: light-DOM custom elements use native `<slot>`, inert without a shadow root,
  so slotted content silently failed to project, with no console error and no failing test. The
  new library ships **40 JTE partials + 14 wire components + 0 Lit islands**; every partial and
  wire template carries a render-asserting test (vitest source-contract + lievit-kit ITs through
  the real runtime) that would have caught a non-projected slot. Highlights: the overlay seam is
  the native `popover` attribute + CSS Anchor Positioning (no floating-ui); the calendar is a
  server-rendered wire grid with the `l:model.debounce` / `l:init` / `l:loading` optimization
  toolkit and a typed-TS drag enhancer (no @event-calendar, no Lit); the kit renders badge/icon
  cells and the four blocks (app-shell, dashboard, login, signup) as partial markup, not island
  tags. The `light-dom` Lit style helper was dropped with the last island. `lievit add` copies a
  component on both layers (Java + JTE) via the `registry:wire` two-root mechanism. The CLI
  single-root back-compat is now pinned against a synthetic `registry:ui` fixture.

### Added

- **lievit-kit ships its first RENDER templates (the table chrome)**: the kit was a render-less
  builder layer (its only `.jte` were test fixtures), so every adopter hand-assembled the Filament
  table chrome inline and it drifted. The kit now ships the canonical `kit/table.jte` (+ `kit/table/
  {sortable-head,rich-cell}.jte`) under `lievit-kit/src/main/resources/jte/`, rendering a
  `KitTableView` onto the existing `lievit-ui` `data-table/*` + `table/*` + pagination / empty /
  badge / checkbox / chip / native-select / dropdown-menu / icon partials. All 14 Filament pieces are
  server-first (real GET `<a href>` / `<select>` / `<form>` POST or `l:*` wire hook, strict-CSP
  clean): header heading + header-actions bar, global search, filters trigger + inline panel,
  active-filter indicator chips + reset-all, bulk select-all + per-row checkbox + the N-of-M bar,
  sortable header cells with `aria-sort` + chevron, header-group super-row, per-page selector,
  numbered pagination + "Showing X to Y of Z" count, column-manager, summary/footer row, empty state,
  and the typed rich-cell switch. New view-model surface: `io.lievit.kit.page.KitTableView` (the
  render-time bundle: URL patterns + filter-indicator chips + bulk `Selection` + `ColumnSummary`
  footer) and `KitTableComponent` (the generic kit-owned render entry that derives the server-first
  URL patterns from a resource's `AdminRoutes`), plus `AdminListView.Pagination.firstShown()` /
  `lastShown()` for the results-count line. Copy-in registered as the `kit-table` registry item
  (`lievit-kit/registry/jte/kit-table/meta.json`, Filament's publish-views model). A new
  `lievit-kit/test/jte-compile` harness compiles the chrome against the built kit jar + the staged
  lievit-ui partials and renders an `AdminListView` fixture asserting all 14 pieces
  (`KitTableChromeRenderTest`, green). This is the reference render pattern the other kit builders
  (forms, panels, infolists) replicate.
- **Typed JTE component facade (jte-models)**: the `lievit-ui` registry partials now generate a
  typed `gg.jte.generated.precompiled.Templates` interface (one compile-checked method per partial,
  parameters derived from each `@param`) via the `jte-models` `ModelExtension`, so an adopter's IDE
  indexes the components from the jar (`templates.button(..)`, `templates.badge(..)`,
  `templates.chip(..)`) instead of stringly-typed template names. The `test/jte-compile` harness
  generates + javac-compiles the facade and proves it through `TypedFacadeTest` (renders real
  components through `StaticTemplates`); see `lievit-ui/test/jte-compile/README.md` for the adopter
  copy-paste. `switch.jte` is excluded from the facade only (reserved Java word; still ships +
  compiles).
- **lievit-ui component-API increments** (in-flight, across the current registry wave): a removable
  `chip` partial (Filament active-filter pill / shadcn dismissible badge), an icon SPI for pluggable
  icon sets, a size scale on `input`, and a safe-attributes pass-through on `button`. Each lands
  with its source-contract test and is covered by the real-compiler + typed-facade gate above. See
  the per-component entries below as they are filled in by the wave.
- **Typed-state round-trip** (ADR-0020, the confirmed kit-CRUD blocker): a `Synthesizer<T>` SPI +
  `SynthesizerRegistry` (`io.lievit.wire.synth`) so a non-primitive `@Wire` property (record, enum,
  `LocalDate`/`LocalDateTime`/`LocalTime`/`Instant`, `BigDecimal`/`BigInteger`, `UUID`, `Set`, a
  non-String-keyed `Map`, or a user value object) dehydrates to a `@w`-tagged `{d, s, t}` tuple and
  hydrates back to the **exact** type, recursively — instead of decoding to a bare `LinkedHashMap`.
  Built-in synths for the JVM analogues of Livewire's set; a `Wireable` SPI (`toWire()` / static
  `fromWire(Object)`) the registry prefers over reflection and the native-safe escape hatch; the
  typed-update path coerces a raw `wire:model` value (an `<input type=date>` string, a `<select>`
  enum name) to the field's declared type. Primitives and plain JSON pass through unwrapped, so the
  Counter snapshot stays byte-identical. The AOT processor registers the typed `@Wire` field types so
  it round-trips in a native image too.
- **Class-instantiation guard** (ADR-0021, the new part of the gadget-denylist issue): a
  `ClassInstantiationGuard` consulted before any synthesizer reflectively instantiates the class
  named in a tuple's `t`. Default-deny by gadget-prone root (`Runtime`, `ProcessBuilder`, IO / net /
  naming / scripting / templating, Spring context, …) layered under the existing ADR-0013 JSON-shape
  allowlist; a denied class is a `FORBIDDEN_DESERIALIZATION` (422), never a 500. The shipped HMAC /
  `PayloadGuard` / `ChecksumFailureLimiter` paths are untouched.
- **Request lifecycle + interceptor bus** (ADR-0022): a fixed, observable phase order
  (`HYDRATE → UPDATE → UPDATED → CALL → RENDER → DEHYDRATE → DESTROY`, mount variant
  `MOUNT → RENDER → DEHYDRATE → DESTROY`) dispatched through a named `LifecycleBus`
  (`on(phase, listener)` / `trigger(phase, ctx)` with `finish`-callback semantics), so a feature
  registers as a listener instead of a hardcoded branch. Strict ordering: `UPDATED` finishers run
  after **all** updates (one hook can override another), a `CALL` listener can early-return to skip
  the method (the magic-action seam), `RENDER` is skippable (the renderless seam), and a `DEHYDRATE`
  memo survives the stateless round trip in the snapshot wire (the locales / persistent-middleware
  pattern). The default bus is empty (behavior-neutral). `WireDispatcher`, `SynthesizerRegistry`, and
  `LifecycleBus` are auto-configured beans, overridable by the application.

- **Livewire v4 client convergence** (ADR-0024), all additive on the ADR-0019 client seams (no
  dispatcher/codec/bundle-core rewrite):
  - **Client interceptors** (#93): a participating `InterceptorChain` alongside the observing
    `LifecycleBus`, with the pinned phase order
    `onInit → onSend → onSuccess → onSync → onEffect → onMorph → onFinish → onRender` plus
    `onCancel` / `onError` / `onRedirect`. An interceptor can `cancel()` a call, mutate outgoing
    headers/updates, and block a server redirect; global / per-action / per-component scopes.
  - **Surgical snapshot merge** (#87): `mergeNewSnapshot(base, server, intent)` keeps an in-flight
    client edit to a path the server did not change (same-path server change wins), with
    reverse-indexed array removals, dot-paths, key-order preservation, and large/sparse numeric keys
    kept as keyed objects. The runtime keeps an ephemeral wire mirror seeded from the snapshot.
  - **Islands** (#89): HTML-comment fragment markers + `parseIslands` / `morphIslands` (replace /
    append / prepend, deduped) and an `l:island` directive that re-renders only the named region; an
    additive `islands` effect key.
  - **v4 directives** registered through one `registerV4Directives`: `l:bind.<attr>` (#75),
    `l:text` (#77), `l:dirty` + `$dirty` (#85), `l:error` / `l:errors` + `$errors` (#101),
    `l:ref` (#109), `l:sort` (#111), `l:click.async` (#97), and disable-during-request (#125).
  - **Request bundling** (#95): a per-component commit queue (a click burst collapses to ordered
    round-trips), `.async` opts out to race.
  - **Release tokens + bfcache** (#105): a `release` effect key + `data-lievit-release`, and a
    `pageshow`-from-bfcache reload, both CSP-safe.
  - **CSP-safe `$js`** (#131): a `JsRegistry` (`runtime.js.register(name, fn)`) + a `js` effect key
    the server triggers by name — lievit's no-inline-script replacement for Livewire's `$js`; an
    unknown name is a logged no-op, never an `eval`.
  - Server side: additive `island(name)` / `js(name, args...)` / `release(token)` on `LievitEffects`,
    serialized as new `Lievit-Effects` keys (`islands` / `js` / `release`), header omitted when empty
    (byte-for-byte ADR-0001/0012 backward compatible); native hints for the new `WireEffects.Js`.

- `Lievit.test()`: the developer-facing component test harness (ADR-0010), shipped as a feature in
  `lievit-spring-boot-starter` (`io.lievit.test`). A fluent tester that mounts and drives
  a `@LievitComponent` through the real wire pipeline (codec → registry → dispatcher → template →
  the `POST /lievit/{id}/call` HTTP edge over `MockMvc`), headless, carrying the signed snapshot
  internally. Surface: `mount()`, `model(field, value)`, `call(action)`, `assertWire(path, value)`
  (typed, dotted + `.size`), `assertWireMatches(predicate)`, `assertSee` / `assertDontSee` /
  `assertSeeHtml` / `assertSeeInOrder`, `assertSnapshotRotated` / `assertSnapshotValid`, and
  `assertRejected(<reason>.class)` for the error-code state machine — including `LockedProperty`
  (403, attacker's seat) and `TooManyFailures` (429), the two Livewire's own component tester cannot
  reach. Hostile-seat affordances `tamperUpdate` / `forgeSnapshot`. The `@LievitTest` meta-annotation
  bundles the `@SpringBootTest` slice + dev signing key + `MockMvc` (test-scope; does not count
  against the seven-annotation cap). Failure messages name the call sequence. The Spring-test deps
  are `optional` so they reach an adopter's test classpath, never their runtime. Dogfooded: the
  verbose `CounterRoundtripIT` is rewritten on top of it; the harness has its own test suite
  (`LievitTesterIT`). Deferred (open questions): `assertModelLive` / `assertModelDeferred` (gated on
  the template-parse surface, ADR-0010 sect. 2.4/2.6) and an `assertEffect`-style surface (waits on
  the sibling effects-channel work).
- `lievit-kit`: the admin layer ("Filament for Spring") as an in-monorepo reactor module on the
  lievit runtime (ADR-0008, amended 2026-06-17). Skeleton: `AdminPanel` builder DSL,
  instance-based `AdminResource<T>`, the shared `AdminSchema` parent of the `AdminForm`/`AdminTable`
  builders (one hierarchy from v0.1, no later unification), `AdminRenderHook` named injection
  points, the persistence-agnostic `AdminRecordRepository<T>` port, `AdminPanelPlugin`
  (`getId`/`register`/`boot`), and the first-class `@AdminPage`. Proven end-to-end by a hello-admin:
  a list-only `AdminResource` rendered through the runtime via lievit-jte (`HelloAdminIT`).
- `lievit-kit` CRUD data spine (the Filament P0, full-page List / Create / Edit / Delete only;
  modal / single-page CRUD is deferred to the nested-component wave). `RecordRepository` gains a
  bounded read (`Query` offset+limit + `Page<T> page(Query)`, replacing unbounded `findAll`, kept as
  a default) and the write path (`create` / `update` / `delete`). `Form` owns the write: a
  `FormBinder<T>` maps string state to and from the typed record, an optional `FormValidator`
  (Jakarta Bean Validation) gates `save` at submit time and collects `FieldError`s, and `save`
  returns a `SaveResult<T>`. `AdminAction<T>` is the first-class action abstraction with built-in
  `CreateAction` / `EditAction` / `DeleteAction`; on success they flash an `AdminNotification` and
  redirect on the existing `LievitEffects` substrate (`DeleteAction` is server-confirmed). The
  write boundary funnels through the `AdminAuthorizer` seam (default `permitAll()`; the host wires
  its policy). `AdminListView` (with `Pagination`) / `AdminFormView` are the render view-models;
  `ListPageDriver` / `FormPageDriver` are the reusable page logic a concrete `@LievitComponent`
  delegates to (the core binds only members declared on the component class itself); `ResourcePages`
  + `Resource.pages()` bind a resource to its four pages. A worked CRUD example (`ListingResource`
  + three page components + JTE templates) drives the whole spine List→Create→Edit→Delete through
  the real runtime and effects channel (`HelloAdminIT`).
- Release readiness: `jitpack.yml` so the Java 25 reactor builds on JitPack and is consumable as
  `com.github.lievit.lievit:<module>`; the README gained a JitPack install snippet (Maven + Gradle).
  Single source of version truth via the Maven CI-friendly `${revision}` property + the
  flatten-maven-plugin (a version bump is now a one-line edit, not 12). CI un-stubbed: the `build`
  job runs the real `./mvnw -B verify`, the `native` job runs the real AOT reachability gate, and
  the placeholder `tracegate` job was removed (it gated nothing).
- Repository foundation: organisation, conventions, and the doc set derived from the locked
  design decisions in the project entity. README-driven skeleton (category, three strata, the
  seven-annotation public API, wire protocol v0.1, quickstart). Foundational ADRs under
  `docs/adr/`. Living-docs plan under `docs/PLAN.md`.
- The Maven build is wired and green across all 11 modules (the wire runtime, the single-file DSL,
  five template adapters, the Spring Boot starter, the admin kit, the CLI) plus a runnable
  golden-path example.

### Fixed

- **Island vs whole-component snapshot race — silent lost update (#7).** An `l:island` re-render and a
  whole-component re-render share one `state.snapshot` but ran their commits across an `await` with no
  ordering, so a `l:model` edit typed while an island call was in flight was silently wiped (the
  island's commit cleared the WHOLE pending set; `SnapshotCodec.verify` checks signature+expiry only,
  no CAS, so it was silent, not a 409). The snapshot-commit critical section is now serialized per
  component (a `commitChain` mutex) so concurrent island/whole-component commits apply one at a time in
  completion order, and a commit drops ONLY the pending paths it actually sent, preserving a newer edit
  that arrived mid-flight. The network stays concurrent (independent scopes still fly in parallel).
- **`.async` same-scope race — silent `@Wire` clobber (#8).** `l:async` actions bypass the commit
  queue to run in parallel, but each rotated the shared snapshot, so a stateful `.async` action
  silently lost-updated `@Wire` (the markup advertised safe parallel mutation it could not deliver).
  `.async` is now RESTRICTED to renderless / side-effect-only actions: a `.async` run never reads or
  rotates the snapshot, never merges, never morphs — it applies only its side effects (`dispatch` /
  `redirect` / `url` / `js`). To mutate `@Wire`, use a normal queued action.
- **File-upload re-entrancy — orphaned controller + stale-ref clobber (#9).** A second file pick
  overwrote the in-flight `AbortController`, orphaning the first (uncancellable), and a slow first
  upload could write a stale temp-ref over `@Wire` out of order. `uploads.handle()` now aborts any
  existing controller for the input before starting, tags each run with a monotonic id, and drops a
  superseded run's `setModel` so only the latest pick's ref lands.
- **Native text input could not be server-cleared once typed into (#13).** A dirty `.value` detaches
  from the `value` attribute, so a server-asserted empty/changed value reconciled only the attribute
  and never reached the screen. The morph now pushes a server-asserted `value`/`checked` onto the live
  property, so a server clear (`value=""`) or change actually lands; an un-asserted re-render still
  preserves in-progress typing.

### Changed

- **Client-runtime morph markers are namespaced under one reserved prefix `data-lievit-rt-*`.** The
  morph's "preserve client-owned attributes" allowlist was a per-NAME list that had to grow with every
  new marker (re-creating the same double-bind defect each time). All runtime bind/state markers
  (`bound-*`, `init-fired`, `current-bound`, `page-bound`, `poll-armed`, `lazy-loaded`, `upload-bound`,
  `loading-active`) moved under `data-lievit-rt-`, and `isClientOwnedMarker` is now a one-line
  `startsWith`. Behaviour identical; adding the next marker needs no morph edit. The no-LCS /
  no-backtracking morph mis-pair of unkeyed siblings on a leading tag-shift (#12) is documented as a
  deliberate non-goal in the morph source, with keying as the user-side mitigation (golden tests pin
  both the mis-pair and the keyed fix).

## [0.1.0] - unreleased

_Wire protocol v0.1 target. Not yet shipped._
