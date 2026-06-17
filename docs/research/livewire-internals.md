# Livewire internals: how it works, and what it means for lievit

Read-only analysis of Livewire (PHP, the `livewire/livewire` repo at HEAD, the 4.x docs that
ship in-tree) to inform lievit's runtime. Every claim carries a `file:line` from the Livewire
source. The last section maps each finding onto lievit's spec
(`docs/wire-protocol.md`, ADR-0001, ADR-0002): where lievit ALIGNS (validated), where it
DIVERGES (and whether justified), and the GAPS Livewire handles that lievit's spec has not.

This is research, not a spec change. Where it contradicts a lievit ADR it flags the contradiction;
the ADR still owns the decision until Francesco supersedes it.

## 1. The wire protocol

### Endpoint: ONE shared route, component id in the payload

Livewire registers a single update route, not a per-component path. The path is
`/livewire-<8 hex>/update`, where the hex is derived from `APP_KEY` so scanners cannot target a
universal URL:

- `EndpointResolver::prefix()` — `'/livewire-' . substr(hash('sha256', config('app.key') . 'livewire-endpoint'), 0, 8)`
  (`src/Mechanisms/HandleRequests/EndpointResolver.php:13-18`).
- `EndpointResolver::updatePath()` returns `prefix() . '/update'` (`:23-26`).
- The route is `Route::post(updatePath(), handle)->middleware(['web', RequireLivewireHeaders::class])`
  (`src/Mechanisms/HandleRequests/HandleRequests.php:27-30`). `web` is mandatory because it carries
  Laravel's CSRF middleware; the comment at `:96-98` is explicit that without it "CSRF protection is
  lost entirely on the update endpoint."

The component id (`memo.id`) lives in the snapshot in the body, NOT in the URL.

### Request payload: BATCHED, multi-component

The request body is `{ components: [ { snapshot, updates, calls }, ... ] }`. Multiple components on
the page that have pending interactions are sent together in one HTTP request:

- `handleUpdate()` reads `request('components')`, asserts it is a non-empty array
  (`HandleRequests.php:159-163`), and validates each entry has a string `snapshot`, an array
  `updates`, an array `calls` — anything else `abort(404)` (`:165-173`).
- It loops the array, decodes each `snapshot` JSON, and calls `app('livewire')->update(...)` per
  component (`:188-218`), collecting `{ snapshot, effects }` per component into the response.
- The JS side batches: a `MessageBus` holds `pendingMessages` and buffers for 5 ms before sending
  so several interactions across the page coalesce into one request
  (`js/request/messageBus.js:74-86`, `:65-68`).

### Response: JSON, not HTML

The server returns JSON, not HTML-with-a-header. The rendered HTML rides INSIDE the per-component
`effects.html` field:

- `handleUpdate()` returns `{ components: [ { snapshot: json, effects } ], assets }`
  (`HandleRequests.php:214-223`).
- The HTML is attached as an effect during the update: `$context->addEffect('html', $html)`
  (`src/Mechanisms/HandleComponents/HandleComponents.php:243-246`).
- Method return values ride as `effects.returns` (`HandleComponents.php:708`); other effects
  (dispatched events, redirects, streams) ride the same `effects` bag.

### The snapshot shape: `{ data, memo, checksum }`

The snapshot is a plain JSON object (no JWT envelope), signed by a sibling `checksum` field:

```
{
  "data":  { ...public properties, possibly as [value, meta] tuples... },
  "memo":  { "id": "...", "name": "component-name", ...children, validation, locale... },
  "checksum": "<hmac-sha256 hex>"
}
```

- Built by `HandleComponents::snapshot()`: `data` = dehydrated public properties, `memo` =
  `{ id, name, ...context.memo }`, then `checksum = Checksum::generate($snapshot)`
  (`HandleComponents.php:281-299`).
- The structural guard on the way back in requires `data` (array), `memo` (array), `checksum`
  (string), `memo.id` (string), `memo.name` (string) — else `abort(404)`
  (`HandleComponents.php:201-213`).
- `memo.name` is the registered component NAME (a string the factory resolves), not a class FQN
  (`HandleComponents.php:269-272`, `fromSnapshot`).
