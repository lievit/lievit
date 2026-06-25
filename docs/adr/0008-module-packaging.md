# ADR-0008: Module packaging (one starter, modular internals)

- **Status:** accepted (amended 2026-06-17, admin moved in-monorepo)
- **Date:** 2026-06-17
- **Deciders:** Francesco Bilotta

## Context

How lievit is cut into Maven artifacts is a one-way-ish door once published: coordinates are
hard to change after adopters depend on them. Two positions are on the table, and they disagree.

**Position A (the entity, locked text).** Seven artifacts:
`dev.lievit:lievit-core` · `-jte` · `-thymeleaf` · `-mustache` · `-freemarker` · `-raw` ·
`-spring-boot-starter`. One artifact per template adapter plus a core plus a starter.

**Position B (Francesco, 2026-06-17).** "Tutto in uno, no lievit-core, admin inside." Collapse
the artifacts: no separate core, and the (future, Filament-style) admin bundled in rather than
split out.

These are not reconcilable as written: A maximizes modularity, B maximizes simplicity. The
question is the right cut, and it is genuinely open. Maven itself is deferred for now (no build
yet), which is precisely why this is the moment to decide the shape without paying a migration
cost.

## Decision

**Resolved by Francesco, 2026-06-17.** Position A, in a monorepo:

- **One repository (monorepo) `lievit/lievit`**, holding **seven Maven artifacts**:
  `dev.lievit:lievit-core` · `-jte` · `-thymeleaf` · `-mustache` · `-freemarker` · `-raw` ·
  `-spring-boot-starter`. `lievit-core` IS a published coordinate (sub-question 1: published, not
  hidden). All five template adapters are separate artifacts from v0.1 (sub-question 2: split).
  `lievit-spring-boot-starter` is the single primary dependency most adopters add.
- **The Filament-style admin is OUT of scope for v0.1 and will be a SEPARATE REPOSITORY** (its own
  release cadence), not a module of this monorepo and not bundled into the runtime (sub-question 3:
  reserved as a future separate repo, the Livewire/Filament playbook).
- **`lievit-ui` is NOT one of the seven artifacts.** It is a **copy-in component registry** (Lit
  component source + design tokens you own), distributed via the CLI (`lievit add <component>`,
  shadcn model), living at the monorepo root as `lievit-ui/` (a `registry/` of owned source, not a
  `src/main/java` Maven module). The design tokens MAY later ship as a small published artifact; the
  components stay copy-in. Detailed in a dedicated ADR (lievit-ui).

## Amendment (2026-06-17): the admin is an in-monorepo module named `lievit-kit`

**Resolved by Francesco, 2026-06-17.** The earlier posture (sub-question 3: the Filament-style admin
reserved as a future SEPARATE REPOSITORY) is **superseded**. There is **no real motivation for a
separate repo for now**, so the admin ships **inside this monorepo** as a module:

- The admin is named **`lievit-kit`** ("Filament for Spring"), a reactor module `lievit-kit/`
  (`dev.lievit:lievit-kit`), **path-depending on `lievit-core`** (the SPI) and on
  `lievit-spring-boot-starter` (the wire runtime). It is NOT bundled into the runtime: an adopter who
  wants only the wire runtime never pulls it; an adopter who wants the admin adds the one extra
  coordinate. This keeps the ADR-0004 / ADR-0006 acyclic-graph and native-tree-shaking properties
  (the runtime image does not drag admin code) while dropping the cross-repo overhead the separate-repo
  posture was paying for nothing.
- **Revisit only if a real motivation appears** (e.g. the admin's release cadence genuinely needs to
  diverge from the runtime's, the Livewire/Filament split). Until then, monorepo module.
- The reconciliation rationale below still argued for "separate, opt-in"; it stays for the record, but
  "separate" now means **separate module, same repo**, not separate repository.

### Naming: "kit" now denotes the admin module (golden-path stratum renamed)

The word **"kit"** is hereby claimed for **this admin module** (`lievit-kit`). The knowledge entity's
former **"golden-path kit"** stratum (the Breeze/Jetstream-style reference application) is renamed
**"golden-path starter"** to avoid the collision. This ADR records the rename for the harness; the
knowledge-entity edit itself is Francesco's (promotion direction workspace -> knowledge).

The reconciliation rationale that informed the original call is kept below for the record.

## Coordinator's recommendation (to reconcile A and B)

A **single repository (monorepo)** with **opinionated defaults** and a **single primary
dependency most users add** (`lievit-spring-boot-starter`), but **internally modular artifacts**:

- The **runtime is template-engine-agnostic**; the **template adapters are split** so a consumer
  does not drag every engine onto the classpath (it pulls only the adapter it uses). This is the
  ADR-0004 boundary expressed in packaging, and it is what keeps GraalVM-native tree-shaking
  clean (ADR-0006).
- The **Filament-style admin is a separate, opt-in module**, never bundled into the runtime.

Rationale, from the Livewire / Filament evidence: separate, layered products **compound** (Livewire
is the runtime; Filament is a separate product on top, and the separation is what let each grow).
Bundling the admin into the runtime would (1) force its weight onto every adopter who only wants
the wire runtime, (2) couple the admin's release cadence to the runtime's, and (3) hurt
GraalVM-native tree-shaking by pulling admin code into every native image.

This **honours B's intent** (most users add **one** dependency and get sane defaults; they never
assemble a core + N adapters by hand) **without B's cost** (a single fat artifact that drags every
template engine and the admin onto every classpath). It **honours A's modularity** (adapters and
admin stay separate artifacts) **while softening A** on the `lievit-core` question: whether "core"
is a user-visible coordinate or an internal module folded behind the starter is the specific knob
to settle.

Open sub-questions for the decision:

1. Is `lievit-core` a published coordinate, or an internal module that only the starter and
   adapters depend on (never added directly by users)? (This is the heart of B's "no lievit-core".)
2. Do all five adapters ship as separate artifacts from v0.1, or does the starter default-bundle
   JTE (the primary) and split only the other four?
3. Confirm the admin is out of scope for v0.1 entirely (it is a deferred, later-phase sibling),
   so this ADR only needs to reserve its separateness, not design it.

## Consequences (of the recommendation, if adopted)

- Adopters get a one-line dependency and a working default; power users still compose.
- The native tree-shaking and the acyclic module graph (ADR-0004, ADR-0006) are preserved.
- The admin can grow on its own timeline as a separate product, the Livewire/Filament playbook.

## Alternatives considered

**Position A as written (seven user-visible coordinates).** Maximal modularity, but makes the
common case (add lievit, render with JTE) a multi-dependency assembly job, which is the friction
B is reacting to.

**Position B as written (one fat artifact, admin inside).** Simplest to add, but drags every
template engine and the admin onto every classpath, couples releases, and degrades native tree-
shaking, contradicting ADR-0004 and ADR-0006.
