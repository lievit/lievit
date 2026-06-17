# ADR-0019: The client runtime bundle (wire glue, bespoke morph, extension points)

- **Status:** accepted
- **Date:** 2026-06-17
- **Deciders:** Francesco Bilotta

## Context

ADR-0001 fixed the *server* side of the wire (stateless HTTP, signed snapshot, `text/html` body +
headers) and ADR-0012 added the `Lievit-Effects` channel. The *browser* side was specified
(wire-protocol.md §5: bind `l:*`, POST the snapshot, morph the DOM, apply effects) but not built:
only the effects-channel consumer (`runtime/effects.ts`) existed. Nothing turned a `l:click` into a
wire call, and there was no morph implementation.

This is the foundational client layer every later client feature builds on (loading/dirty
indicators, `wire:navigate`, polling, `wire:ignore`). If those features have to edit one monolithic
bundle, every one of them is a merge conflict and a regression risk. The bundle therefore has to
ship its extension points as a first-class, documented API, not as an afterthought.

Two sub-decisions inside this layer needed settling: **how to morph** (ADR-0001 said "Idiomorph
directly"), and **where the client reads the snapshot** (wire-protocol.md §1 phase 2 said "a data
attribute on the component root, e.g. `data-lievit-snapshot`", but no attribute name was fixed and
the server returns the snapshot in the `Lievit-Snapshot` *header*, so the client needs a defined
place to read the *initial* one and to stash each rotation).

## Decision

Ship a small, dependency-free, strict-CSP-safe ES-module bundle under `lievit-ui/runtime/`, composed
of five single-purpose modules plus the existing effects consumer:

- `wire.ts` — serialize a call, `POST /lievit/{id}/call`, decode `200` (html + `Lievit-Snapshot` +
  `Lievit-Effects`) or a fail-closed failure (status + `Lievit-Reason` + a re-mount flag for
  `409`/`410`). Sends the CSRF token as a header so Spring Security's filter validates it.
- `morph.ts` — a **bespoke** identity-preserving DOM morph (see below).
- `directives.ts` — a **directive registry** (extension point) + the v0.1 built-ins
  (`l:click`, `l:submit`, `l:keydown[.key]`, `l:model[.live|.lazy|.blur|.debounce.Nms]`).
- `lifecycle.ts` — a **lifecycle hook bus** (extension point): `onComponentInit`, `onModelChange`,
  `beforeCall`, `afterCall`, `onError`, fail-soft (a throwing hook never aborts a call).
- `runtime.ts` — the orchestrator: binds components, runs the call loop, owns per-component snapshot
  + pending deferred `l:model` updates, exposes `directives` and `lifecycle`.
- `index.ts` — the public barrel; `startLievit()` is the `main.ts` entry point.

### Bespoke morph instead of vendoring Idiomorph (amends ADR-0001)

ADR-0001 chose "Idiomorph directly". This ADR **amends that to a bespoke morph that follows the same
principle** ("morph, do not replace innerHTML; preserve node identity"). Rationale: vendoring a copy
of Idiomorph adds a third-party file to a bundle whose whole positioning is "small, zero framework
deps" (README: 60-80 kb target), and pulling it as an npm dependency reintroduces a supply-chain and
license surface lievit is built to avoid (Apache-2.0, no data egress). The bespoke morph is ~150
lines: keyed reuse (`id`, then `name`), positional matching otherwise, in-place text/attribute
reconciliation, and uncontrolled form-state preservation (what the user typed survives a re-render
that did not address it). The *contract* ADR-0001 cares about (focus/selection/input survive the
patch) is unchanged; only the implementation is lievit's own. If a future need outgrows the bespoke
morph, swapping in Idiomorph (BSD-3, Apache-compatible) behind the same `morph(root, html)` seam is a
reversible, one-file change.

### The component root attributes (fixes the snapshot-location gap)

The server renders three attributes on a component root, which the client reads on the initial scan:

- `data-lievit-component="<FQN>"` — marks a root (already rendered by the test templates).
- `data-lievit-id="<cid>"` — the component instance id (the endpoint path segment).
- `data-lievit-snapshot="<signed snapshot>"` — the **initial** signed snapshot.

After each successful call the client stashes the rotated snapshot back onto `data-lievit-snapshot`
(after morphing, since the re-rendered body carries no snapshot attribute — the snapshot rides the
`Lievit-Snapshot` header, never the body). This formalizes wire-protocol.md §1 phase 2's
"e.g. `data-lievit-snapshot`" into the fixed attribute names above. The server-side rendering of
`data-lievit-id` / `data-lievit-snapshot` on mount is a follow-up (the mount currently returns the
snapshot only in the header; the page template must also stamp these attributes for the client to
pick up the first snapshot). The client contract is fixed here so that work has a target.

### Extension API (the point of the layer)

Two registries, both reached from the started runtime:

```ts
const lievit = startLievit({ csrfToken, csrfHeader });

// 1. a new l:* directive — no core edit
lievit.directives.register({
  name: "navigate",
  bind(el, _attr, value, rt) { el.addEventListener("click", () => rt.callAction(el, value)); },
});

// 2. a lifecycle hook — loading/dirty/navigate features subscribe here
lievit.use({
  beforeCall: ({ root }) => root.setAttribute("aria-busy", "true"),
  afterCall:  ({ root }) => root.removeAttribute("aria-busy"),
  onError:    ({ reason }) => toastError(reason),
});
```

A built-in directive is registered through the same `DirectiveRegistry`, so it holds no privilege a
third-party one lacks: the registry IS the API.

## Consequences

- **Batch-2 features plug in without touching the core.** `wire:navigate` is a directive +
  `afterCall` hook; loading/dirty is a `beforeCall`/`afterCall` pair; `wire:ignore` is a directive
  that skips the morph subtree (a small morph hook is the only core change it will need); polling is
  a directive that schedules `callAction`.
- **Zero runtime deps, strict-CSP-safe.** No `eval`, no inline handlers, an external module file.
  The bundle stays inside the 60-80 kb budget (README positioning).
- **Backward compatible with the server.** No server contract changed except the now-fixed root
  attribute names; a no-effects call is still the ADR-0001 response. The bespoke morph is invisible
  to the server.
- **The morph is lievit's to maintain.** A bespoke morph is a small ongoing surface; it is covered
  by unit tests (keyed reuse, attribute reconciliation, text-in-place, form-state preservation) so a
  regression is caught fast. The Idiomorph escape hatch behind the `morph()` seam stays open.
- **One open follow-up:** the server must stamp `data-lievit-id` + `data-lievit-snapshot` on the
  initial render (today only the `Lievit-Snapshot` header carries it). Tracked as the next client
  task; the attribute contract is frozen here.

## Alternatives considered

**Vendor Idiomorph (ADR-0001 as written).** The literal ADR-0001 choice. Rejected for v0.1 of the
bundle: it adds a third-party file / dependency to a deliberately dep-free, small bundle, for a morph
whose contract a ~150-line bespoke implementation meets. Kept as a documented escape hatch behind the
`morph()` seam.

**One monolithic bundle, features edit it.** Rejected: it makes every later client feature a diff
against the hot path and a merge magnet. The registry + hook bus cost a little structure now and buy
conflict-free extension later (the explicit intent of this deliverable).

**Read the snapshot from a JS variable / inline script.** Rejected: it violates the strict-CSP-no-
inline-script posture (repo convention + wire-protocol.md). A data attribute on the root is CSP-safe
and co-located with the component it belongs to.
