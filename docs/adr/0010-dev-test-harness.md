# ADR-0010: `Lievit.test()` — the developer-facing component test harness

- **Status:** accepted
- **Date:** 2026-06-17
- **Deciders:** Francesco Bilotta

## Context

This ADR is about the testing experience lievit gives to a developer **building an app on lievit**
who wants to test **their own** `@LievitComponent`. It is not about lievit's internal test suite
(codec, lifecycle, property-based, fuzzing) — that is ADR-0007, and from the user's seat it is
invisible magic. The full evidence and design rationale are in
`docs/research/dev-testing-dx.md`; this ADR records the decision.

Livewire ships a strong first-party component tester, `Livewire::test()`, that runs a component
headless and asserts state, actions, validation, events, view data, redirect, and auth
(`~/tmp-livewire/docs/testing.md:200-528`). But it exercises only the **PHP** side of the
roundtrip. A meaningful slice of the user's *own* component behaviour is reachable only in a slow,
flaky real-browser tier (`Livewire::visit()` over Playwright, `docs/testing.md:89-128`):

- `wire:model` update-timing (`.live`/`.lazy`/`.blur`/`.debounce`) is client-side JS
  (`docs/wire-model.md:53-55`, `js/directives/wire-model.js:31-44`); `set()` bypasses it.
- Morph DOM-identity preservation — the canonical "green test, broken page" (`docs/morph.md:1-53`).
- `data-loading` / `wire:dirty` visual states, which exist only during a real in-flight window
  (`docs/loading-states.md:1-28`, `docs/dirty.md:1-32`).
- The checksum-failure rate limit is **silently disabled inside unit tests**
  (`Checksum.php:31`: `if (app()->runningUnitTests() && …) return;`), so the security behaviour is
  not exercised by the component test at all.
- The `#[Locked]` defense exists, but the testing doc has no first-class assertion for "a client
  tamper of a locked property was rejected"; asserting it from the attacker's seat is awkward.

lievit's architecture happens to make most of this server-side and therefore headlessly testable:
the wire is server-driven and typed (ADR-0002), deterministic and inspectable (`{cid,cls,wire,iat,
exp}` + `Lievit-Snapshot`, ADR-0001 / `wire-protocol.md`), and the security boundary (locked-field
rejection, the `ChecksumFailureLimiter`) is on the real call path, not short-circuited in tests.
The precedent already exists — `CounterRoundtripIT` is a user-style test today — but it is verbose
(hand-built JSON maps, raw `MockMvc`, string-grep). The opportunity is to make that proven path
ergonomic and ship it as a **product feature**, not leave it as boilerplate every user re-derives.

## Decision

lievit ships a developer-facing test harness, `dev.lievit.test.Lievit.test(Class)`, in
`lievit-spring-boot-starter` at test scope, documented as a feature. It is the lievit answer to
`Livewire::test()`, designed to pull behaviour out of the browser tier.

- **Entry point:** `Lievit.test(MyComponent.class)` returns a fluent tester that mounts the
  component through the **real** wire pipeline (codec → registry → dispatcher → template adapter →
  HTTP edge) and chains `.mount()` → `.model(field, value)` → `.call(action)` → assertions. The
  signed snapshot is carried across calls internally; the user never touches the JWT string.
