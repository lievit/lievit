# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) once it leaves 0.x.

## [Unreleased]

### Changed

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

## [0.1.0] - unreleased

_Wire protocol v0.1 target. Not yet shipped._
