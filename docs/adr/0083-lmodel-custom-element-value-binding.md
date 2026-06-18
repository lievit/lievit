# ADR-0083: `l:model` binds custom elements via a value-control registry

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

`l:model` (ADR-0019) two-way-binds an input to a `@Wire` field. Its value READ
(`directives.ts`) and its value WRITE (the morph value-restore in `morph.ts`) both knew only the
three native form controls: a checkbox/radio read `.checked`, an `<input>` / `<textarea>` /
`<select>` read `.value`, and anything else fell back to `textContent`.

A real adopter building its whole UI on Web Awesome 3.x (`@awesome.me/webawesome@3.8.0`) hit the
gap: `<wa-input>`, `<wa-select>`, `<wa-textarea>` expose their value as a DOM *property* (`.value`),
and `<wa-checkbox>` / `<wa-switch>` as a boolean `.checked` property, none of which the native-only
reader saw. So `l:model="field"` on a `wa-*` control read `textContent` (empty) and binding
silently broke; the write side never set the property back on a morph either. The adopter had to
drop back to a native `<select>`, abandoning its component library for reactive inputs.

Verified against the Web Awesome docs (context7 `/shoelace-style/webawesome`, the `next` docs):

- value is a property: `<wa-input>` / `<wa-select>` / `<wa-textarea>` expose `.value`, set/read as a
  property (the React binding examples use `event.target.value`); `value` is also reflected as an
  attribute.
- checked is a property: `<wa-checkbox>` exposes `.checked` (the docs: "for JavaScript toggling, use
  the `checked` property"), reflected to the `checked` attribute after `updateComplete`.
- events are native: the Shoelace->Web Awesome migration note states "Native events are used for
  change, input, blur, and focus" and "form association is native" (form-associated custom elements
  via `ElementInternals`). So the existing `input` / `change` / `blur` listener wiring already fires
  for `wa-*`; only the value read/write had to change.

## Decision

Introduce a **control-value registry** (`runtime/controls.ts`) as the single place that reads and
writes a control's bound value, and route both `l:model` (read) and the morph value-restore (write)
through it so the two stay symmetric.

### Default-first (zero config)

`defaultReadControlValue` / `defaultWriteControlValue`:

- native controls keep their exact previous behavior (checkbox/radio -> `.checked`, the other three
  -> `.value`), so no native binding changes;
- otherwise, a checkbox-like element (a `checked` property plus a checkbox/radio/switch signal: the
  native `type`, the WAI-ARIA `role`, or a mirrored custom-element `type`) binds the boolean
  `.checked`;
- otherwise, an element exposing a `value` property binds `.value`;
- otherwise, the historical `textContent` fallback (read) / no-op (write).

This covers the common property convention that Web Awesome, Shoelace and Lit form controls follow,
so a form-associated custom element works with no registration.

### Extension seam (register-only-for-exotic)

A per-tag `ControlAdapter` registry, exposed as `runtime.controls`:

```ts
runtime.controls.register("wa-foo", {
  read(el) { return (el as WaFoo).selected; },
  write(el, v) { (el as WaFoo).selected = v; },
  liveEvent: "wa-change", // optional: only when the control fires a non-standard event
});
```

The default handles the convention; an adapter overrides read/write for a control that does not
follow it, and may declare the DOM event each modifier listens to (`liveEvent` / `lazyEvent` /
`blurEvent`). When undeclared, `l:model` uses the standard event per modifier (`input` for
live/deferred, `change` for lazy, `blur` for blur), which is what Web Awesome emits, so `wa-*`
controls need no adapter at all.

### Symmetric write side (morph)

`morph.ts` snapshots a custom element's live `.value` / `.checked` before attribute reconciliation
and restores it afterward unless the server re-asserts it (via the reflected `value` / `checked`
attribute), exactly as it already did for native controls. The restore goes through
`defaultWriteControlValue`, so user typing in a `wa-input` survives an unrelated re-render and a
server `@Wire` change still wins. The morph uses the default convention (not the per-tag adapter
registry) deliberately: it is dependency-light and the property convention covers every
form-associated control; an exotic control whose read needs an adapter is out of scope for the
morph restore and can re-render server-side.

## Consequences

- `l:model` with all its modifiers (`.live` / `.lazy` / `.blur` / `.debounce.Nms`) now two-way-binds
  Web Awesome (and Shoelace / Lit) form controls with zero config; the adopter switches its form
  controls from native `<select>` back to `<wa-select>`. The consumer bumps its JitPack pin to the
  commit carrying this change to get it.
- `runtime.controls` is a new public extension point (barrel exports `ControlRegistry`,
  `ControlAdapter`, `defaultReadControlValue`, `defaultWriteControlValue`).
- `builtinDirectives(controls?)` takes an optional registry (defaults to a shared process-wide one),
  so existing zero-arg callers and tests are unaffected.
- Dependency-free and strict-CSP-safe (ADR-0019): pure DOM property access, no `eval`, no inline
  handlers.
- Residual: a control that does NOT expose `.value` / `.checked` (an exotic shape, e.g. a multi-part
  date picker, or one that fires a non-standard change event) still needs an explicit
  `runtime.controls.register(...)` adapter. This is the intended default-first / register-for-exotic
  split, not a gap.
```
