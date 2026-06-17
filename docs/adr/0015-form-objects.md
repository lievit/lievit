# ADR-0015: Form objects — grouped fields with co-located validation

- **Status:** accepted
- **Date:** 2026-06-17
- **Deciders:** Francesco Bilotta

## Context

A form in a lievit component typically groups several related fields (email, password, confirm)
plus validation rules that belong together. Expressed as loose top-level `@Wire` fields on the
component, the component class grows proportionally: three fields, three separate `@Wire`
annotations, and validation logic scattered across the action. Livewire solves this with Form
Objects (`Livewire\Form`): a cohesive object that groups fields and validation in one place and
binds to the component via a single wire field (`wire:model="form.email"`).

The lievit design must:
1. Group related fields + validation into a dedicated class without adding an eighth annotation
   (ADR-0002 seven-annotation cap).
2. Keep the wire codec secure: the existing PayloadGuard + settable-allowlist defenses must
   apply to nested fields; unbounded recursion must be prevented.
3. Be GraalVM-native-friendly (ADR-0006): no reflective open typing, no dynamic class loading.
4. Be additive: existing components and tests are unchanged.

## Decision

lievit ships **form objects** as a plain Java **marker interface** (`LievitFormObject`). A class
that implements `LievitFormObject` and is declared as a `@Wire` field on a `@LievitComponent`
gains **nested wire binding** without any new annotation.

### Wire protocol changes (additive, no breaking change)

**Snapshot `wire` map**: a form-object field is dehydrated to a nested JSON object:
```json
{"form": {"email": "x", "password": "y", "confirm": "z"}}
```
This is valid under the existing `PayloadGuard` allowlist (a `Map<String, Object>` node at
depth 1 is already allowed). The codec roundtrip is unchanged; JJWT serializes nested maps as
JSON objects natively.

**Client `_updates`**: form-object field updates use dotted paths (`"form.email": "new"`).
The first segment names the `@Wire` field on the component; the second names a field on the
form object. This mirrors Livewire's `wire:model="form.email"` binding.

### Bounded depth (security invariant)

Nesting is **bounded at exactly one level**: a `LievitFormObject` field may not itself contain
another `LievitFormObject`. `FormObjectMetadata.of()` throws at reflection time if it detects a
nested form object. Dotted paths with three or more segments are silently dropped (the settable
allowlist, ADR-0013). This invariant is the security boundary that prevents unbounded recursion
both in reflection and in the `WireDispatcher`.

### Settable allowlist (ADR-0013 extends to form fields)

Only fields declared directly on the form object class are bindable from the client. A dotted
path whose right side (`form.nonExistentField`) does not name a declared field is **dropped**,
never bound, matching the policy for non-`@Wire` top-level fields. The `@Wire`-field lock
(`@LievitProperty(locked = true)`) on the component-level form field propagates to any dotted
path attempt: a locked form field rejects the whole dotted path with `LOCKED_PROPERTY` (403).

### `ComponentMetadata` change (the risky touch)

`ComponentMetadata.of()` now detects `@Wire` fields whose type is a `LievitFormObject` and
builds a `FormObjectMetadata` for each. This is **additive** (a new map member; existing fields
and tests are unchanged). The existing `WireField` record is reused unchanged for the outer
`@Wire` field; `FormField` is the parallel record for the inner form fields.

`WireDispatcher.rehydrate()` and `readWire()` now dispatch on whether a field has an
associated `FormObjectMetadata`. The two paths (`rehydrateFormObject` / `dehydrateFormObject`)
are isolated, new methods — the existing top-level logic is untouched. `applyUpdates()` gains
dotted-path handling in a new `applyFormObjectUpdate()` method; the existing top-level branch is
unchanged.

### Bean Validation (co-located, explicit, opt-in)

`LievitFormObject` ships a `default validate()` method that delegates to `FormValidator`, a
package-private class that resolves a `Validator` from the default `ValidatorFactory` at class
load time. Jakarta Validation 3.1 (via Spring Boot BOM) is an **optional** compile dependency
on lievit-core: apps that do not use validation never pull it in. The wire layer never validates
implicitly; validation only runs when the component's action calls `form.validate()`. Violations
are returned as a `FormValidationResult` (a record carrying a `Map<String, List<String>>`); no
exception is thrown on validation failure — the component decides what to do with the result.

### No new public annotation

The seven-annotation cap (ADR-0002) is preserved. `LievitFormObject` is a plain Java interface,
not an annotation. `@LievitTest` (test scope) is unaffected.

### GraalVM native (ADR-0006)

Reflection in `FormObjectMetadata.of()` mirrors `ComponentMetadata.of()` exactly: both use
`getDeclaredFields()` + `setAccessible()` on known concrete classes that are available at
build time. Hibernate Validator 8.x ships GraalVM reflect-config out of the box, so no extra
`reflect-config.json` entries are needed.

