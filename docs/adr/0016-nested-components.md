# ADR-0016: Nested components (keyed children, reactive props, modelable two-way bind)

- **Status:** accepted
- **Date:** 2026-06-17
- **Deciders:** Francesco Bilotta

## Context

A real app composes components: a list renders a row per item, a form renders field components, a
page renders a sidebar and a table. ADR-0001 specified a single component's mount/render/call
lifecycle and explicitly left a "`children`-style client-may-mutate carve-out in the signed payload"
open (ADR-0001 amendment, out-of-scope item 3). This ADR closes the composition question.

Livewire's model is the reference: a parent renders children via `<livewire:child ... />`, each child
is a **first-class, independent component** the parent references by a stable `key`, props flow
parent → child and re-render the child on change, and a `#[Modelable]` child field two-way-binds to a
parent property (`wire:model` on a custom input). The morph keys children by `key` so a re-render
neither thrashes the DOM nor loses child state / focus.

Three forces shape the lievit answer:

1. **The seven-annotation cap (ADR-0002).** Nesting, `@key`, props, and modelable must ship **without
   an eighth annotation**. This is the same constraint `locked` (ADR-0001 amendment) and the effects
   channel (ADR-0012) met: a `@LievitProperty` attribute or a runtime API, never a new annotation.
2. **The statelessness invariant (ADR-0001).** A child must not become a fragment of the parent's
   snapshot, or the parent's 16 kb snapshot budget would absorb the whole subtree and a child could
   no longer be driven independently. A child must carry **its own** signed snapshot.
3. **The payload hardening (ADR-0013).** Props are a new inbound-shaped surface (a parent passing a
   value down). They must pass the same deserialization allowlist and structural caps as a client
   update, and nesting depth must be bounded against a render cycle.

## Decision

A child is an **independent component, mounted at render time, referenced by a stable key**. Nesting
is a render-time composition concern, not a snapshot-schema change: the wire protocol (ADR-0001), the
snapshot schema, and the codec are **unchanged**. Each child gets its own `cid`, its own signed
snapshot, and its own HTML, inlined into the parent's markup.

### Declaring children: a runtime sink, not an annotation

A parent declares its children during render through a request-scoped sink, mirroring
`LievitEffects` (ADR-0012): `LievitChildren.current().child(key, ChildClass.class, props)`. It returns
a placeholder token (`<!--lievit:child:KEY-->`) the parent's template renders where the child
belongs. The sink is bound by the `WireDispatcher` around every mount and re-render and cleared in a
`finally`, so nothing survives between stateless calls. This keeps the public surface at seven
annotations: a parent composes via a runtime call, exactly as it redirects via a runtime call.

Keys are unique within one parent render (a duplicate is a hard error: it is the morph-identity bug).

### Mounting children + the client-glue contract

`LievitWireService` (web layer) drives the substitution via `ChildRenderer`: for each declared child
it mounts an independent component (props seeded first, see below), renders its HTML, recurses into
the child's own children, signs the child's own snapshot, and replaces the parent's placeholder with
the child's HTML. The child's root element is stamped with the markers the sibling **client-glue
bundle** consumes:

- `data-lievit-snapshot` — the child's signed snapshot (so the client drives the child's own wire
  calls, the same attribute the host page stamps on a top-level component);
- `lievit:key` — the stable `@key` (so the morph identifies the child across the parent's re-renders
  and preserves its DOM, focus, and uncontrolled state);
- `data-lievit-id` — the child's `cid` (the endpoint path component);
- `lievit:modelable="<childField>:<parentProp>"` — present only on a modelable child, the up-leg
  routing of the two-way bind (below).

### Reactive props: parent → child

A parent passes props as a `Map<String, Object>` to `child(...)`. The `WireDispatcher` seeds them
onto the child's `@Wire` fields **before** the child's `@LievitMount` runs (so the mount hook can
derive state from a prop). Props honor the **settable allowlist** (ADR-0013): only a `@Wire` field is
seeded, a prop naming anything else is dropped. Props pass through `PayloadGuard.checkSnapshotWire`,
so a parent passing an opaque object down is the same `forbidden-deserialization` (422) a client
update would be. A prop **may** target a `locked` field: the parent is server-side, and `locked`
stops the *client*, not the owning parent. A prop change re-renders the child because the parent
re-declares its children with current props on every re-render.

### Modelable: child → parent two-way bind

