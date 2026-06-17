# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) once it leaves 0.x.

## [Unreleased]

### Added

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
