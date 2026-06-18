# ADR-0076: Nested-component event listeners + HTML attribute forwarding

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

Two Livewire parity features sit on the same nested-component seam (ADR-0016) and share one capability
(capturing the attributes on a `<lievit:child>` tag that are not declared `@Wire` props):

- **Issue #69 — nested-component event listeners** (`SupportNestedComponentListeners`). A parent
  declares `@saved="refreshList"` on a child tag: the child emits a `saved` event, the parent handles
  it with its `refreshList` action.
- **Issue #71 — HTML attribute forwarding** (`$attributes` bag). HTML attributes on a child tag that
  do not match a child `@Wire` prop (`class`, `id`, `data-*`) are forwarded onto the child's root
  element, the parity any component library (alerts, buttons) expects.

Both must be captured at compile/mount time and survive a re-render.

## Decision

- **Compiler (lievit-compiler).** `LievitTagCompiler` recognizes a fourth attribute category on a
  `<lievit:child>` tag: `@event-name="handler"` is an **event listener** (captured into
  `CompiledTag.eventListeners`, event name kept in its authored kebab form since DOM events are
  case-sensitive), distinct from the existing literal / bound / reserved categories. It is not seeded
  as a prop. The compiler stays parse-only (a pure-data `CompiledTag`, no mounting, no evaluation).
- **Runtime declaration (lievit-core).** `ChildComponent` and `LievitChildren.child(...)` carry two
  new maps: `listeners` (event -> parent action, #69) and `attributes` (the forwarded HTML bag, #71).
  Both are optional and default empty, so every existing call site (props-only, slots) is unchanged.
- **Render (lievit-spring-boot-starter `ChildRenderer`).** On every child mount the renderer:
  - **#69**: stamps `lievit:on:<event>="<parentAction>"` on the child root for each declared listener
    (the up-leg marker, the same shape as `lievit:modelable`). The client routes the bubbled child
    event to the parent handler.
  - **#71**: merges the forwarded attribute bag onto the child root: `class` is appended to the
    child's own class (the merge), any other attribute is added; an attribute that names a declared
    `@Wire` prop is skipped (it was seeded as a prop, not forwarded).
- **Survive a re-render** is by re-injection: the parent re-declares its children (with the same tag
  attributes) on every render (ADR-0016), so the renderer re-stamps the listeners/attributes each
  render. No child-owned memo is needed; this is the same mechanism reactive props already use.

## Consequences

- The server-side acceptance of both issues is complete and tested through the real wire pipeline:
  the listener marker and the merged attributes appear on the child root on mount and survive a
  re-render.
- **#71 is fully closed.** The standard morph applies whatever attributes are on the child root, so
  the forwarded bag needs no new client code.
- **#69 client listener dispatch is the remaining piece.** The client routing of a bubbled child
  event to the parent's `lievit:on:<event>` action is the same client-glue layer as the modelable
  up-leg (ADR-0016): both are markers the sibling client bundle consumes, and neither the modelable
  up-leg nor this listener dispatch is in lievit-ui yet. This ADR fixes the marker contract
  (`lievit:on:<event>="<parentAction>"`); the client dispatch lands with that layer.
- The seven-annotation cap holds: both features are tag-attribute + runtime-API, no new annotation.
- The compiler tag→`LievitChildren.child(...)` lowering is still the render layer's job (no lowering
  is wired into a template adapter today, ADR-0016/ADR-0023); the new `CompiledTag.eventListeners`
  field is the data that lowering will pass to the new `LievitChildren.child(...)` overload.

## Alternatives considered

**Capture the `$attributes` split in the compiler.** Rejected: the compiler is prop-agnostic (it has
no `ComponentMetadata` at parse time, so it cannot know which attributes are `@Wire` props). The
prop-vs-attribute decision belongs in `ChildRenderer`, which has the metadata; the compiler only
captures the unambiguous `@event` listeners.

**A child-owned memo for the listeners/attributes.** Rejected: the parent re-declares the child each
render, so re-injection at mount is simpler and already the established mechanism for reactive props
(ADR-0016). One mechanism, not two.

## Cross-references

- ADR-0016 — nested components, the `lievit:modelable` up-leg marker this mirrors, the re-declaration
  mechanism that makes the markers survive a re-render.
- ADR-0023 — the tag compiler + the compiler→render lowering boundary.
- ADR-0002 — the seven-annotation cap (held: tag attributes + runtime API).
