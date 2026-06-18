# ADR-0041: Custom actions, bulk action grouping/selection, and the field validation builder

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

lievit-kit (the Filament-for-Spring admin) already shipped a rich action surface (`AdminAction`
with presentation + authorization, the CRUD built-ins, `ActionGroup`, `FormAction`, `BulkAction`
with chunking + deselect, `DeleteBulkAction` / `RestoreBulkAction` / `ForceDeleteBulkAction`) and a
validation rule library (`Rules` + `RuleSet` + the `Rule` SPI). Three P0 gaps remained at the
acceptance-criteria level of issues #249, #251, #217:

- #249 lacked a plain custom single-record action: `Action.make(...).action(record -> ...)`. The
  modal-with-form case was covered by `FormAction`, but not the arbitrary non-CRUD row closure.
- #251 lacked `BulkActionGroup` (the selection-bar dropdown), `DetachBulkAction` (the relation-manager
  bulk unlink), and a "select all matching across pages" selection state.
- #217 had the `Rules` library and a per-field `RuleSet`, but the broadly-applicable validation rules
  were not exposed as a fluent field builder surface (only TextInput carried a few), and several rule
  factories were missing (`notIn`, `numeric`, `integer`, `gt/lt/lte`, `different`, `confirmed`,
  `requiredWith/requiredWithout`, `between`), plus there was no `validationMessages` override.

The kit emits view-models (no HTTP controllers by design), so an "action" stays a declarative object
the adopter renders and wires; the effects ride the lievit effects substrate.

## Decision

1. **Custom action** (`Action<T> extends AdminAction<T>`): `Action.make(name, label, operation)` plus a
   `.action((record, ctx) -> ...)` / `.action(record -> ...)` body and fluent confirmation
   (`requiresConfirmation(boolean)` + `confirmationHeading/Description/SubmitLabel`). It resolves the
   record from the context, gates through the authorizer (inherited), and completes. The fluent
   confirmation enabler takes a `boolean` because the no-arg `requiresConfirmation()` is the inherited
   boolean reader.

2. **Bulk grouping + selection** (`BulkActionGroup<T>`, `BulkSelection`): `BulkActionGroup` mirrors
   `ActionGroup` (flat name->action map, declaration order, label/icon, `isEmpty`, plus a `flatten`
   helper merging top-level + grouped). `BulkSelection` is the two-shape selection state: explicit ids,
   or all-matching that survives pagination by re-paging the resource under the live query (honouring
   the repository's page-only contract, no unbounded findAll) minus deselected exceptions.
   `DetachBulkAction<R> extends BulkAction<R>` reuses the shared bulk loop, detaching each selected
   related id from a parent through a `RelationshipRepository`.

3. **Field validation builder** (on `SchemaField`): the broadly-applicable `CanBeValidated` surface
   moves to the base field (every field can declare `in/notIn/email/regex/numeric/integer/gt/gte/lt/lte/
   same/different/confirmed/requiredIf/requiredWith/requiredWithout/unique/exists`, plus `rules(Rule...)`,
   `validationMessages(Map)`, `validationAttribute`). `RuleSet` gains keyed rules (`rule(key, Rule)`) so
   `validationMessages` overrides a failing rule's message by its Filament rule name; the field builders
   add keyed rules. `confirmed()` derives the `<statePath>_confirmation` sibling from the field's own
   state path. The missing `Rules` factories are added alongside the existing ones.

## Consequences

- Adopters get the full Filament-shaped action + validation surface without HTTP plumbing: actions stay
  view-models, validation stays the `Rule`/`RuleSet` SPI. The custom `Action` is the escape hatch for
  any non-CRUD row operation.
- `validationMessages` is keyed by rule name (the Filament convention); only keyed rules can be
  overridden, which is exactly the builder-added rules. A raw `rule(Rule)` (the unkeyed escape hatch)
  is not message-overridable by design.
- TextInput keeps its own `email()/numeric()` overrides (typed input behaviour); the base methods serve
  every other field. No double rule-add because the overrides win.
- `BulkSelection.resolve` re-pages internally at a fixed window for the all-matching case; a very large
  filtered set is walked in pages, never loaded whole.

## Alternatives considered

- A separate `CustomAction` name was rejected for the plain `Action` (closer to Filament's `Action`).
- Keying validation messages by list index instead of rule name was rejected: brittle as rules are
  reordered, and not the Filament contract.
- Putting the validation builder only on TextInput (status quo) was rejected: the conditional and
  cross-field rules apply to every field type, so they belong on the base, matching the shared
  `CanBeValidated` trait.
