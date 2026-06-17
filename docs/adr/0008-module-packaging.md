# ADR-0008: Module packaging (one starter, modular internals)

- **Status:** proposed (DECISION PENDING Francesco)
- **Date:** 2026-06-17
- **Deciders:** Francesco Bilotta

## Context

How lievit is cut into Maven artifacts is a one-way-ish door once published: coordinates are
hard to change after adopters depend on them. Two positions are on the table, and they disagree.

**Position A (the entity, locked text).** Seven artifacts:
`com.iambilotta:lievit-core` · `-jte` · `-thymeleaf` · `-mustache` · `-freemarker` · `-raw` ·
`-spring-boot-starter`. One artifact per template adapter plus a core plus a starter.

**Position B (Francesco, 2026-06-17).** "Tutto in uno, no lievit-core, admin inside." Collapse
the artifacts: no separate core, and the (future, Filament-style) admin bundled in rather than
split out.

These are not reconcilable as written: A maximizes modularity, B maximizes simplicity. The
question is the right cut, and it is genuinely open. Maven itself is deferred for now (no build
yet), which is precisely why this is the moment to decide the shape without paying a migration
cost.

## Decision

**PENDING.** Not locked. Both positions are recorded above. The coordinator's recommendation,
offered to reconcile them, is below; Francesco makes the call.

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
