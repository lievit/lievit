# ADR-0038: Validation depth — validateOnly, the imperative error bag, array-element rules

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta
- **Issues:** #185, #187

## Context

Basic validation already shipped (ADR-0017): Jakarta Bean Validation constraints on `@Wire` /
form-object fields, the `FieldValidator` SPI (Bean Validation-backed via the starter), the `errors`
effect + `_errors` model, and the client `l:error` / `l:errors` / `$errors` directives (#101). Two
issues asked for the **depth** Livewire layers on top:

- **#187**: `validate()` (all) vs `validateOnly($field)` (one), an error bag exposed to the
  template, real-time validation on a `wire:model` update (validate-on-`updated`), and the
  `addError` / `resetValidation` / `errorBagExcept` programmatic API.
- **#185**: the rule declaration surface (attributes + a `rules()` method + inline), custom
  messages and display names, and dot-notation rules for array elements (`items.*.qty`).

The non-negotiable constraint: validation MUST use Jakarta Bean Validation + the `FieldValidator`
SPI. No parallel validation engine.

## Decision

### validateOnly — real-time per-field validation

A live `wire:model` update (a call with `_updates` and **no** `_calls`) validates and surfaces only
the updated fields' errors; a submit (a call with an action) validates everything. This is the
Livewire `validateOnly($field)` behavior: editing one field must not surface the still-empty
neighbours' errors the user has not reached yet.

`FieldValidator` gains a **default** method `validateOnly(instance, field)` that runs the full
`validate(instance)` and filters the bag. The default works for any implementation, including a
non-Bean-Validation custom validator (the filter is SPI-agnostic). The `WireDispatcher` calls it for
each updated key on the live path, unions the results, and sets them as the `errors` effect.

### Array-element rules (`items.*.qty`) on Bean Validation's cascade

Array-element validation uses Bean Validation's **canonical container-element cascade**
(`@Valid List<Item>` with constraints on the element), not a parallel engine. Hibernate Validator
produces indexed property paths (`items[0].qty`, `items[1].qty`). The Livewire star convention
`items.*.qty` is supported in `validateOnly` by compiling the star key to a regex that matches every
indexed path: the `.*.` becomes `[<index>].`. So one `items.*.qty` rule validates all elements,
mapped onto the standard Bean Validation paths the indexed display already renders.

### The imperative error bag (addError / resetValidation / errorBagExcept)

`LievitEffects` (the per-call sink an action reaches via `LievitEffects.current()`) gains the
component-facing error-bag API:

- `addError(field, message)` — adds a custom cross-field / business-rule error Bean Validation
  cannot express (password mismatch, "email already registered"). It merges with the
  auto-validation errors and rides the same `errors` effect + `_errors` model.
- `resetValidation()` / `resetValidation(field)` — clears the whole bag or one field.
- `errorBagExcept(field...)` — a read-only filtered view (no mutation).

These let an action manipulate the bag exactly like Livewire's `$this->addError()` etc., on top of
the automatic Bean Validation pass, without a second engine.

### Client merge on a live update (validatedFields)

A live `validateOnly` update revalidates only some fields, so the client must **merge** the
returned errors into its existing bag, not replace it — otherwise editing field B wipes the error
already shown on field A. The server adds a `validatedFields` key to the effects on the live path
(the fields it revalidated); the client clears exactly those, applies the returned `errors`, and
keeps untouched fields' errors. A submit sends no `validatedFields`, so the client full-replaces
(the whole returned bag is authoritative). This is the only protocol addition, and it is additive
(absent on every pre-existing path).

### The rule declaration surface (#185): Jakarta IS the surface

Per the constraint, Jakarta Bean Validation annotations ARE the canonical rule-declaration surface
(the per-property attribute path). Custom messages and field display names are the constraint
`message` attribute and Bean Validation's `attributes()` / message interpolation. A Livewire-style
`rules()` method returning rule **strings** would be a parallel engine and is deliberately NOT
added. The merged/per-field declaration that #185 asks for is satisfied by: annotation constraints
(per-field), `@Valid` cascade + container-element constraints (nested / array), and the imperative
`addError` (the cross-field "after-hook" / `withValidator` seam). The result is the same expressive
power mapped onto the canonical Spring stack.

## Consequences

- Real-time per-field validation works without leaking untouched fields' errors; fixing a field
  clears only its error, client-side, via the merge.
- An action expresses cross-field rules with `addError`, reusing the one error channel.
- `items.*.qty` validates every array element through the standard `@Valid` cascade.
- One additive protocol key (`validatedFields`); pre-existing flows are byte-identical.
- The "no parallel engine" constraint holds: every rule is a Jakarta constraint or an imperative
  `addError`; nothing re-implements rule parsing or evaluation.

## Alternatives considered

**A `rules()` method returning rule strings (literal Livewire parity).** Rejected: it is a parallel
validation engine (string parsing + evaluation) the constraint forbids, and it duplicates what
Jakarta annotations already express type-safely.

**Filter validateOnly with `Validator#validateProperty`.** Rejected as the SPI contract: it does not
honor `@Valid` cascade (so `items.*.qty` would not work) and ties the SPI to Bean Validation. The
default-method filter over `validate()` is engine-agnostic and cascade-aware.

**Client full-replace on every call (no `validatedFields`).** Rejected: a live edit to one field
would wipe another field's still-valid-to-show error, the exact real-time bug #187 calls out.

## Changed / new files

| File | Change |
|---|---|
| `lievit-core/.../component/FieldValidator.java` | NEW default `validateOnly` + star-rule matcher. |
| `lievit-core/.../component/WireDispatcher.java` | Live path calls `validateOnly`; sets `validatedFields`. |
| `lievit-core/.../component/LievitEffects.java` | `addError` / `resetValidation` / `errorBagExcept` + `validatedFields`. |
| `lievit-spring-boot-starter/.../WireEffects.java` | Serializes the `validatedFields` effect key. |
| `lievit-spring-boot-starter/.../test/LievitTester.java` | `update()` (no-action live sync) test helper. |
| `lievit-ui/runtime/effects.ts` | `validatedFields` on the `Effects` interface. |
| `lievit-ui/runtime/runtime.ts` | Merges a live update's errors; full-replaces a submit. |
