# ADR-0002: The public API is exactly seven annotations

- **Status:** accepted; the annotation count amended by ADR-0053 (the eighth annotation,
  `@LievitAuthorize`, admitted as the security-critical exception this ADR's own rule allows)
- **Date:** 2026-06-17
- **Deciders:** Francesco Bilotta

## Context

lievit must feel small to learn and impossible to misuse, while covering the full component
lifecycle (declare, bind, act, mount, render). Every framework in this category accretes surface
over time; the cost lands on the learner and on the maintainer. The project's anti-overkill
principle caps the public surface deliberately, before the accretion starts.

## Decision

The public API is exactly **seven annotations**. No eighth annotation ships without an ADR that
supersedes this one.

1. `@EnableLievit` — autoconfiguration entry point, on a `@Configuration` class.
2. `@LievitComponent` — marks a Java class as a server-side component (implicitly a Spring
   `@Component`).
3. `@Wire` — binds a field bidirectionally between class and template, compile-time type-checked.
4. `@LievitAction` — marks a method callable from the template (`l:click`, `l:submit`, ...).
5. `@LievitMount` — lifecycle hook: after construction, before render.
6. `@LievitRender` — custom pre-render hook.
7. `@LievitProperty` — optional, extended metadata on a `@Wire` field (validation, transform,
   serialize).

These map onto the five user-facing concepts: Component, Wire, Action, Mount, Render.

The annotation names follow the brand. If the naming gate changes the brand name before public
release, all identifiers (annotations, endpoint, `<lievit-*>` prefix, env vars, Maven
coordinates) change with it.

## Consequences

- The learning surface is bounded and memorable: five concepts, seven annotations. A developer
  can hold the whole API in their head.
- Feature requests that need a new public annotation are declined by default; the bar to add one
  is an ADR that supersedes this. This is intentional friction against scope creep toward
  "framework alternative".
- Some capabilities must be expressed through configuration or convention rather than a new
  annotation. That is the accepted cost of the cap.

## Alternatives considered

**Open-ended annotation set, grown as needs appear.** The path most frameworks take. It produces
a surface no one fully knows and a maintenance burden that compounds. Rejected: the cap is a
feature, not a limitation.

**Fewer than seven (fold lifecycle into convention).** Tempting, but `@LievitMount` and
`@LievitRender` express genuinely distinct lifecycle points, and `@LievitProperty` carries
metadata that does not belong on `@Wire` itself. Seven is the minimum that stays explicit.
