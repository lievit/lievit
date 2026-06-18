# ADR-0080: Client glue for nested-component event listeners + the modelable up-leg

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

Two nested-component features (ADR-0016, ADR-0076) shipped their server half but were left with the
same unimplemented client-glue layer:

- **Nested-component event listeners (#69, ADR-0076).** The compiler captures `@event="action"` on a
  `<lievit:child>` tag into `CompiledTag.eventListeners`, and `ChildRenderer` re-injects
  `lievit:on:<event>="<parentAction>"` onto the child root on every render. The marker contract is
  fixed; nothing in lievit-ui consumed it, so a child that dispatched the event never drove the
  parent's declared action.
- **The modelable up-leg (#69 / ADR-0016).** A `@LievitProperty(modelable=true)` child field
  two-way-binds to a parent property. The down-leg is an ordinary prop the parent seeds; the up-leg
  is a client routing: the renderer stamps `lievit:modelable="<childField>:<parentProp>"` on the
  child root, and the client must route the child's modelable edit back up to the parent's bound
  property. No lievit-ui code read the marker, so the bind was one-way (down only).

Both are the same shape as the already-shipped `$parent.action()` client glue (#67): resolve the
enclosing parent by the same up-the-DOM-tree walk, then drive it. They differ only in the trigger and
the payload.

## Decision

Both routings live in `LievitRuntime`, reusing the existing parent-resolution walk
(`parentElement.closest([data-lievit-component])`) and the existing per-component commit machinery. No
new wire-protocol field, no server change, no new annotation.

- **Nested-event listeners (`routeNestedListeners`).** After a component's `dispatch` effects are
  routed to the `@LievitOn` bus (`routeDispatchedEvents`), the runtime checks the dispatching
  component's own root for a `lievit:on:<event>` marker matching each dispatched event name (matched
  verbatim, the server keeps the authored kebab form). On a match it invokes the named action on the
  enclosing parent via the existing `$lievit.$parent.$call(action)` path, which issues a wire call
  against the parent endpoint with `_calls: [action]`. It is independent of the `@LievitOn` bus: that
  delivers an event to a component's listener *methods* via `_events`; this invokes a regular parent
  *action*. A dispatched event may legitimately drive both; the two paths do not interfere.

- **Modelable up-leg (`propagateModelable`).** In `setModel` (the single funnel every `l:model` edit
  passes through), after the child records its own edit the runtime reads the child root's
  `lievit:modelable="<childField>:<parentProp>"` marker. When the edited field is `<childField>` it
  mirrors the value onto the parent's `<parentProp>` as a **deferred** update (`setModel(parent,
  parentProp, value, false)`), so the value rides the parent's *next* wire call rather than firing one
  of its own (ADR-0016: "an `_updates` entry on the parent's next call"). A non-modelable child, a
  top-level component, or an edit to any other field is a no-op.

## Consequences

- Both client-glue items ADR-0016 and ADR-0076 flagged as "the remaining piece" are now in lievit-ui;
  #69 is fully closed (server + client) and the ADR-0016 two-way bind is closed in both legs.
- The change is confined to lievit-ui (`runtime/runtime.ts` + two test files). No server, no wire
  protocol, no annotation surface moved (the seven-annotation posture and ADR-0030's `@LievitOn` are
  untouched).
- The parent-resolution walk is now used by three client features (`$parent` #67, nested listeners
  #69, modelable up-leg). It stays one mechanism; a future change to parent resolution changes one
  place.
- CSP-safe: no eval, no inline handlers; the routings are direct method calls on resolved roots.

## Alternatives considered

**Route the nested listener through the `@LievitOn` `_events` bus instead of a parent action.**
Rejected: ADR-0076 fixes the marker as `lievit:on:<event>="<parentAction>"`, where `<parentAction>` is
a regular `@LievitAction`, not a listener method. Sending it as `_events` would require the parent to
declare an `@LievitOn`, which is a different feature; the declarative tag listener must invoke the
named action directly, matching Livewire's `@saved="refreshList"`.

**Commit the modelable up-leg immediately (`sendNow=true`).** Rejected: ADR-0016 specifies the value
rides the parent's *next* call as an `_updates` entry, not its own request. A deferred update keeps the
child edit from triggering an extra parent round-trip and matches the down-leg's "re-declared each
render" cadence.

## Cross-references

- ADR-0016 — nested components, the `lievit:modelable` up-leg marker this consumes.
- ADR-0076 — the `lievit:on:<event>` listener marker this consumes; the client dispatch it deferred.
- ADR-0030 — the `@LievitOn` event bus this routing sits beside (independent paths).
- #67 — the `$parent.action()` client glue whose parent-resolution walk both routings reuse.
