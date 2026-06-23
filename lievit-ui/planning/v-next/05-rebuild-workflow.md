<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# 05 — Rebuild workflow (the phased execution)

STATUS: blueprint, 2026-06-23. The recommended PHASED execution for the v-next rebuild. The phases exist to
defeat the naive failure mode ("spin up 10 agents, give each a file, say 'just edit it', merge"). That mode
produces a divergent library, hand-rolled-and-subtly-wrong a11y, accidental license contamination, and
green-at-all-costs tests that certify a fake substrate. Each phase below targets one of those failures.

The phases respect the Bezos doors: the DEDUCIBLE + irreversible work (the contract, the distribution build,
the licensing gate, the a11y pattern catalog) is WATERFALLED up front (Phase 0); the per-component work is
spec-first then implemented in parallel (Phases 1-2); integration is gated by an HONEST, adversarial master
gate (Phase 3); adoption is last (Phase 4).

---

## Phase 0 — Foundation (serial, the irreversible deductibles; ONE owner, no fan-out)

Everything that, if wrong, makes every later component wrong. Waterfall it; do not parallelize.

1. **The architecture contract** (`00-architecture-contract.md`) — reviewed + locked by Francesco. This is
   the shared target; without it, fan-out diverges.
2. **The consumable-distribution build** (`01-distribution-consumable.md`) — the gating SPIKE: prove an
   adopter can precompile + render a lievit-ui primitive resolved FROM THE JAR (Path A or B), and prove the
   runtime publishes (npm or the git-dep bridge). Lock the choice in ADR `sw-architecture-007`. **Until this
   spike is green, "import-by-default" is unproven — do it FIRST.**
3. **The licensing gate** (`02-licensing.md`) — `/NOTICE` + `licenses/` + the `@provenance` header mandate +
   the doc-header lint + the packaging test, ALL in place. This is a one-way door (public redistribution);
   no component conversion starts until it is settled.
4. **The token extension** — any net-new tokens (the Tailwind-UI-grade refresh) added to `:root` + `.dark`,
   additive, byte-stable for the existing 31. Decide D1 (hex vs OKLCH).
5. **The a11y pattern catalog (the shared mechanisms)** — build + spec the THREE single-source mechanisms
   (`00` §2.b, `03` §4): the popover/overlay seam (exists from Wave 3, audit + harden it), `focus-trap.
   enhancer.ts` (NET-NEW), `collection-nav.enhancer.ts` (NET-NEW). These are built ONCE here so ~20
   components compose them in Phase 2 instead of hand-rolling. Each ships with its own axe + keyboard + focus
   tests. **This is the highest-leverage phase-0 work** — it is what prevents 20 divergent focus traps.

Exit gate: contract locked, distribution spike green + ADR written, licensing gate live in CI, tokens
extended, the 3 shared a11y mechanisms built + tested. Nothing component-specific yet.

---

## Phase 1 — Specs (per-component, parallelizable AUTHORING, ONE reviewable checkpoint)

Author one spec per component (`04-component-spec-template.md`), starting with the ~32 P0 set. Specs can be
DRAFTED in parallel (cheap, generation is cheap), but they converge at a single **REVIEW CHECKPOINT**:
Francesco (or an adversarial fresh-context pass) approves the P0 specs in batches BEFORE any P0 implementation.

Why a checkpoint here: the spec is the porta-a-senso-unico (the DESIGN is the irreversible part). A wrong
spec, fanned out to an implementation agent, produces a wrong component fast. Reviewing 32 short specs is far
cheaper than reviewing 32 implementations + their tests. The spec review catches: wrong tier choice, a
keyboard map that doesn't match the APG pattern, a variant vocabulary that drifts from the shared set, a
missing `@provenance`, a component that should compose a shared mechanism but re-specs it.

A spec that composes a shared mechanism is only APPROVABLE after that mechanism exists (Phase 0) — so the
dependency order is enforced, not nominal.

Exit gate: the P0 specs are reviewed + approved; P1/P2 specs follow the same loop in later batches.

---

## Phase 2 — Parallel implementation (one agent per COMPONENT, isolated worktrees)

Now fan out: ONE agent implements ONE component against its approved spec + the contract, in its own git
worktree (the hard rule from gest's CLAUDE.md: parallel sessions = one worktree each; the main checkout is a
sync surface, not a workbench). The granularity is the COMPONENT, not the file — because a component is
several files (Java + JTE + enhancer + tests) that must be coherent, and because the spec + contract make the
agent's job deterministic (implement, don't design).

Why component-granularity beats "one file each":
- a component's files are a unit (the WIRE Java + its JTE + its IT must agree); splitting by file would have
  three agents racing on one component's contract.
- the agent has a SPEC (Phase 1) + the CONTRACT (Phase 0) + the shared mechanisms (Phase 0), so it produces
  a CONVERGENT result, not a dialect.
- isolation = a worktree per agent = no two sessions on the main checkout (the collision the gest rule was
  born from).

The agent's loop per component: write the acceptance tests from the spec (RED) → implement minimal to GREEN
→ refactor green → run the component's gate (axe + keyboard + focus + JTE-compile + the wire IT). It does NOT
touch the shared registry.json (single-owner, regenerated once at integration), the shared enhancers (built
in Phase 0, frozen), or another component's files.

Exit gate per component: its spec's acceptance tests are green on a REAL substrate (not a mocked one).

---

## Phase 3 — Master integration + HONEST / ADVERSARIAL gate (the refute-by-default gate)

Integrate the component worktrees onto the integration branch, regenerate `registry.json` once, then run the
MASTER gate. This phase is where "green at all costs" is actively refused.

