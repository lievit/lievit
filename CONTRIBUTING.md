# Contributing

Thank you for considering a contribution to `lievit`. The project is small, opinionated, and
movement-shaped: it is the named full-stack way for interactive Spring apps, not a kitchen-sink
framework. The public API is hard-capped at seven annotations on purpose. Keep that in mind when
you propose changes.

> **Status: pre-public foundation pass.** The build (Maven) is not wired yet (deferred until the
> conventions and docs settle). This document describes the discipline the repo will run under;
> the commands that mention Maven / tracegate are the target, switched on when the build lands.

## What is in scope

- The wire runtime (HTML over the wire: snapshot codec, HMAC signing, DOM patching glue).
- The golden-path kit (the reference app: Spring Security done well + Modulith structure + lievit wired).
- Template adapters that implement the engine-agnostic abstraction (JTE is canonical primary).
- Documentation that improves the path from `lievit new` to a working interactive component.
- Test coverage that hardens the wire protocol (codec, checksum, signing, replay).

## What is out of scope (for now)

- A replacement DI / routing / view-resolver / session / filter chain. lievit lives **inside**
  Spring; it never reimplements what Spring already owns.
- An eighth public annotation. The surface is hard-locked at seven (see `docs/adr/0002`).
- A heavy `make:*` scaffold generator. Deferred / AI-replaced (see the entity and the CLI ADR).
- A rich admin (Filament-for-Spring-Boot). Separate, opt-in, deferred to a later phase.
- Cargo-culting a Laravel/Livewire feature "because they have it". Every feature must solve a
  real pain of a Spring developer.

## Coding standards

- Java 25 release target. Spring Boot 4.
- The wire codec is **pure Java, zero Spring** (ArchUnit-enforced module boundary).
- Template adapters must not depend on each other (ArchUnit-enforced).
- `@Nullable` via JSpecify; zero NPE (NullAway gate).
- No inline `<script>` in templates and no data hardcoded inside a partial: behaviour lives in
  the TypeScript client modules, data comes in as typed params.
- English for code, comments, commits, contract names. No em-dashes.

## Test-driven, contract-first

`lievit` is built spec-first: a frozen spec becomes a failing test, then minimal code to green,
then refactor while green, with traceability from requirement to test. The wire protocol is the
load-bearing boundary; any change to the canonical serialization of a snapshot must ship with a
roundtrip golden test and a tampering test.

## Living requirements (tracegate)

When the build lands, the per-module `_generated/` catalog will be produced by
[tracegate](https://github.com/iambilotta/tracegate) from the test suite and is
**generated, never hand-edited** (same discipline as the sister repos `spring-aiact` and
`spring-gdpr`). To change a requirement, change the test (rename it, or add a `@spec.given` /
`@spec.when` / `@spec.then` javadoc), then regenerate. CI drift-gates the committed catalog.
See `docs/PLAN.md` for the full living-docs strategy.

## Reporting a security issue

Do not open a public issue for a security report. See [SECURITY.md](SECURITY.md). The snapshot
HMAC chain and the stateless wire endpoint are the load-bearing security primitives.
