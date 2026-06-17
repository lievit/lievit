# ADR-0009: lievit-ui is a copy-in component registry, not a Maven artifact

- **Status:** accepted
- **Date:** 2026-06-17
- **Deciders:** Francesco Bilotta

## Context

lievit ships a curated essential set of UI components from v0.1 (form, input, table, modal, tabs)
so a developer is productive immediately. The open question was *how the adopter receives them*.
Two distribution models were on the table.

**Model A: a published component-library artifact.** Ship the components as a Maven dependency (or
an npm package of web components). The adopter adds the dependency and consumes the components as a
black box; upgrades arrive by bumping the version. This is the Vaadin / classic component-library
model.

**Model B: a copy-in registry.** Distribute the component *source* (the Lit component code plus the
design tokens) into the adopter's own repository via the CLI, where the adopter then **owns** it.
This is the shadcn/ui model: `npx shadcn add button` copies the source in; you edit it freely; there
is no encapsulated dependency to fight. The component is yours from the moment it lands.

The decision is shaped by three forces specific to lievit:

1. **Agentic-native is a first-class design goal.** lievit is built for an era where developers work
   with AI copilots (governed, not autonomous). An AI edits *source it can see and own* far better
   than it edits a black-box web-component dependency whose internals live behind a shadow DOM.
2. **Encapsulated web-component libraries fight both restyling and AI edits.** A shadow-DOM
   component resists external CSS by design (that is the encapsulation), which collides with
   lievit's zero-CSS / adopter-owns-the-look positioning (ADR-0005), and it hides its internals from
   an AI that would otherwise modify them.
3. **lievit wins on the model and the integration, not on catalog breadth.** Vaadin has spent
   fifteen years building a deep catalog; competing on catalog size is a losing game. The win is the
   wire model and how cleanly the components integrate with it. A copy-in registry leans into that:
   a small, excellent, owned set beats a large, encapsulated, rented one for this segment.

ADR-0008 already settled that `lievit-ui` is **not** one of the seven Maven artifacts and lives at
the monorepo root as `lievit-ui/`; this ADR records the full decision and its rationale.

## Decision

**`lievit-ui` is a copy-in component registry**, distributed via the CLI, not a Maven artifact and
not an `apps/` application.

- **Copy-in, adopter-owned.** The unit of distribution is *source*: the Lit component code and the
  design tokens. `lievit add <component>` copies that source into the adopter's repository, where
  the adopter owns and edits it. There is no encapsulated dependency to upgrade; the shadcn model.
- **Distributed via the CLI.** `lievit add button`, `lievit add input`, ... copies the requested
  primitive (and its token dependencies) into the adopter's project.
- **Lives at the monorepo root as `lievit-ui/`.** It is a `registry/` of owned source, **not** one
  of the seven Maven artifacts (ADR-0008), **not** under `apps/`, and **not** an `src/main/java`
  module. The registry is the source the CLI copies *from*.
- **Design tokens may later become a small published artifact.** The *tokens* (the design-system
  primitives: color, spacing, radius, type scale) are the one part that could reasonably ship as a
  tiny published package later, so adopters share a token vocabulary without copying it. The
  *components* stay copy-in regardless. This is a future option, not a v0.1 commitment.

The detailed registry layout, the token system, and example primitive source shapes are specified
in `docs/lievit-ui.md`.

## Consequences

- **AI copilots edit lievit-ui components natively**, because the source is in the adopter's repo,
  not behind a dependency boundary. This is the agentic-native payoff and the central reason for the
  model.
- **No restyling fight.** The adopter owns the markup and the styles; there is no shadow DOM to
  pierce and no library CSS to override. This is consistent with the zero-CSS-default positioning
  (ADR-0005): lievit imposes nothing, and copy-in is the strongest form of "you own the look".
- **Upgrades are not automatic.** The cost of ownership is that a registry improvement does not
  arrive by a version bump; the adopter re-runs `lievit add` (with a diff/merge) or copies the
  change. This is the accepted shadcn trade: control over auto-upgrade. The CLI can offer a
  `--diff` to show what changed upstream.
- **The catalog stays deliberately small.** Copy-in rewards a curated set, not breadth: every
  component the registry ships is one the adopter will read and own. This reinforces "win on the
  model, not the catalog" (it does not try to be a Vaadin-killer catalog).
- **The registry is not on any adopter's classpath.** Because it is copied source, it adds nothing
  to the GraalVM-native image except what the adopter actually pastes in and uses, which keeps
  native tree-shaking clean (consistent with ADR-0006 and the packaging boundaries of ADR-0008).

## Alternatives considered

**A published component-library artifact (Vaadin / classic model).** The adopter adds a dependency
and gets upgrades for free. Rejected for lievit: it makes the components a black box that fights
restyling (against ADR-0005) and resists AI edits (against the agentic-native goal), and it pushes
lievit toward competing on catalog breadth, which is Vaadin's fifteen-year moat, not lievit's game.

**A web-component package on npm (shadow-DOM encapsulated).** Familiar distribution, but the
shadow-DOM encapsulation is precisely the property that fights both adopter restyling and AI edits.
Rejected for the same reasons.

**Make lievit-ui an eighth Maven artifact.** Considered and closed by ADR-0008: it is not one of the
seven artifacts. This ADR confirms *why* (it is source to be owned, not a dependency to be consumed)
and locks the copy-in model.

## Cross-references

- ADR-0004 — engine-agnostic template adapters (the runtime side; lievit-ui is the component side).
- ADR-0005 — zero-CSS default, adopter owns the look (copy-in is its strongest expression).
- ADR-0008 — module packaging: lievit-ui is not one of the seven artifacts; lives at the monorepo
  root as `lievit-ui/`.
- `docs/lievit-ui.md` — the registry layout, the token system, and example primitive source shapes.