`@LievitProperty(modelable = true)` marks a child field as the parent-bound value (Livewire
`#[Modelable]` parity), expressed on the existing seventh annotation (no eighth). At most one
modelable field per component; a modelable field cannot also be `locked` (a server-owned field is not
a two-way bind); both are enforced at reflect time. The **down-leg** is an ordinary prop (the parent
passes its value as the child's modelable field). The **up-leg** is a client-glue concern: the parent
names the bound property via the `_modelable` prop, the renderer stamps `lievit:modelable` on the
child root, and the client routes the child's modelable change back up to the parent's bound property
as an `_updates` entry on the parent's next call. The server stays stateless: it seeds down and emits
the routing marker; the client wires the two independent components together.

### Bounded depth

A child may declare grandchildren (its render binds a fresh sink). Depth is capped at
`lievit.max-nesting-depth` (the existing ADR-0013 cap, default 10): a render cycle deeper than the cap
is a `PAYLOAD_TOO_COMPLEX` (413), not a stack overflow.

## Consequences

- **The wire protocol, snapshot schema, and codec are unchanged.** Nesting is render-time
  composition. The codec gains only tests proving independent parent/child snapshots roundtrip; the
  `SnapshotCodec` itself is untouched.
- **Per-component statelessness holds.** A child carries its own snapshot, so a 2000-row list is 2000
  independently-driven components, not a 16 kb-busting parent snapshot. Each child scales out / to
  zero like any component.
- **The seven-annotation cap holds (ADR-0002).** `LievitChildren` is a runtime API (like
  `LievitEffects`); `modelable` is an attribute on `@LievitProperty` (like `locked`). No new
  annotation.
- **Security is inherited, not re-derived.** Props ride the ADR-0013 allowlist + caps; depth is the
  ADR-0013 nesting cap; each child's wire endpoint inherits the page's security context (ADR-0014)
  exactly as a top-level component does.
- **The client-glue bundle owns the morph + the up-leg routing.** This ADR fixes the marker contract
  the sibling bundle consumes (`lievit:key`, `data-lievit-snapshot`, `data-lievit-id`,
  `lievit:modelable`); the morph keying and the child→parent update dispatch are the bundle's job.
- **`WireCall` and `WireDispatcher.mount` changed shape** (a non-breaking surface for the public API,
  but a touch on the core seam): `mount` now returns a `WireCall` (wire + effects + children) and
  `WireCall` carries `children`. Internal to the core/starter seam; no public annotation moved.

## Alternatives considered

**Children as a `children` carve-out in the parent's signed snapshot (the ADR-0001 open item, the
naive Livewire-ish read).** Embed each child's state in the parent's `wire`, client-mutable. Rejected:
it breaks the per-component statelessness and the 16 kb budget (a subtree's state lands in one
snapshot), and it reintroduces the client-trusts-state problem the signature exists to kill — a child
field would be client-settable inside the parent payload, outside the child's own allowlist. An
independent child snapshot is strictly safer and scales.

**A `@LievitChild` / `@LievitKey` annotation pair.** The obvious surface, and the readable one.
Rejected: it breaks the ADR-0002 cap. The runtime sink gives the same ergonomics (`child(key, Cls,
props)`) at zero annotation cost, consistent with how `LievitEffects` and `locked` were added.

**Server-side child→parent propagation (modelable up-leg on the server).** Have the parent's render
read the child's mutated state and fold it back. Rejected: it would require the parent to hold or
re-fetch child state, breaking statelessness, and it couples two components that are independent on
the wire. The up-leg is a client routing of one component's event into another's `_updates`, which is
exactly the cross-component bus the effects channel (ADR-0012) already established.

**A separate `lievit.max-child-depth`.** A new knob for the same concern the ADR-0013 nesting cap
already covers. Rejected: reuse `lievit.max-nesting-depth`; one concept, one knob.

## Cross-references

- ADR-0001 — the wire protocol and the open `children` carve-out this ADR closes (kept independent,
  not a payload carve-out).
- ADR-0002 — the seven-annotation cap (held: runtime sink + `@LievitProperty` attribute).
- ADR-0012 — the effects channel + the `LievitEffects` runtime-sink pattern this mirrors, and the
  cross-component `dispatch` bus the modelable up-leg rides.
- ADR-0013 — the settable/deserialization allowlist + structural caps props and depth inherit.
- ADR-0014 — the per-call security context each child's wire endpoint inherits.
- wire-protocol.md — unchanged by this ADR (composition is render-time).
