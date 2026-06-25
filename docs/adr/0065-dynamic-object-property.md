# ADR-0065: A schemaless dynamic-object `@Wire` property (the stdClass analogue)

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta
- **Issues:** #137 (Epic #34)

## Context

ADR-0017 added a form-object property (`LievitFormObject`): a `@Wire` field of a user-declared
class whose fields bind by a one-level dotted path (`form.email`). The shape is fixed at compile
time: only the fields declared on the form class are settable, depth is bounded at one level, and a
missing field is never created.

Livewire also binds the *opposite* shape: an open, schemaless object (a PHP `stdClass`, the
`SupportStdClasses` feature). A `wire:model="obj.field"` on such a property creates the key if it is
absent, binds arbitrarily nested dotted paths, and round-trips with no declared class. This is the
JVM gap (#137): a component that wants ad-hoc form state without declaring a shape (a dynamic filter
bag, a wizard's accumulating answers) has nowhere to put it. A plain `Map<String,Object>` field
*almost* works (the registry already passes a String-keyed map through as plain JSON), but the
dispatcher's dotted-update path only knows form objects, so `obj.a.b` neither creates `a` nor binds
`b`.

## Decision

lievit adds `DynamicObject` (`dev.lievit.wire.synth`, pure Java, ADR-0007): a schemaless,
`LinkedHashMap`-backed holder with deep dotted `get(path)` / `set(path, value)`. `set` creates the
missing intermediate keys as nested `DynamicObject`s, so `set("a.b.c", v)` on an empty object
materializes `a` and `b`. It renders to a plain String-keyed JSON map (`toMap()`, recursively), so
the value it puts on the wire is always the ADR-0013 allowlisted shape — a dynamic object never
stores or transmits a typed Java object.

Three seams, all in the wire/synth packages:

1. **`DynamicObjectSynthesizer`** (key `dyn`, registered most-specific-first, before the map/record
   catch-alls). Dehydrates a `DynamicObject` to its map (recursing through the registry, so a typed
   leaf still becomes a tuple in place) and hydrates a tuple back to a fresh `DynamicObject`. The
   tuple carries **no concrete-type tag** (`t` is omitted): the key alone reconstructs it, so the
   path triggers no reflective instantiation and the `ClassInstantiationGuard` (ADR-0021) has nothing
   to gate here.

2. **Rehydrate coercion.** `WireDispatcher.rehydrate` routes a `DynamicObject`-typed `@Wire` field
   through `hydrateForUpdate`, which accepts both the `dyn` tuple (the common case) and a bare JSON
   map (a first snapshot) and always yields a `DynamicObject`, never a bare `LinkedHashMap` the field
   could not accept.

3. **Deep dotted update.** `WireDispatcher` dispatches a dotted `_updates` key by the kind of the
   `@Wire` field its first segment names: a `LievitFormObject` field takes the ADR-0017 one-level
   form path; a `DynamicObject` field takes the schemaless deep-set path (creating missing keys). The
   field is materialized if it was null, so a fresh component binds the first key with no
   `@LievitMount` hook.

## Consequences

- A component can hold ad-hoc, nested, schemaless form state and bind it with `l:model.live`,
  without declaring a class — the Livewire `stdClass` ergonomics on the JVM.
- The security posture is unchanged and unweakened. Only a `@Wire` field is settable (a dotted key
  whose head is not a `@Wire` field is dropped, ADR-0013); a locked field still rejects the write;
  the `PayloadGuard` nesting cap bounds the dotted-path depth before it reaches `set`; and the value
  is plain JSON (a typed leaf would have arrived as a `@w` tuple and hydrated through the registry).
  Because the `dyn` tuple carries no `t`, the dynamic-object path opens no reflective-instantiation
  surface at all.
- The form-object path (ADR-0017) is untouched: the two dotted-update kinds are dispatched by the
  field's declared type, so a fixed-shape form keeps its allowlist-by-declaration while a dynamic
  object gets open keys. They cannot be confused.

## Alternatives considered

**Bind a plain `Map<String,Object>` field directly.** The registry already round-trips a
String-keyed map as plain JSON, so a top-level whole-object `$set` works. But a plain map has no
deep-set semantics in the dispatcher: `obj.a.b` would not create `a`, and the one-level form path
does not apply. Rejected: the create-missing-keys behavior is exactly the `stdClass` feature, and it
belongs in a type that owns it, not scattered into the dispatcher's map handling.

**Reuse the form-object machinery with a synthetic open metadata.** Possible, but the form path is
bounded at one level by design (ADR-0017 §Security) and validates against declared fields. Bending it
to allow arbitrary depth and key creation would blur the security boundary that makes a *declared*
form safe. Rejected: a dynamic object is a distinct shape with a distinct (still-safe) contract.