- There is **no `iat`/`exp` in the snapshot.** Livewire snapshots do not carry a TTL or expiry.

### Synthesizer tuples: how non-primitives cross the wire

Primitives pass through as-is; everything else becomes a `[data, meta]` tuple where `meta.s` names
the synthesizer that can rebuild it:

- Dehydrate: primitive returns itself (with `-0.0` normalized to `0` to keep the checksum stable —
  `HandleComponents.php:314-318`); otherwise the matched synth returns `[data, meta]` and
  `meta['s'] = synth::getKey()` is stamped on (`:321-329`).
- Hydrate: a value is treated as synthetic only if it is a `[data, meta]` tuple
  (`Utils::isSyntheticTuple`, `HandleComponents.php:348`); the synth named by `meta['s']` rebuilds
  it (`:362-366`).
- Built-in synths: Carbon, Collection, Stringable, Enum, stdClass, Array, Int, Float
  (`HandleComponents.php:19-28`). Eloquent models, form objects, and Wireables have their own.

## 2. Component lifecycle

### Mount (first load, server)

`HandleComponents::mount()` (`:52-101`):
1. resolve the parent, `new` the component (`:53-56`);
2. separate constructor/`mount()` params from HTML attributes (`:59`, logic at `:103-139`);
3. `trigger('mount', ...)` runs the component's `mount()` hook (`:77`);
4. `render()` to HTML (`:81`);
5. `trigger('dehydrate', ...)` then `snapshot()` (`:85-87`);
6. inject `wire:snapshot` and `wire:effects` attributes into the root element (`:92-95`).

So the initial snapshot is embedded in a `wire:snapshot` attribute on the root node
(confirmed in `docs/hydration.md:86-91`).

### Update (interaction, server)

`HandleComponents::update($snapshot, $updates, $calls)` (`:201-260`):
1. validate snapshot + call structure (`:203-224`);
2. `fromSnapshot()` — **verify the checksum first** (`Checksum::verify`, `:264`), then `new` the
   component by `memo.name` + `memo.id` and **hydrate** public properties from `data` (`:262-279`);
3. `trigger('hydrate', ...)` (`:235`);
4. `updateProperties()` — apply the `updates` diff (the changed bound fields) (`:237`, `:471-494`);
5. `callMethods()` — invoke the `calls` (actions) in order (`:240`, `:654-709`);
6. `render()` to HTML, stored as `effects.html` (`:243-246`);
7. `trigger('dehydrate', ...)`, `snapshot()` a fresh signed snapshot, `trigger('destroy', ...)`
   (`:249-254`);
8. return `[ snapshot, effects ]`.

The invariant matches lievit's: the server holds no state between calls. Any instance rebuilds from
the snapshot.

### Hydrate / dehydrate

Dehydrate walks public properties defined on the subclass only
(`Utils::getPublicPropertiesDefinedOnSubclass`, `HandleComponents.php:303`); hydrate sets only
properties that exist, and refuses to set a typed property to null (`:332-344`). Nested writes use
dot-notation paths recursively through the synths (`recursivelySetValue`, `:594-629`), with `__rm__`
as the removal sentinel (`:780-782`).

## 3. Data binding, actions, debounce, morph

### `wire:model` is DEFERRED by default (the big one)

In Livewire v3/v4 `wire:model` sends **no** network request as the user types. It only syncs to the
server when an action fires (`wire:click`, `wire:submit`):

- The docs are explicit: "By default, Livewire will only send a network request when an action is
  performed (like `wire:click` or `wire:submit`), NOT when a `wire:model` input is updated. This
  drastically improves the performance of Livewire by reducing network requests"
  (`docs/wire-model.md:53-55`, warning callout `:48-49`).
- `.live` is the opt-in for per-keystroke sync, and when live the default debounce is **150 ms**, not
  500: "when using `wire:model.live`, Livewire adds a 150 millisecond debounce"
  (`docs/wire-model.md:69`), customizable via `.debounce.Xms` (`:71-74`).
