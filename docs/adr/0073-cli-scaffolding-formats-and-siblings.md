# ADR-0073: CLI scaffolding formats (--sfc/--mfc/--class) + colocated siblings

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

`make:component` (issue #141) originally scaffolded one shape: a class + a JTE template. ADR-0003 locks
two authoring shapes (single-file DSL, multi-file template) and ADR-0023 a class-only form. Livewire's
`make:livewire` family lets the author pick the format and optionally generate test / js / css
siblings. CONTRIBUTING is explicit that lievit is *not* a heavy `make:*` generator: the IDE owns heavy
scaffolding. So the generators must stay thin and earn their place (a component is the unit a lievit app
grows by; a form and a layout are the recurring one-liners).

## Decision

Extend `make:component` with a mutually-exclusive format selector and optional sibling flags, and add
two thin sibling generators:

- **Format (picocli `@ArgGroup(exclusive=true)`):** `--mfc` (default) = class + JTE template;
  `--sfc` = a single-file class with an `@LievitRender Html view()` using the DSL + the DSL imports, no
  template; `--class` (alias `--no-template`) = class only. Passing two is a usage error (exit 2),
  enforced by picocli, never a silent guess.
- **Siblings:** `--test` writes a colocated `*Test.java` pure-domain unit test (the fast loop, no
  Spring); `--js` writes a `<Name>.lievit.ts` client module (loaded under the strict CSP, ADR-0062);
  `--css` writes a `<Name>.lievit.css` scoped style (CSP-safe route, ADR-0063). Each is skip-if-exists.
- **`make:form`** scaffolds the recurring "form = component with `@Wire` fields + a `save` action"
  shape + a template wiring `l:submit` and `l:model`.
- **`make:layout`** scaffolds a JTE app layout with the `<lievit:styles/>` / `<lievit:scripts/>` asset
  directives (ADR-0061) and a `${content}` slot (one-shot, no class).

All keep the existing discipline: PascalCase validation, kebab template names, no-overwrite, package
inference (shared in `Scaffolds`).

## Consequences

- The author picks the authoring shape at scaffold time instead of hand-rewriting after, and the
  scaffold matches the `convert` command's two shapes exactly (consistency between the two CLI paths).
- The generator set stays small and opinionated (component / form / layout), honoring the CONTRIBUTING
  "thin CLI" stance; it is not a Filament-style code factory.
- The single-file scaffold introduces the DSL to new users by example, the ADR-0003 differentiator.

## Alternatives considered

**A config-file default format + no flags.** Deferred: the flags cover the need now; a project default
(`lievit.toml`) can layer on later without breaking the flag contract.

**One mega `make` with a `--type` enum.** Rejected: separate `make:form` / `make:layout` subcommands
mirror Livewire's family and read better in `--help` than a polymorphic flag.
