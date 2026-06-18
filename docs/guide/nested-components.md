# Nested components

A component can mount other components as children: keyed, with reactive props down and an optional
two-way modelable bind back up. Each child is an **independent** component with its own id, its own
signed snapshot, and its own lifecycle, so the stateless invariant holds at every level
([ADR-0016](../adr/0016-nested-components.md)).

## Mounting a child in a template

The parent declares each child during its render through a request-scoped sink (the same shape as
`LievitEffects`), which returns a placeholder the parent renders where the child belongs:

```java
// in the parent's @LievitRender, or inline in JTE
String slot = LievitChildren.current().child("row-0", RowComponent.class, Map.of("label", "Alpha"));
// slot == "<!--lievit:child:row-0-->"
```

```java
// lievit-core test: LievitChildrenTest — children collect in render order, keyed
LievitChildren children = new LievitChildren();
children.child("row-0", Row.class, Map.of("label", "a"));
children.child("row-1", Row.class.getName(), Map.of("label", "b"));
// children.declared() has 2 entries, in order; declared().get(0).key() == "row-0"
```

The wire layer mounts each declared child as an independent component and substitutes its rendered
HTML into the placeholder. On the child's root it stamps the contract the client bundle consumes:

- `data-lievit-id` / `data-lievit-snapshot` — the child's own id and signed snapshot (so the child
  makes its own wire calls).
- `lievit:key` — the stable key, so the morph identifies the child across the parent's re-renders
  (preserving the child's DOM, focus, and uncontrolled input state).
- `lievit:modelable="<childField>:<parentProp>"` — present only on a modelable child (below).

Keys must be unique within one parent render: a duplicate key is the morph-identity bug (two children
the client cannot tell apart), so it is a hard error, not a silent overwrite.

## Mounting a child with the compiled tag (ADR-0023)

The compiler (`lievit-compiler`) gives the Livewire `<livewire:...>` ergonomics: a `<lievit:...>` tag
in the template compiles down to a `LievitChildren.child(...)` call. It parses the component name
(kebab → camelCase), bound attributes (`:label="expr"`), literal attributes (`label="text"`), an
explicit key (`wire:key` / `l:key` / `key`), and reserved params (`lazy`, `defer`, `l:ref`):

```html
<lievit:row :label="item.name()" wire:key="row-${item.id()}" />
```

Bound and literal values escape by the DSL/JTE rules (there is no unescaped path). See
[ADR-0023](../adr/0023-v4-compiler-and-deterministic-keys.md).

## Deterministic keys for keyless children (ADR-0023)

A child without an explicit key still needs a stable key, or its DOM state bleeds across re-renders.
The compiler assigns a deterministic key from the template identity and the child's position
(`lw-<crc32(templateId)>-<counter>`, the Livewire `DeterministicBladeKeys` shape), so the same
template position yields the same key on every render. The key is stable across re-renders without
you writing one. This is what fixes list-state bleed in keyless loops.

## Reactive props (down-leg)

A parent passes props as a `Map<String, Object>` to `child(...)`. The wire layer seeds them onto the
child's `@Wire` fields **before** `@LievitMount`, subject to the
[settable allowlist](../adr/0013-payload-hardening.md): a prop targeting a non-`@Wire` or locked
field is dropped. Because the parent re-declares its children on every render, a prop change
re-renders the child.

```java
LievitChildren.current().child("row-" + id, RowComponent.class, Map.of(
    "label", item.name(),
    "selected", selectedId == id));
```

## Modelable two-way bind (up-leg)

`@LievitProperty(modelable = true)` marks one child field as the parent-bound value (Livewire's
`wire:model` on a child). The parent passes the value down as a prop (the down-leg); the client routes
the child's change to that field back up into the parent's bound property (the up-leg, via the
`lievit:modelable` marker the renderer stamps):

```java
public class ToggleComponent {
    @Wire
    @LievitProperty(modelable = true)   // cannot also be locked: a server-owned field is not client-bound
    public boolean on = false;
}
```

There is one modelable field per component. A modelable field cannot also be `locked`.

## Each child is independent

A child mounts on a fresh wire dispatch, which binds a fresh sink, so a child that itself mounts
grandchildren is supported. The mount driver bounds the depth (`lievit.max-nesting-depth`, ADR-0013)
so an accidental render cycle cannot recurse without limit. Each child has its own cid, its own
snapshot, and its own lifecycle: composition is render-time and does not change the wire protocol — a
child is not a fragment of the parent's signed payload.