- In code: the model directive only wires a network update when `isLive || hasLazyWithoutLive`
  (`js/directives/wire-model.js:31-36`), and the debounce default is `150` ms
  (`js/directives/wire-model.js:85-87`). The non-live path only updates Alpine's `x-model`
  client-side (`:112-126`), no request.
- A separate `~150 ms` debounce exists for any realtime input (`js/debounce.js:6-9`), with an
  escape-hatch so a submit flushes pending model debounces before the action runs (`:41-54`).

### Actions

`callMethods()` resolves only public methods defined on the subclass, explicitly removing `render`
from the callable set (`HandleComponents.php:684-687`); an unknown method is a
`MethodNotFoundException` (`:692-694`). `wire:click.renderless` skips the re-render
(`:702-705`). A `max_calls` cap (default 50) throws `TooManyCallsException` (`:656-659`).

### DOM patching: Alpine's morph, NOT Idiomorph

Livewire v3/v4 morphs with `@alpinejs/morph`, not Idiomorph:

- `morph()` calls `Alpine.morph(el, to, getMorphConfig(component))` (`js/morph.js:61`), and
  `Alpine.morphBetween(...)` for fragments (`:112`).
- The dependency is `"@alpinejs/morph": "^3.15.12"` (`package.json:26`). Idiomorph does not appear in
  the dependency set.
- Before morphing, the new snapshot + effects are stamped back onto the target node as
  `wire:snapshot` / `wire:effects` so a mismatch can re-initialize (`js/morph.js:24-32`).
- `wire:key` is load-bearing for morph identity inside loops/conditionals; its absence is THE most
  common "component mismatch" / "snapshot missing" bug (`docs/troubleshooting.md:5-55`).

## 4. Security

### Checksum = HMAC-SHA-256 keyed on the app encryption key

- `Checksum::generate()` = `hash_hmac('sha256', json_encode($snapshot), app('encrypter')->getKey())`
  (`src/Mechanisms/HandleComponents/Checksum.php:81-93`). The key is the Laravel app key, NOT a
  dedicated signing key, and there is **no `kid` / key-rotation** machinery.
- `Checksum::verify()` pulls the `checksum` field out, recomputes over the rest, and compares with
  `hash_equals` (constant time); a mismatch is a `CorruptComponentPayloadException`
  (`Checksum.php:15-32`). The docs frame this exactly as lievit does: tamper protection so a client
  cannot "execute or modify unrelated code" (`docs/security.md:381-387`).
- `memo.children` is deliberately stripped before hashing, because JS legitimately mutates the
  children list for DOM-diffing (`Checksum.php:84-89`). lievit has no `children` concept yet, but
  this is the pattern for "fields the client is ALLOWED to change."

### Checksum-failure rate limiting (lievit has not considered this)

A brute-force / probing defense sits ON TOP of the HMAC: 10 checksum failures per IP in a 600 s
window trips a `TooManyRequestsHttpException` (429):

- `$maxFailures = 10`, `$decaySeconds = 600` (`Checksum.php:11-12`); `enforceRateLimit()` keyed on
  `'livewire-checksum-failures:' . request()->ip()` (`:44-79`); `recordFailure()` on each mismatch
  (`:69-74`).

### The `#[Locked]` property attribute (lievit has no equivalent)

Public properties are untrusted input. `#[Locked]` makes a property reject any client-side update:

- `Locked extends BaseLocked` (`src/Attributes/Locked.php`), whose `update()` throws
  `CannotUpdateLockedPropertyException` (`src/Features/SupportLockedProperties/BaseLocked.php`).
- Docs: "if users attempt to tamper with this value an error will be thrown ... you can assume this
  property has not been manipulated anywhere outside your component's class"
  (`docs/security.md:173-186`, `docs/properties.md:474-490`). Crucially, the checksum only proves
  the snapshot was not altered between requests; it does NOT stop a malicious FIRST request from
  setting any public property to anything. `#[Locked]` is the defense for ids/keys that must never
  change client-side.

### A class denylist on hydration (gadget-chain defense)

