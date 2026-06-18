# ADR-0024: Livewire v4 client convergence — interceptors, surgical merge, islands, v4 directives

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

Livewire 4's headline features beyond the compiler (ADR-0023) live almost entirely in the
**client runtime**: islands (partial independent re-render), client interceptors (a full
request/message/action lifecycle with cancellation), surgical snapshot merge (an unsaved client
edit survives an in-flight request that changed a different prop), and a cluster of new `l:*`
directives (`l:bind`, `l:text`, `l:dirty` / `$dirty`, `$errors`, `l:ref`, `l:sort`,
disable-during-request, `.async`). lievit's client (ADR-0019) was built with exactly two extension
seams for this moment: `runtime.directives.register(...)` for new `l:*` behaviors and
`runtime.use(hook)` / `runtime.lifecycle.register(...)` for lifecycle observation.

Three forces shape the answer:

1. **The seams already exist; the convergence is additive.** No feature here rewrites the
   dispatcher, the wire transport, the morph, or the bundle core (ADR-0019). Each lands as a new
   module that *composes* the existing seams, or as a directive registered through the registry.
   The core files (`runtime.ts`, `directives.ts`, `wire.ts`, `morph.ts`, `lifecycle.ts`,
   `effects.ts`) are touched only where a genuinely new capability needs a hook the seam did not yet
   expose (the interceptor chain around a call, the island-targeted morph). Everything else is a new
   file.

2. **Interceptors are the foundational seam the rest builds on.** Livewire's loading UX, custom
   headers, redirect control, and request-concurrency all hang off the interceptor lifecycle. lievit
   already has a *fire-and-forget* `LifecycleBus` (observe phases, cannot alter the call). v4
   interceptors are a *chain*: each may `cancel()` the request, mutate the outgoing payload/headers,
   block a server redirect, and resolve the action promise only **after** the morph. So lievit adds
   an `InterceptorChain` (a participating middleware) alongside the existing `LifecycleBus` (a
   passive observer): the bus stays the cheap "just tell me" API, the chain is the "let me steer it"
   API. The pinned phase order matches Livewire:
   `onInit → onSend → onSuccess → onSync → onEffect → onMorph → onFinish → onRender` (with
   `onError` / `onCancel` / `onRedirect` branches).

3. **CSP-safe always (the no-inline-script house stance).** Livewire's `$js`, per-component JS, and
   CSP-safe expression mode are inline-`<script>` shaped. lievit refuses inline script (the strict
   CSP drops it). So `$js` handlers and per-component JS register in a TS module against the runtime
   (`runtime.js.register(name, fn)`), never as an inline `@js`/`<script>`. `l:bind` / `l:text` are
   pure DOM directives (no expression evaluation), and the reactive client state (`$dirty`,
   `$errors`) is derived from data the runtime already holds (pending model updates, the `errors`
   effect), never from an eval'd expression. There is no `eval`, no `new Function`, anywhere.

## Decision

Ship the v4 client surface as **new modules composed onto ADR-0019's seams**, plus a thin set of
additive server effects. No new annotation (ADR-0002 cap held); no wire-protocol reshape (the new
server signals are additive `Lievit-Effects` keys, ADR-0012's "a new key, never a new shape").

### 1. Interceptors (`interceptors.ts`) — #93

`InterceptorChain` registers `Interceptor` objects (each method optional) and runs them in pinned
order around every wire call. An interceptor receives a mutable `RequestContext` (`updates`,
`calls`, `headers`, and a `cancel()` that aborts the call and fires `onCancel`), an
`onRedirect({url, preventDefault})` seam (a server `redirect` effect can be blocked), and a
`result` it can read post-morph. Three scopes are supported by where the interceptor is registered:
global (`runtime.intercept(...)`), per-action (`runtime.interceptAction(name, ...)`), per-component
(scoped to a component root). The runtime threads the chain through `dispatch`; `callAction`'s
promise resolves **after** the morph + effects, so `$lievit.method().then()` reads the post-morph
DOM. A throwing interceptor is isolated (logged, the call proceeds) except `cancel()`, which is the
one control-flow signal.

### 2. Surgical snapshot merge (`merge.ts`) — #87

`mergeNewSnapshot(currentWire, serverWire, pending)` returns the wire state the client should hold
after a response: the server value is authoritative for every path it changed, but a path the
client edited locally (in `pending`) that the server did **not** change keeps the client's
in-flight edit. Array removals are reverse-indexed (so deleting index 2 then 4 targets the right
elements), dot-keys address nested paths, key order is preserved (insertion-ordered), and a large
or sparse numeric key stays a keyed object, never widened to an N-element array. The runtime keeps
an *ephemeral* mirror of each component's wire (seeded from the snapshot's decoded `wire`, updated
on every `l:model` input before any network call) so `$lievit.prop` is readable immediately and the
merge has a `currentWire` to reconcile against.

