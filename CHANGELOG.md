# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) once it leaves 0.x.

## [Unreleased]

### Added

- `Lievit.test()`: the developer-facing component test harness (ADR-0010), shipped as a feature in
  `lievit-spring-boot-starter` (`com.iambilotta.lievit.test`). A fluent tester that mounts and drives
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
- Repository foundation: organisation, conventions, and the doc set derived from the locked
  design decisions in the project entity. README-driven skeleton (category, three strata, the
  seven-annotation public API, wire protocol v0.1, quickstart sketch). Foundational ADRs under
  `docs/adr/`. Living-docs plan under `docs/PLAN.md`. CI workflow stub (build / test / native
  matrix) marked as a stub until the Maven build lands.
- The build (Maven, modules, `pom.xml`) is intentionally **not** wired yet: this is the
  conventions-and-docs foundation pass.

## [0.1.0] - unreleased

_Wire protocol v0.1 target. Not yet shipped._
