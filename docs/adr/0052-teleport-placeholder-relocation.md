# ADR-0052: `l:teleport` — placeholder-in-place DOM relocation, client-only

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

Issue #115 asks for `@teleport` parity (Livewire `SupportTeleporting`, Vue/Alpine `x-teleport`): a
fragment of a component's DOM renders elsewhere on the page (typically `body`) so a modal / tooltip /
dropdown escapes an `overflow` / `z-index` container, while the fragment stays OWNED by its
component (its `l:*` directives bind, it updates reactively, it survives the morph, multiple
teleports coexist).

The research note `docs/research/livewire-design-decisions-complete.md` (§L) already recorded the
house stance: lievit has no Alpine, so `@teleport` "would use a Lit/DOM teleport if needed". The hard
constraint is lievit's bespoke morph (ADR-0019): the morph walks a component root's subtree toward
the server markup and removes live nodes the new markup does not account for. A naive "move the node
to `body`" relocation puts the fragment OUTSIDE the root the morph reconciles, so the next re-render
would see it missing and the relocated copy would go stale or be orphaned.

## Decision

Ship `l:teleport="<target-selector>"` as a **client-only** feature (`lievit-ui/runtime/features/
teleport.ts`), registered through the ADR-0019 extension API (directive registry + `afterCall`
lifecycle hook), never editing the core or the morph. The server treats `l:teleport` as an ordinary
attribute and renders the element WITH its content in place.

**Placeholder-in-place relocation:**

- The `l:teleport` element itself STAYS in the component subtree as an empty **anchor**. The morph
  keeps reconciling that anchor against the server markup on every call (the server always re-renders
  the teleport element with its content in place), so reactivity rides the normal render path. The
  morph never sees the relocated nodes, so it never fights the relocation.
- A single **sync** path moves the anchor's current children to the target and removes the
  previously-relocated set: it runs on initial `bind` and after every wire call via `afterCall`. The
  runtime re-scans + binds the freshly-morphed anchor BEFORE `afterCall` fires (runtime.ts call
  order), so the relocated nodes carry live directive bindings; a DOM move preserves event listeners,
  so events + reactivity are intact at the target.
- Anchors are tracked by **element identity** (a `Map<Element, …>`), never by a DOM marker
  attribute. The morph strips an attribute the server did not re-render, so a marker would make the
  post-morph re-scan re-bind (and re-relocate) the same anchor twice. Re-binding a tracked anchor is
  a no-op.
- Each `l:teleport` tracks its own relocated set, so multiple teleports to the same target do not
  stomp each other.

**Fail-soft:** a target selector that matches nothing leaves the content in place rather than
dropping it. The feature is strict-CSP-safe (no inline handler, no eval).

## Consequences

- No server change and no morph change: `l:teleport` is additive and reversible (uninstall pulls
  every relocated fragment back to its anchor).
- The relocation cost is one DOM move per teleport per wire call (the stale set is removed, the fresh
  set moved). For the modal/tooltip cardinality this targets, that is negligible.
- The "owned by the component" contract holds because the anchor is the morph's source of truth: the
  fragment's identity, state, and bindings always come from the in-place render, the target only
  hosts the live nodes.
- A future need (e.g. teleporting a Lit island that must not be re-moved each call) can refine the
  sync to diff-before-move behind the same `installTeleport` seam without a contract change.

## Alternatives considered

**Move the node and add a morph hook to keep it.** Use `morphWith` to mark the relocated subtree
`skip` so the morph leaves it alone. Rejected: the relocated node is outside the root subtree the
morph walks, so a morph hook never sees it; and freezing it would also freeze reactivity, defeating
the "updates reactively" AC.

**Mirror: keep the element in place AND render a synced copy at the target.** Rejected: it doubles
the DOM and duplicates event wiring, and keeping two trees in sync is exactly the bespoke-morph
surface this avoids. The placeholder-in-place approach keeps a single live tree.

**A server-side compiled relocatable template (the issue's first AC bullet).** Deferred: lievit
renders the teleport element in place and the client relocates, which already satisfies the
client-facing ACs (reactive updates, events, multiple teleports, morph survival) without a compiler
or render-pipeline change. If a future SFC compiler wants to emit a distinct relocatable node, it can
target the same client contract.