### 3. Islands (`islands.ts` + the `island` directive) — #89

The server wraps a named island's output in HTML-comment markers
(`<!--[lievit:island name]-->…<!--[/lievit:island name]-->`) and adds an `islands` effect listing
the islands a targeted call re-rendered. `parseIslands(html)` extracts each marked fragment;
`morphIslands(root, fragments, mode)` morphs only the named slices (`replace` / `append` /
`prepend`), leaving the rest of the component DOM untouched. The `l:island="name"` directive (with
`.append` / `.prepend`) routes an action as island-targeted: the runtime sends the island name in a
reserved `_island` field and, on the response, morphs only that island's fragment instead of the
whole component. `lazy` / `defer` islands render on intersection / on init via the directive +
`IntersectionObserver` (CSP-safe, no inline script). The server contract is captured below.

### 4. v4 directives (`v4-directives.ts`, one `registerV4Directives(runtime)` entry) — #75/#77/#85/#97/#101/#109/#111/#125

A single registration function adds, in clearly-separated blocks (so a sibling agent adding other
directives to the same bundle merges cleanly):

- **`l:bind.attr="field"`** (#75) — bind a DOM attribute to a `@Wire` field's ephemeral value
  (`l:bind.disabled`, `l:bind.class`, the attribute riding as the directive modifier so it goes
  through the existing `.`-splitting registry), reflected on every model change.
- **`l:text="field"`** (#77) — bind an element's `textContent` to a field's ephemeral value.
- **`l:dirty` + `$dirty`** (#85) — a `dirty` tracker hook flips a `data-lievit-dirty` flag and
  toggles `l:dirty` elements' visibility while a component has un-committed `l:model` edits.
- **`l:errors` / `l:error="field"`** (#101) — render the `errors` effect (real-time validation,
  already on the wire) without parsing HTML; a `$errors` client accessor exposes the map.
- **`l:ref="name"`** (#109) — register a named element ref the runtime can target
  (stream/dispatch/scroll); refs are scoped per component.
- **`l:sort` / `l:sortable`** (#111) — drag-to-reorder a list, committing the new order as a model
  update (HTML5 drag, CSP-safe, no inline handler).
- **`l:click.async`** (#97) — issue the action without blocking the per-component request queue
  (concurrent), vs the default which queues (request bundling).
- **disable-during-request** (#125) — a `loading` hook disables `[l:loading.attr]` / form controls
  while a call is in flight, type-aware (button → `disabled`, link → `aria-disabled`).

### 5. Request bundling + per-scope concurrency (`runtime.ts` queue) — #95

The runtime holds a per-component **commit queue**: a default action waits for the in-flight call,
then sends one bundled commit (the pending model updates + the queued calls), so a burst of clicks
is one network round-trip. `.async` opts an action out of the queue (it races). This is the client
half of "request interactions (cancel vs queue)".

### 6. Release tokens (`release-token.ts`) — #105

The host page stamps `data-lievit-release` (the build's release token) on `<html>`. The server
echoes the active release in a `release` effect; if the client's token differs (a deploy moved on),
the runtime treats the next stale-snapshot `409`/`410` as expected and re-mounts cleanly, and
disables the back-forward cache (`Cache-Control` + a `pageshow`-from-bfcache reload) so a bf-cached
page from the old release does not POST a stale snapshot. CSP-safe (a `pageshow` listener in the
module, not inline).

### 7. JS components / `$js` (`js-registry.ts`) — #131 / `$js` cluster

`runtime.js.register(name, fn)` registers a named client function a server `js` effect (a new
effects key, deferred in ADR-0012 §reserved) or an `l:click` can invoke **by name**. This is the
CSP-safe replacement for Livewire's inline `@js`/`$js`: the behavior lives in a TS module the page
imports, the server/template references it by name, never by an eval'd string. The `js` effect
carries `{name, args}`; the runtime looks the name up in the registry and calls it. An unknown name
is a logged no-op (never an eval).

## The server contract additions (additive `Lievit-Effects` keys, ADR-0012)

| Effect key | Shape | Meaning | Client reaction |
|---|---|---|---|
| `islands` | `string[]` | the island names a targeted call re-rendered | morph only those island fragments |
| `release` | `string` | the active build's release token | compare to `data-lievit-release`; on mismatch, expect a re-mount |
| `js` | `{name, args?}[]` | named client functions to invoke (CSP-safe `$js`) | look each up in `runtime.js` and call it |

These are new keys in the existing bag; a call producing none omits them, so the channel stays
byte-for-byte backward compatible (ADR-0012). The HTML island markers are HTML comments, inert to
the morph and invisible to the user, parsed only by `parseIslands`.

## Consequences

- **No core rewrite.** The dispatcher, codec, registry, wire transport, and morph are unchanged in
  behavior; the touched core files (`runtime.ts`, `directives.ts`, `effects.ts`) gain additive hooks
  (the interceptor chain seam, the island-targeted dispatch path, the three new effect keys), never
  a reshape. Every other feature is a new file.
- **Sibling-merge-clean.** All new directives register through one `registerV4Directives(runtime)`
  in `v4-directives.ts`; the only edit to the shared `directives.ts` is the `island` built-in, in a
  clearly-fenced block. A sibling adding directives to the same bundle touches different files.
- **CSP held.** No `eval`, no `new Function`, no inline script anywhere. `$js` and per-component JS
  are name-registered TS; `l:bind`/`l:text` are DOM-only; reactive state is derived from runtime
  data.
- **ADR-0002 cap held / ADR-0001 held.** No new annotation; the server signals are additive effect
  keys, not a wire reshape. The snapshot schema and the codec are untouched.

## Alternatives considered

**Fold interceptors into the existing `LifecycleBus`.** Rejected: the bus is fire-and-forget by
design (a throwing hook must never abort a call, ADR-0019). Interceptors *must* be able to abort
(`cancel()`) and steer (mutate headers, block a redirect). Conflating "observe" and "participate"
would make a buggy observer able to break interactivity. Two surfaces, one passive one
participating, keep the contract honest.

**Inline `<script>` for `$js` / per-component JS (literal Livewire).** Rejected: the strict CSP
drops inline script silently (a shipped-once bug, repo CLAUDE.md). Name-registered TS is the only
CSP-safe shape and keeps the behavior testable and bundleable.

**A virtual-DOM diff for islands.** Rejected: the existing bespoke morph already preserves identity;
islands only need to *scope* the morph to a marked sub-region. Comment markers + a sliced morph
reuse the morph lievit already ships (ADR-0019), no second diff engine.

## Cross-references

- ADR-0019 — the client runtime bundle and its two extension seams this ADR composes onto.
- ADR-0012 — the effects channel; the `islands` / `release` / `js` keys are new keys in its bag.
- ADR-0022 — the server-side lifecycle bus; the client interceptor chain is its client-side analogue
  for the participating case.
- ADR-0023 — the compiler + deterministic keys islands and smart wire keys build on.
- ADR-0001 / ADR-0002 — the wire protocol and the seven-annotation cap, both held (additive only).
- wire-protocol.md §5/§5b — the directive registry and the effects channel the new directives/effects extend.