Even past the checksum, `SecurityPolicy::validateClass()` refuses to instantiate known-dangerous
classes during hydration (console commands, `Process`, queue closures, mailables, and named exploit
gadgets from the Synacktiv disclosure) (`src/Mechanisms/HandleComponents/SecurityPolicy.php:12-52`),
invoked whenever a synth tuple carries a `class` meta (`HandleComponents.php:357-359`, `:380-382`).
This is a PHP-deserialization concern; on the JVM it maps to "never let the snapshot name an
arbitrary class to instantiate."

### Release token (this is lievit's 410 mechanism, already present in Livewire)

A `release` value in `memo` lets a new deploy invalidate in-flight snapshots and force a refresh:

- `ReleaseToken::generate()` = `'<static>-<config release_token>-<component releaseToken()>'`; on
  verify, an unknown component name OR a release mismatch throws
  `LivewireReleaseTokenMismatchException` and the client is prompted to refresh
  (`src/Features/SupportReleaseTokens/ReleaseToken.php`).

### Header guard + CSRF

`RequireLivewireHeaders` middleware + the `X-Livewire` header gate the route
(`HandleRequests.php:29`, `isLivewireRequest()` `:117-120`); CSRF is Laravel's standard `web`-group
token (`:96-101`). A wrong-typed property set is treated as a bot probe and `abort(419)` rather than
reported as a bug (`HandleComponents.php:644-651`).

### Protocol limits (server config defaults)

`config/livewire.php:277-280`: `max_size` 1 MB, `max_nesting_depth` 10, `max_calls` 50,
`max_components` 200 (per batch). Enforced in `handleUpdate()` (`HandleRequests.php:148-180`) and
`callMethods()` / `updateProperty()` (`HandleComponents.php:517-519`, `:656-659`).

## 5. Known pain points (documented or well-known)

1. **`wire:key` in loops/conditionals.** Forgetting it is THE top cause of "Component already
   initialized" / "Snapshot missing" and silent mis-morphs, including for nested components inside a
   loop (`docs/troubleshooting.md:5-75`).
2. **Public properties are untrusted input.** The whole `docs/security.md` and `docs/properties.md`
   "Don't trust property values" sections exist because client-settable state is a recurring
   foot-gun (`docs/security.md:90-186`, `docs/properties.md:385-490`).
3. **The snapshot leaks structure to the browser.** Property names and class names are visible in
   the dehydrated JSON; "information about the object such as class names may be exposed to
   JavaScript" (`docs/properties.md:206`, `:528-532`).
4. **Per-keystroke chattiness is opt-in for a reason.** `.live` is documented as something to use
   sparingly because it generates a request stream; the defer-by-default exists precisely to avoid
   it (`docs/wire-model.md:53-55`).
5. **Server statefulness on every interaction.** Each action rebuilds the whole component from the
   snapshot, re-runs `mount`-adjacent hydration, and re-renders — the cost lievit's stateless model
   shares by construction.
6. **Multiple Alpine instances / CDN Alpine conflicts** break the runtime (`docs/troubleshooting.md:75-119`).

---

## 6. Mapping to lievit's spec

Legend: ALIGN = lievit matches Livewire and the choice is validated; DIVERGE = lievit deliberately
differs (justified or not); GAP = Livewire handles something lievit's spec is silent on.

### ALIGN (validated against Livewire)

- **Stateless, client-carried, signed state.** lievit's core thesis (ADR-0001:21-26,
  wire-protocol §1) is exactly Livewire's model: state in the snapshot, server holds none, checksum
  is the boundary (`HandleComponents.php:51-53` equivalent invariant, `Checksum.php`). Validated.
- **HMAC-SHA-256 as the security boundary, `hash_equals` constant-time compare.** lievit §3 ==
  Livewire `Checksum.php:25,89`. Validated.
- **State, never code, on the wire; the server owns the class; an unknown class name is a lookup
  failure not a code path.** lievit §2 "no code, no behavior" == Livewire's `memo.name`-is-a-string
  + `ReleaseToken`/factory resolution + `SecurityPolicy` denylist. Validated, and lievit's `410 Gone`
  on an unresolvable name is Livewire's `LivewireReleaseTokenMismatchException` by another name.
- **Morph the DOM, do not replace innerHTML or DIY-diff.** lievit §5 is correct in principle and
  matches Livewire's behavior (`js/morph.js`). (But see the DIVERGE on WHICH library.)