## Consequences

- A developer groups related fields into a `LievitFormObject`, binds it with one `@Wire` field,
  and writes `wire:model="form.email"` in the template. The component class shrinks; validation
  is co-located with the fields it guards.
- The nested wire protocol is backward compatible: components without form objects are unchanged;
  the `PayloadGuard` already allows nested maps within the depth cap.
- The bounded depth (max 1 level) is a constraint. A developer who needs two levels of nesting
  must flatten the structure. This is the accepted cost of keeping the security model simple and
  the stack trace readable.
- `ComponentMetadata` gained a `formObjects` map; `WireDispatcher` gained ~60 lines. These are
  the only two touched classes in the core. `SnapshotCodec`, `PayloadGuard`, `Snapshot`, and
  `SigningKeys` are unchanged.

## Exact SnapshotCodec / core changes

The SnapshotCodec is **unchanged** — it already signs and verifies a `Map<String, Object>`, and
JJWT serializes nested maps as JSON objects, so the codec handles the new nested wire state
natively with no code change.

Changed files (all in `lievit-core`):

| File | Change |
|---|---|
| `ComponentMetadata.java` | Added `formObjects: Map<String, FormObjectMetadata>` field; `of()` detects form-object `@Wire` fields; added `formObject(name)` + `formObjects()` accessors. |
| `WireDispatcher.java` | `rehydrate()` dispatches to `rehydrateFormObject()` for form fields; `readWire()` dispatches to `dehydrateFormObject()`; `applyUpdates()` dispatches dotted-path keys to `applyFormObjectUpdate()`. All new code is in new private methods; existing branches are unchanged. |
| `pom.xml` (lievit-core) | Added `jakarta.validation-api` as optional compile dep; `hibernate-validator` as test dep. |
| `pom.xml` (root) | Added `jakarta.validation-api` + `hibernate-validator` to `dependencyManagement`. |

New files (all in `lievit-core`):

| File | What |
|---|---|
| `LievitFormObject.java` | Marker interface; `default validate()`. |
| `FormValidationResult.java` | Immutable record: `Map<String, List<String>>` violations. |
| `FormValidator.java` | Package-private; resolves `Validator` once; delegates from `validate()`. |
| `component/FormField.java` | Reflected field of a form object (parallel to `WireField`). |
| `component/FormObjectMetadata.java` | Reflected shape of a `LievitFormObject` class. |

New test files:

| File | What |
|---|---|
| `component/FormObjectDispatcherTest.java` | 14 tests: mount dehydration, snapshot hydration, dotted-path updates, security guards (depth, allowlist, locked), codec roundtrip identity. |
| `FormValidationTest.java` | 7 tests: valid form, blank email, invalid email, short password, multiple violations, `errorsFor`, `VALID` constant. |
| `wire/FormObjectSnapshotCodecTest.java` | 4 tests: nested map roundtrip, mixed state roundtrip, null values, tamper detection. |

## Alternatives considered

**A new `@LievitForm` annotation.** The most obvious choice (Livewire uses a PHP attribute
`#[Form]`). Rejected: it is an eighth annotation, violating ADR-0002. The interface carries the
same information (marks the class as a form object) without the count.

**Flat dotted-path keys in the snapshot `wire` map (no nested map).** Store `"form.email": "x"`
directly in the top-level wire map rather than as a nested map. Simpler codec path, no change to
dehydration / rehydration structure. Rejected: a flat representation leaks form-field names as
top-level keys alongside component-level fields; it also requires the `WireDispatcher` to split
on the `.` to find the owning form object on every read, not just on updates. A nested map is
closer to the structural intent (the form is a sub-object of the component) and matches how JSON
naturally represents composition.

**Deep nesting (> 1 level) via recursion in `FormObjectMetadata.of()`.** Rejected: unbounded
recursion in the reflection path and in the dispatcher update logic is a DoS surface. One level
is sufficient for all realistic form use cases; the constraint is documented.

**Implicit validation on every wire call.** Rejected: the wire layer validates shape
(PayloadGuard, ADR-0013), not business rules. Implicit validation forces every wire call to pay
the validator cost even for keystroke-by-keystroke `l:model.live` updates where partial data is
expected to be invalid. The explicit `form.validate()` call in the action is the right
granularity; it mirrors how Livewire's `$this->validate()` is called.

## Alternatives considered

**No form objects (stay with top-level @Wire fields for each form field).**
Sufficient for small forms; imposes boilerplate on the component class for larger ones and
scatters validation across the action. Rejected as the only story once Livewire Form Objects
proved the pattern at scale.
