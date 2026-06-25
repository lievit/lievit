# lievit guide

Task-oriented guides for building with lievit. They show the API **as it ships today**
(`1.0.0`); every snippet is drawn from the test suite or the runnable examples, so it
compiles against the same code you depend on. Where a feature is on the roadmap rather than in the
build, it is called out as such (and collected in the [roadmap](#roadmap)).

For the *why* behind a decision, follow the ADR links: the guides describe behavior, the
[ADRs](../adr/) record the reasoning and the alternatives that were rejected.

## Read order

1. [Getting started](getting-started.md) — install via JitPack, build a Counter in five minutes.
2. [Components and the wire protocol](components-and-wire.md) — the mount/render/action/re-render
   loop, the snapshot, what crosses the wire.
3. [Directives reference](directives.md) — every `l:*` directive that ships, with modifiers.
4. [Events and `$dispatch`](events.md) — cross-component events, `@LievitOn`, the effects channel.
5. [Computed properties and lifecycle hooks](computed-and-lifecycle.md) — `@LievitComputed`, the
   convention-named hooks, the lifecycle bus.
6. [Forms and validation](forms-and-validation.md) — Jakarta Bean Validation on `@Wire`, form
   objects, the `FieldValidator` SPI.
   - [Turbo backend contract](turbo-backend-contract.md) — **the #1 Spring gotcha**: a standard
     `<form method=post>` under Turbo Drive needs **303 on success, 422 on validation error** (a 200
     is silently discarded). The lievit wire is exempt.
7. [Authorization](authorization.md) — `@LievitAuthorize` / `@PreAuthorize` on actions, the
   `PermissionEvaluator`, per-request re-authorization (the Spring Security backbone).
8. [Nested components](nested-components.md) — keyed children, reactive props, modelable two-way bind.
9. [Islands](islands.md) — re-render a named region without touching the rest of the component.
10. [The single-file DSL](single-file-dsl.md) — type-safe HTML in Java, no separate template.
11. [The lievit-kit admin](kit-admin.md) — Resource / Form / Table / Action / Panel.
12. [The lievit-ui registry](lievit-ui.md) — the copy-in component layer.

## The five concepts

Everything in lievit reduces to five things a developer thinks about:

| Concept | What it is |
|---|---|
| **Component** | A server-side reactive unit: a typed Java class (`@LievitComponent`). |
| **Wire** | A field bound bidirectionally between the class and the template (`@Wire`). |
| **Action** | A method callable from the template (`@LievitAction`, fired by `l:click` / `l:submit`). |
| **Mount** | The lifecycle hook that runs after construction, before the first render (`@LievitMount`). |
| **Render** | The render step (template + signed snapshot). |

## What ships today

The Maven reactor builds green across 14 modules: the wire runtime (`lievit-core`), the typed
single-file DSL (`lievit-dsl`), the v4 compiler (`lievit-compiler`), five template adapters (`jte`,
`thymeleaf`, `mustache`, `freemarker`, `raw`), the Spring Boot starter, the admin kit (`lievit-kit`),
the CLI (`lievit-cli`), the copy-in UI registry + client runtime (`lievit-ui`), and a runnable
golden-path example. See the [README feature matrix](../../README.md#feature-matrix) for the
shipped-vs-roadmap split.

## Roadmap

These are named in the ADRs and the wire-protocol spec as deliberately deferred, so v0.1 leaves room
for them. They are **not** in the build yet:

- **Server-side snapshot store** (wire-protocol §6): removes the 16 kb snapshot / 64 kb payload
  pressure for large-state components.
- **WebSocket / SSE transports** (ADR-0001, ADR-0012): opt-in, never the default; the `stream`
  effect key is reserved for it.
- **`download` effect** (ADR-0012): a base64 file ride-along on the effects channel.
- **UUID v7 component IDs** (wire-protocol §2): time-ordered ids; v0.1 uses UUID v4.
- **Relation fields beyond `BelongsToField`** in lievit-kit: `HasMany` / `BelongsToMany` and the
  richer relationship managers.
- **Broadcast notifications, import/export, multi-tenancy** in the admin layer: opt-in later modules,
  not baked into v0.1.

The reserved effect keys (`stream`, `download`) and the `l:model` deferred-default already leave the
protocol room for these without a breaking change.