The master gate, refute-by-default (the lesson: "a passata is not complete until it produces a conclusion
that hurts"; "validating the lock is the default statistical outcome, near-zero information"):
1. **axe a11y, whole library**: every component's rendered DOM, zero violations of its cited rules. A
   component that passes axe on a TRIVIAL render but fails on a realistic one is not done.
2. **JTE real-compile + render**: the `test/jte-compile` real-compiler gate (ui + kit) — every `.jte`
   compiles AND renders the observable output (a compile-only gate cannot prove the chrome renders; the
   render gate does).
3. **real-runtime wire tests**: every WIRE component's IT runs the REAL `LievitRuntime` + the real morph +
   the real enhancer (NOT a mocked `$lievit`) — the client-island-fidelity rule: a test on a fake substrate
   certifies nothing. The slide-over empty-body + drag-wrong-verb bugs each HAD a passing test on a fake
   substrate; the master gate refuses that.
4. **adversarial verification of each "pass"**: for each component a fresh-context pass tries to REFUTE the
   green — does the render test assert the BODY is visible (projection) or just the structure? does the
   keyboard test assert the OBSERVABLE outcome or just that a handler exists? does the wire IT assert the
   re-rendered STATE or just that the action returned? A "pass" that survives the refutation is real; one
   that doesn't goes back to Phase 2.
5. **the licensing gate**: every component has `@provenance`; no Tailwind-UI code provenance; NOTICE +
   licenses ship in both artifacts.
6. **the distribution gate**: an adopter-shaped consumer (a throwaway project, or gest itself) imports the
   jar + npm artifacts and renders a primitive WITHOUT a copy — the import-by-default claim is proven end to
   end, not asserted.

The fix loop is **bounded by honest gates, not by green**: a red gate sends the component back to Phase 2
with the specific refutation; it does NOT get "fixed" by weakening the test (the hard rule: never weaken a
contract or delete an assertion to make a build pass). The loop terminates when every gate is green AND has
survived the adversarial pass — not when the runner prints BUILD SUCCESS.

Exit gate: the integrated library passes the master gate AND the adversarial pass; `registry.json`
regenerated + reviewed; the jar + npm artifacts build + are consumable by import.

---

## Phase 4 — Adoption (lievitKIT consumes by import, gest adopts ~90% lievitKIT)

1. **lievitKIT consumes lievit-ui by IMPORT** (not copy-in): the kit's families (`kit-table`, `kit-form`,
   …) compose the v-next primitives from the jar + npm artifacts. The kit's own `jte-compile` + render gate
   proves the composition renders.
2. **gest adopts ~90% lievitKIT by import** (RFC 0036 decision): gest de-vendors the lievit/kit copies
   (`apps/gest/src/main/jte/{lievit,kit}/**` + `frontend/src/lievit/**`), consumes the artifacts, keeps the
   anti-shadow guard active. Custom only for the ~10% lievitKIT does not cover (gest domain composition: the
   calendar page, the scaduta row, the activity forms — the primitives, never the domain compositions, are
   the import). This is the RFC 0036 staged execution, each stage green (the gest staging-first flow).
3. **the dogfood loop closes the right way**: a primitive improvement now flows UPSTREAM (fix in lievit,
   publish, bump the pin) instead of being buried in a gest copy — the whole point of RFC 0036.

Exit gate: lievitKIT + gest consume v-next by import; the vendored copies are gone; the anti-shadow guard
proves no silent divergence; the dogfood→extract loop is upstream-first.

---

## Why this beats "10 agents, one file each, just edit" (the explicit contrast)

| Naive approach weakness | v-next phase that fixes it |
|---|---|
| 10 agents diverge (10 dialects of variant/size/slot APIs) | **contract-first** (Phase 0) + **spec-first** (Phase 1): the agent implements an approved design, not its own |
| each hand-rolls a focus trap / roving listbox (10 subtly-wrong a11y impls) | **single-source-a11y** (Phase 0 shared mechanisms): ~20 components COMPOSE 3 sources |
| accidental Tailwind-UI / license contamination | **licensing gate first** (Phase 0) + `@provenance` per component + the CI grep |
| green-at-all-costs tests on fake substrates certify nothing | **honest/adversarial master gate** (Phase 3): real runtime, refute-by-default, no test-weakening |
| file-granularity races (3 agents on one component's contract) | **component-granularity** + **one worktree each** (Phase 2) |
| import-by-default asserted but never proven | the **distribution spike** (Phase 0) + the **distribution gate** (Phase 3) prove it end to end |
| "done" = BUILD SUCCESS | "done" = every gate green AND survived the adversarial pass (Phase 3) |

The throughput of parallel fan-out is REAL and kept (Phase 2 is genuinely parallel) — but it is throughput
toward a CONVERGENT, HONEST result, because the irreversible design is waterfalled (Phase 0-1) and the
integration is adversarially gated (Phase 3). Parallel where it's safe (reversible per-component impl),
serial where it's irreversible (contract, distribution, licensing, shared a11y).

---

## Open decisions for Francesco (workflow)

- **D14 — checkpoint owner**: who runs the Phase-1 spec review + the Phase-3 adversarial pass — Francesco
  directly, or a fresh-context adversarial agent with Francesco on the irreversible calls? Recommendation:
  agent-runs-the-pass, Francesco-approves-the-doors (specs + the distribution/licensing ADRs).
- **D15 — P0-only first cut**: ship v-next as the ~32 P0 set FIRST (a minimum MARKETABLE slice, excellently
  done — the MMP-not-MVP rule), then P1/P2 in later rounds? Recommendation: yes — a narrow excellent P0
  library that lievitKIT + gest fully consume beats a broad half-done 60. Flag.
- **D16 — gest cutover timing**: Phase 4 changes gest's build inputs (RFC 0036). It runs on Francesco's
  explicit go, staged, each green — NOT in autonomous nightly work (the RFC's standing constraint).