- **Payload-size and action limits with explicit error codes.** lievit §6 (`413`, `504`, caps)
  mirrors Livewire's `max_size` / `max_calls` / `PayloadTooLargeException`
  (`HandleRequests.php:148-180`). Validated; lievit's specific numbers are its own (see DIVERGE).

### DIVERGE

- **Endpoint shape: per-component path vs one shared route.** lievit: `POST /lievit/{componentId}/call`
  (ADR-0001:24, wire-protocol §1/§4). Livewire: a single `/livewire-<hash>/update` with the id in the
  body, batching many components per request (`EndpointResolver.php:23-26`,
  `HandleRequests.php:159-218`, `messageBus.js:74-86`). **Divergence is real and probably not yet
  justified.** Putting `componentId` in the path forecloses Livewire's batching (one HTTP round-trip
  for N components that changed together) and makes a page with several live components N times
  chattier. Recommend ADR-0001 either adopt a batched body (`{ components: [...] }`) or explicitly
  record why per-component paths are worth losing batching. Also: Livewire derives the path prefix
  from the app key to dodge universal scanners; lievit's fixed `/lievit/...` prefix is scannable.
- **Response: HTML+header vs JSON-with-effects.** lievit: `text/html` body + `Lievit-Snapshot`
  header (ADR-0001:27, wire-protocol §1/§4). Livewire: `application/json` with the HTML inside
  `effects.html` and the snapshot inside the component object (`HandleRequests.php:214-223`,
  `HandleComponents.php:243-246`). **lievit's choice is defensible** for a single-component response
  (simpler, smaller) but does not generalize to batched multi-component responses or to side effects
  (dispatched events, redirects, streamed output) that Livewire carries in `effects`. If lievit ever
  needs server->client events or redirects, the header-only channel is too narrow; the effects bag is
  the proven shape. Flag for ADR review alongside the endpoint decision.
- **`wire:model` default: 500 ms debounce vs deferred.** **This is a factual error in lievit's spec.**
  wire-protocol §5 and ADR-0001:37-38 state the default is "debounced 500 ms after the last
  keystroke ... avoids the Livewire wound of one request per keystroke." Livewire v3/v4 default is
  NOT per-keystroke at all: `wire:model` sends **nothing** until an action; `.live` is the opt-in and
  its debounce is **150 ms** (`docs/wire-model.md:53-55,69`, `js/directives/wire-model.js:31-36,85-87`).
  So (a) the "Livewire wound" lievit cites does not exist as described — Livewire already solved it by
  deferring; (b) lievit's per-keystroke-with-500ms default is *more* chatty than Livewire's default
  (which is zero requests while typing). Recommend lievit make `l:model` deferred-by-default (sync on
  action) and keep `.live` (150-250 ms debounce) as the opt-in, matching Livewire and the stated
  performance goal. This needs an ADR-0001 correction.
- **Morph library: Idiomorph vs `@alpinejs/morph`.** lievit §5 and ADR-0001:35-36 assert "Idiomorph
  directly ... converging with Livewire v3." Livewire v3/v4 uses `@alpinejs/morph`
  (`package.json:26`, `js/morph.js:61`), not Idiomorph. The convergence claim is wrong for Livewire
  specifically (Turbo 8 does use Idiomorph). lievit is free to choose Idiomorph (it is a fine,
  framework-agnostic choice and arguably better for a non-Alpine stack), but ADR-0001's *justification*
  ("converging with Livewire v3") is factually incorrect and should be reworded to "Idiomorph, as Turbo
  8 uses; Livewire uses Alpine's own morph, which we do not depend on."
- **Snapshot TTL/expiry: `iat`/`exp` vs none.** lievit puts `iat`+`exp` in the signed snapshot with a
  1 h idle TTL -> `409 snapshot-expired` (wire-protocol §2/§6). Livewire snapshots have **no expiry**;
  staleness is handled only by the release token (deploy moved on) and by the checksum. **lievit's
  divergence is a genuine improvement** (bounds replay of an old captured snapshot, gives the client a
  clean re-mount signal) and should be kept — just note it is a lievit addition, not a Livewire
  pattern, so no Livewire evidence validates the 1 h number.
