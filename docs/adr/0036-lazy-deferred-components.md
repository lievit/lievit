# ADR-0036: Lazy / deferred components — `@LievitLazy`, placeholder mount, `$refresh` load

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

> **ADR numbering note.** Same server/engine P2 pass; claims **0036**. The client lazy trigger
> (`features/lazy.ts` intersection observer + `features/init.ts`) shipped on `main`; this is the
> server transport (#147).

## Context

The client `installLazy` already fires an action when an `l:lazy` element scrolls into view, and
`l:init` fires one on init — but nothing on the server skipped the real render to emit a placeholder.
Issue #147 asks: a lazy component's first mount renders a placeholder (skip the heavy body), then a
follow-up loads the real render; defer loads on init instead of intersection; mount params / reactive
props / listeners survive the load.

## Decision

### `@LievitLazy` (type annotation) + a `LazyComponent` reflector

- **`@LievitLazy(defer, placeholder)`** marks a `@LievitComponent`. `defer=false` (default) loads on
  intersection (lazy); `defer=true` loads on init. `placeholder` names a no-arg `String`-returning
  method for a custom placeholder; absent ⇒ a minimal built-in skeleton.
- **`LazyComponent.of(type)`** reflects (and caches) `isLazy()` / `defersOnInit()` / the resolved
  placeholder method, and renders `placeholderHtml(instance)` (the method's return value, or the
  skeleton). The core only reflects + renders the placeholder string; the mount path uses it.

### Placeholder mount + `$refresh` load (no bespoke load action)

- In `LievitWireService.mount`, a `@LievitLazy` component still runs the **mount lifecycle** (so its
  `@Wire` state seeds and the snapshot is real), but instead of rendering the heavy template it emits
  a placeholder root: `<div data-lievit-component="..." l:lazy="$refresh">…placeholder…</div>` (or
  `l:init="$refresh"` for defer), stamped with the id + signed snapshot via `ChildRenderer.stampRoot`.
- The trigger calls **`$refresh`** — the existing magic action that re-renders the component from the
  carried snapshot. So the follow-up load is an ordinary wire call through the normal lifecycle: the
  full template renders with the preserved `@Wire` state. No new action, no new endpoint, no second
  dispatch path. Mount params / props / listeners survive because they ride the same snapshot the real
  component would have carried.

## Consequences

- Additive: a component without `@LievitLazy` mounts unchanged (the reflector returns `isLazy()=false`
  and the mount path renders normally).
- The placeholder load reuses `$refresh` + the unary `/call` endpoint, so it inherits the snapshot
  HMAC, the allowlist, and the full lifecycle — no new security surface.
- The client halves (intersection observer for `l:lazy`, init trigger for `l:init`) already shipped;
  this closes the loop without touching them.
- Bundle vs isolate (the v4 sibling batching) is left to the existing batch endpoint (#177): a page
  with several lazy components already commits their `$refresh` loads through the batch path.
- Reversal cost: low. Drop the annotation + reflector + the mount branch.

## Alternatives considered

- **A dedicated `__lazyLoad` action** instead of `$refresh`: rejected — `$refresh` already does exactly
  "re-render from the snapshot", so a bespoke action would duplicate it and widen the allowlist.
- **Skip the mount lifecycle entirely on the first load** (truly defer the mount hook): rejected for
  now — running mount seeds the state the placeholder/snapshot needs, and Livewire's own lazy still
  mounts to capture params; deferring the mount hook itself is a deeper change left for a follow-up.