- **Assertion surface:** `assertWire(path, value)` (typed state read-back, dotted navigation),
  `assertWireMatches(predicate)` (typed predicate over the real instance), `assertSee` /
  `assertDontSee` / `assertSeeHtml` / `assertSeeInOrder` (real re-rendered HTML),
  `assertSnapshotRotated` / `assertSnapshotValid`, and `assertRejected(<reason>.class)` for the
  error-code state machine — including `LockedProperty` (403, attacker's seat) and `TooManyFailures`
  (429), the two Livewire cannot reach from its component tester.
- **Hostile-input affordances:** `tamperUpdate(field, value)` (a client `_updates` entry for a
  locked field) and `forgeSnapshot()` (drive the HMAC/rate-limit path), so the security defenses are
  asserted headless, from the attacker's seat.
- **One annotation:** `@LievitTest` is a meta-annotation bundling the `@SpringBootTest` slice, the
  dev signing key, and `MockMvc` autoconfig, replacing the four-annotation header on
  `CounterRoundtripIT` today. `@LievitTest` is a **test-scope** annotation and does **not** count
  against the seven-annotation public cap (ADR-0002): the cap governs the runtime authoring API, not
  the test-fixtures surface.
- **Testability ladder (documented, three tiers):** tier 1 = pure unit of the user's own logic (no
  framework); tier 2 = `Lievit.test()` component round-trip (the fat tier, headless, absorbs most of
  Livewire's browser-only column); tier 3 = the minimal browser E2E that truly remains (Idiomorph
  identity preservation, real debounce timing, loading/dirty visuals during an in-flight window,
  upload client protocol), happy-path, located by role/text (ADR-0007), edge cases stay in tier 2.
- **Failure messages are load-bearing DX:** every message names the call sequence that produced the
  state (`expected @Wire count == 1 but was 0 after calls [increment]`).

Relationship to ADR-0007: that ADR is lievit's *own* quality gate (golden triples, property-based,
fuzz) — the invisible correctness of the runtime. This ADR is the *user's* testing feature. They are
complementary; ADR-0010 does not supersede ADR-0007.

## Consequences

- **The line moves.** Behaviour Livewire forces into a flaky browser (locked-field tamper, the
  rate-limit, `l:model` intent, the full error-code state machine) becomes a fast, deterministic,
  headless tier-2 assertion. The "green test, broken page" surface shrinks to the four irreducibly
  browser-bound behaviours, and the docs say *why* each tier-3 test is irreducible.
- **Boilerplate disappears.** Users stop re-deriving the `CounterRoundtripIT` plumbing (JSON maps,
  raw `MockMvc`, snapshot juggling); they write intent.
- **The harness becomes part of the public contract** and must be tested and versioned like one (it
  has its own tests; it is dogfooded by rewriting `CounterRoundtripIT` on top of it). That is added
  surface to maintain — accepted, because a delightful test DX is a primary adoption lever for the
  "ex-Livewire migrant" ICP.
- **Two capabilities are gated on open questions** (see below): `assertModelLive` /
  `assertModelDeferred` depend on exposing parsed template binding metadata to test code, and the
  harness's module home ties into ADR-0008 (still proposed).

## Alternatives considered

**Leave it as raw `MockMvc` + the `LievitWireService` API (status quo).** Zero new surface, and it
already works (`CounterRoundtripIT`). Rejected: it is exactly the boilerplate that makes Livewire's
own users reach for the simpler-but-weaker path, and a verbose test DX undercuts the "delightful,
ex-Livewire-grade" positioning. The plumbing is mechanical; hiding it is the feature.

**A pure-unit-only story (test components as plain Java classes, skip the wire).** Fastest, but it
abandons the whole differentiator: the behaviours worth testing headless (locked-field rejection,
the snapshot roundtrip, the error-code state machine) only exist *over the wire*. A plain-Java test
of `increment()` is tier 1 and stays — but it cannot be the only tier.

**A heavier browser-first harness (lievit-flavoured `Livewire::visit()`).** Maximal realism, but it
re-imports Livewire's flakiness and slowness as the default. Rejected as the *primary* tier; the
thin tier-3 browser layer is kept for the four irreducible behaviours only.

**An eighth runtime annotation for test wiring.** Rejected on sight: ADR-0002 caps the runtime
public API at seven annotations. `@LievitTest` is test-scope and outside that cap, by the same logic
that keeps `locked` a `@LievitProperty` attribute rather than a new annotation (ADR-0001 amendment).