- **JWT-like envelope + `kid` rotation vs flat checksum on the app key.** lievit signs a JWT-shaped
  token with a dedicated `LIEVIT_SIGNING_KEY` and a `kid`-based 24 h rotation window (§3). Livewire
  just HMACs the JSON with the app encryption key, no envelope, no rotation (`Checksum.php:81-93`).
  **lievit's divergence is justified** (dedicated key + rotation is operationally cleaner than
  coupling to the app key) and is strictly more capable. Keep it.

### GAP (Livewire handles it, lievit's spec is silent)

- **`@Locked` / client-tamper-immutable `@Wire` fields.** ADR-0002 caps the API at seven annotations
  and (from the grep of its body) does not include a lock. The checksum proves a snapshot was not
  altered *between* requests; it does NOT stop the *first* request from setting any `@Wire` field to
  any value. Livewire's `#[Locked]` (`src/Attributes/Locked.php`, `docs/security.md:173-186`) is the
  defense for ids/keys/prices that must never be client-settable. **lievit has no story here.** This
  is the single most important gap: without it, every `@Wire` field is attacker-controllable on the
  first POST, and "the snapshot is signed" gives a false sense of safety. Options: a `@Locked` (eighth
  annotation, needs an ADR per ADR-0002's own rule), or a `locked = true` element on `@LievitProperty`
  (already the metadata annotation, no API growth). Recommend the latter to respect the seven-annotation
  cap.
- **Checksum-failure rate limiting.** Livewire blocks an IP after 10 bad checksums / 10 min
  (`Checksum.php:11-12,44-79`) to stop offline brute-forcing of the HMAC. lievit's §4 state machine
  has no rate-limit state; a forged-snapshot rejection just "is not a normal code path." Add a
  per-IP failure budget -> `429`, cheap and high-value.
- **Batching across components.** Covered under DIVERGE (endpoint), but it is also a capability GAP:
  lievit's spec has no notion of multiple components sharing a request, so a dashboard of N live
  components is N requests. Livewire's `messageBus` 5 ms buffer (`js/request/messageBus.js:74-86`) is
  the mechanism.
- **An `effects` channel for non-HTML server output.** Livewire carries dispatched events, redirects,
  method return values, JS evaluation, and streams in `effects` (`HandleComponents.php:243-246,708`).
  lievit's response is HTML + one snapshot header, with no defined channel for "the action wants to
  redirect / dispatch a browser event / return a value to JS." Not needed for v0.1's click/submit/model,
  but the first feature that needs server->client signaling will hit this wall; worth a one-line
  "deferred to v0.2" in wire-protocol §6 so the shape is reserved.
- **A `children`-style "client-may-mutate" carve-out in the signed payload.** Livewire excludes
  `memo.children` from the HMAC because the client legitimately edits it for morphing
  (`Checksum.php:84-89`). lievit signs the whole snapshot; the moment lievit tracks nested components
  it will need the same carve-out (sign everything EXCEPT the explicitly-client-owned subtree). Note
  it now so the signing scheme leaves room.
- **The "snapshot leaks class/property names" caveat.** Livewire documents that dehydrated state
  exposes names to the browser (`docs/properties.md:206,528-532`). lievit's §2 says "no secrets" but
  does not warn that `cls` (a FQN) and `@Wire` field names ARE visible. Worth an explicit line:
  the FQN and field names are public by design; do not encode anything sensitive in either.

### Net assessment

lievit's spine (stateless, signed snapshot, HMAC boundary, morph, error-code state machine) is sound
and matches Livewire where it counts. Three items need an ADR touch before they harden into the
implementation: (1) the `wire:model` default is factually backwards and should become deferred-by-default;
(2) the Idiomorph "converges with Livewire v3" justification is wrong (Livewire uses Alpine's morph);
(3) the missing client-tamper lock (`@Locked` equivalent) is a real security gap, not a nicety. The
endpoint/response shape (per-component path + HTML-header) is a defensible but unexamined divergence
that forecloses batching and an effects channel; it deserves a conscious ADR decision rather than an
inherited assumption.
