# Livewire design decisions: the complete catalog + lievit mapping

Status: research artifact, not a spec. No lievit ADR or spec is changed by this document; it
exists so that nothing transferable from Livewire slips past lievit's design. Contradictions and
adoption candidates are flagged for Francesco to decide.

This is the BROAD companion to the protocol-depth analysis already done (PR #5,
`livewire-internals.md`): that one went deep on the wire protocol; this one goes wide across
**every** Livewire feature area, enumerating each design decision with a `file:line` citation
into `livewire/livewire` (4.x HEAD, the post-Synacktiv-hardening tree) and mapping each to
lievit.

## How to read the matrix

Every decision gets a **status** against lievit:

- **ALREADY-IN-SPEC** — lievit already specs this (cite the ADR/doc). Nothing to do.
- **TRANSFERABLE-GAP** — Livewire made a deliberate choice lievit has not yet specced and
  probably should. These are the "don't miss" items; all are pulled up into the summary below
  with a recommended action.
- **DIVERGENT** — lievit deliberately differs (with the justification). Recorded so the
  divergence stays conscious, not accidental.
- **N/A** — Laravel/PHP/Alpine-specific; no lievit analog, or the analog is a different layer.

lievit's locked frame this is mapped against: stateless HTTP + HMAC-signed `{cid,cls,wire,iat,exp}`
snapshot (ADR-0001, `wire-protocol.md`); exactly seven public annotations (ADR-0002); JTE primary +
adapters (ADR-0004); GraalVM-native, **zero runtime reflection** (ADR-0006); htmx 2 + Lit 3 client,
**no Alpine** (README). The Alpine absence and the reflection ban are the two structural facts that
turn many Livewire choices into DIVERGENT/N/A.

---

# TRANSFERABLE-GAP summary (the don't-miss list)

These are the items where Livewire made a deliberate decision that lievit has not specced and that
transfers to lievit's architecture. Ordered by severity. Each has a recommended action (an ADR, a
spec section, an annotation, or a protocol-field addition).

## Security (highest priority — this is what PR #5 was about)

1. **`#[Locked]` properties** — *already flagged by PR #5; this confirms it and adds the subtlety.*
   Livewire's `BaseLocked::update()` throws `CannotUpdateLockedPropertyException` on any
   client-driven write (`BaseLocked.php:10-13`), blocks **nested-path** writes too
   (`SupportAttributes.php:53`, `startsWith(name.'.')`), and the `$set` magic action cannot bypass
   it because `$set` still flows through the same `updateProperty` guard
   (`SupportMagicActions.php:13-25` + `HandleComponents.php:513`). Crucially it blocks **client
   updates only** — server-side `mount()`/init still sets the value
   (`SupportLockedProperties/UnitTest.php:91-102`). Without it, every `@Wire` field is freely
   client-settable on the first POST.
   **Action**: add `@LievitProperty(locked=true)` (fits inside the seven-annotation cap — it's a
   field of the existing `@LievitProperty`, not a new annotation) + a `LockedPropertyTamper`
   error in the protocol error table. Spec: client updates rejected, mount still sets.

2. **The settable/callable allowlist is the real authorization boundary** — lievit's snapshot
   signature stops *tampering* with state, but says nothing about *which* fields a well-formed
   first POST may set or which methods it may call. Livewire derives callable methods from
   `getPublicMethodsDefinedBySubClass` minus `render` minus all lifecycle hooks
   (`HandleComponents.php:684-693`, `SupportLifecycleHooks.php:101-132`), and settable properties
   from `getPublicPropertiesDefinedOnSubclass` (`HandleComponents.php:527-529`), rejecting the rest
   with explicit exceptions (`MethodNotFoundException`, `PublicPropertyNotFoundException`,
   `DirectlyCallingLifecycleHooksNotAllowedException`).
   **Action**: ADR + spec section "client-callable surface": only `@LievitAction` methods are
   callable (lievit is better off than Livewire here — the annotation IS the allowlist, no
   subtraction needed); only `@Wire` fields are settable; lifecycle hooks (`@LievitMount`,
   `@LievitRender`) are never callable from the wire. State the rejection codes.

3. **Checksum-failure rate limit** — Livewire counts invalid-snapshot requests per IP (10 in 600s)
   and returns 429 (`Checksum.php:11-12,60-63,78`), checked once per request even for a batch
   (`Checksum.php:51,66`). lievit's HMAC rejects forgeries but does not bound brute-force attempts.
   **Action**: spec a per-IP rate limit on HMAC-verification failures (Spring Security / bucket4j),
   returning 429. Add to `wire-protocol.md` §4 error table.

4. **Deserialization class allowlist (gadget protection)** — even behind a checksum, Livewire keeps
   a denylist of known PHP object-injection gadgets (`SecurityPolicy.php:12-39`: Console commands,
   Symfony Process, Mailable, queued closures, the Synacktiv-disclosed Guzzle/Flysystem/Prompts
   chains), matched subclass-aware via `is_a(...,true)` (`:48`), enforced before any synthesizer
   instantiates (`HandleComponents.php:359,382`). On the JVM the gadget surface is **worse**
   (Jackson polymorphic typing, `ObjectInputStream`).
   **Action**: ADR. lievit's `wire` payload is "state never code" and `cls` is resolved to a
   registered `@LievitComponent` only (already strong, ADR-0001) — but the **field values** still
   deserialize into typed Java objects. Spec that `@Wire` field deserialization uses a strict
   type-allowlist (the declared field types only; no polymorphic `@class` in the payload). This is
   also a GraalVM-native fit (no reflective open typing).

5. **Authorization re-applied on the event-listener path** — the easy-to-miss bypass: when a
   dispatched event invokes a listener method, Livewire skips the normal `call` hook, so it
   *manually re-runs* the method's `#[Authorize]` attributes (`SupportEvents.php:29-36`). A naive
   clone authorizes `wire:click` but not `#[On]`-triggered methods.
   **Action**: when lievit adds events (gap #16), spec that any authorization on an action method
   is enforced identically whether the method is hit by `l:click` or by an event listener.

6. **CSRF on the wire endpoint + persistent auth middleware** — Livewire's update route is in the
   `web` group (CSRF) (`HandleRequests.php:27-29`), re-adds `web` if a custom route omits it
   (`:99-101`), guards with an `X-Livewire` header + JSON content-type returning **404 not 403** to
   avoid confirming the endpoint to scanners (`RequireLivewireHeaders.php:14-17`), and re-applies a
   curated allowlist of page auth/session middleware on the AJAX endpoint that wouldn't otherwise
   carry the page route's middleware (`PersistentMiddleware.php:16-25,100-136,197-215`).
   **Status of lievit**: CSRF is in ADR-0001 (`_token`, 403). **GAP**: (a) the "re-apply the page's
   auth/security filters on the stateless `/lievit/.../call` endpoint" decision is not specced —
   Spring Security filter chains must cover the wire endpoint exactly as they cover the page, or an
   action runs less-authenticated than the page that rendered it; (b) the 404-not-403 scanner-hiding
   choice; (c) skipping input-mangling filters (trim/empty-to-null) that would corrupt the signed
   payload (`HandleRequests.php:80-89`).
   **Action**: spec section "the wire endpoint inherits the page's security context"; note the
   404-vs-403 choice; note that no servlet filter may mutate the request body before HMAC verify.

7. **Payload abuse caps beyond size** — lievit specs a 64 kb payload / 16 kb snapshot cap
   (`wire-protocol.md` §6). Livewire adds three MORE independently-disable-able caps: max method
   **calls** per request (50, `TooManyCallsException`), max update-path **nesting depth** (10,
   `MaxNestingDepthExceededException`), max **components per batch** (200) — all DoS guards against
   algorithmic-complexity attacks (`HandleComponents.php:517-520,656-660`, `HandleRequests.php:176-180`,
   `livewire.php:277-280`).
   **Action**: extend `wire-protocol.md` §6 with `max_calls`, `max_nesting_depth` (lievit batches
   one component per call today, so `max_components` may be N/A until batching lands — see #20).

8. **Fail-closed, leak-free error rendering** — tamper/locked failures render a generic 419/404 in
   prod and the full trace only in debug; `report()` fires only in prod; the snapshot-diff debugger
   is hard-disabled outside local dev (`CorruptComponentPayloadException.php:19-31`,
   `CannotUpdateLockedPropertyException.php:16-21`, `SupportChecksumErrorDebugging.php:12-13`). The
   generic message names *what to check* without revealing the secret or expected checksum.
   **Action**: spec that lievit's error responses never echo the snapshot, the expected HMAC, or the
   FQN; debug detail gated on a dev profile.

## Data binding / lifecycle / API ergonomics

9. **`boot` vs `mount` distinction** — Livewire runs `boot()` on **every** request (mount AND
   hydrate) and `mount()` only on the first (`SupportLifecycleHooks.php:30-31,46-47,35-36`). This is
   the canonical place to re-establish non-serializable state (a repository handle, a service) that
   must not live in the signed snapshot. lievit has only `@LievitMount`.
   **Action**: decide whether lievit needs a per-request `boot` hook. If yes it's an 8th annotation
   (needs an ADR superseding ADR-0002) OR a convention (a method named `boot()` on the component,
   no annotation — preserves the cap). Recommend the convention to stay within seven.

10. **`updating`/`updated` hooks (global + per-property)** — Livewire fires `updating($path,$value)`
    before a `wire:model` write and `updated` after, plus per-property `updatedFoo` and nested
    `updatedFoo_Bar` variants (`SupportLifecycleHooks.php:71-96`). This is *the* seam for real-time
    validation and derived state. lievit specs no update hook.
    **Action**: spec the update lifecycle hook(s). Likely a convention (`updated<Field>()`) rather
    than a new annotation, to respect the cap. This is a prerequisite for real-time validation (#11).

11. **Real-time validation as an update-hook, not a pipeline** — Livewire's `#[Validate]` runs
    `validateOnly` on each property update unless `onUpdate:false` (`BaseValidate.php:18,85-107`),
    riding the same `update` lifecycle hook (`SupportAttributes.php:46-58`), with a per-component
    error bag persisted across requests (only property-bound errors survive,
    `SupportValidation.php:43-55`) and surfaced to the view. lievit's `@LievitProperty` mentions
    "validation" but specs no timing, no error-bag round-trip, no real-time behavior.
    **Action**: ADR + spec. The error bag must round-trip (it's part of `wire` state or a parallel
    signed channel); decide validate-on-update default; map to Jakarta Bean Validation
    (`@NotNull` etc.) on `@Wire` fields. This is a large, high-value area.

12. **Computed properties with two cache scopes** — Livewire's `#[Computed]` memoizes per-request by
    default, with `persist` (cache keyed by component **id**, survives requests) and `cache` (keyed
    by component **name**, shared across instances) tiers, TTL, tags, and `unset` invalidation
    (`BaseComputed.php:31-95`). lievit has no computed concept.
    **Action**: ADR — is a derived/computed value a lievit concept, or just a Java getter the
    template calls? A getter is the zero-annotation answer (fits the cap); the per-request memo and
    cross-request persist tiers are the value-add to consider speccing as config, not an annotation.

13. **Query-string binding (`#[Url]`)** — deep-linkable property state in the URL with `as`/`history`
    (push vs replace)/`keep`/`except`/`nullable`, initial-value-from-URL at mount, present-vs-absent
    sentinel, partial-array merge, defensive decode (`BaseUrl.php` throughout;
    `supportQueryString.js`). A very common business-app need (filters, pagination, tabs).
    **Action**: ADR — likely a field on `@LievitProperty` (`url=true`, alias, history-mode) to stay
    within the cap. Note the client half needs a htmx/Lit reimplementation (Livewire's is Alpine).

14. **Form objects** — extracting form state + validation into a reusable typed object bound as
    `wire:model="form.field"`, with prefixed error keys and its own lifecycle hooks
    (`Form.php`, `SupportFormObjects.php`). The Java-natural analog is a nested `@Wire` object /
    record (a "command" object).
    **Action**: spec how a nested object is bound and validated. lievit's type-safety makes this
    cleaner than Livewire (the form object is just a typed field); the decisions to copy are the
    error-key prefixing and the consolidated-update decomposition (`HandleComponents.php:471-511`).

15. **Lazy loading / deferred mount** — render a placeholder now, run the expensive `mount()` on a
    second request (`SupportLazyLoading.php:97-138`), triggered by viewport-intersection (lazy) or
    on-load (defer), with isolation default-on and a `.bundle` opt-out. Big perf lever for
    CRUD/business dashboards (lievit's target segment).
    **Action**: ADR. Maps to a placeholder + a `l:init`-style second call. Decide annotation
    (`@LievitComponent(lazy=true)` field, within the cap) vs template directive.

## Client/runtime mechanisms

16. **Events / cross-component messaging** — `dispatch()` + `#[On]` listeners, self/parent/named-
    component targeting, browser CustomEvents as the bus (`SupportEvents.php`, `Event.php`,
    `js/events.js`). lievit specs no inter-component communication at all.
    **Action**: ADR. With htmx+Lit, the natural bus is DOM CustomEvents (same as Livewire) +
    server-side listener methods. Decide whether listeners are a new annotation (`@LievitOn` → 8th,
    needs ADR superseding 0002) or a convention. This is a whole feature area lievit has not scoped.

17. **The effects channel** — Livewire's response is `{snapshot, effects}` where `effects` is a typed
    side-effects bag: `html`, `dispatch`, `redirect`, `js`, `stream`, `returns`, `scripts`,
    `islandFragments` (`HandleRequests.php:214-223`, `js/request/index.js:418-455`). lievit's
    response is `text/html` body + `Lievit-Snapshot` header only (ADR-0001). That forecloses
    redirect-as-effect, dispatch-as-effect, action-return-values, and streaming on the same channel.
    **Status**: DIVERGENT-but-unexamined (PR #5 already flagged the HTML-vs-JSON divergence). This is
    the single most consequential cross-cutting divergence: many gaps below (redirect, dispatch,
    stream, JS-eval, return values) all need *some* side-channel.
    **Action**: ADR deciding lievit's side-effect channel. Options: (a) a second response header
    carrying a small JSON effects bag alongside the HTML body; (b) switch to a JSON envelope like
    Livewire. Recommend (a) to preserve the "HTML over the wire" identity while unblocking redirect/
    dispatch/stream. **This ADR gates #16, #18, #19, #21.**

18. **Redirects as a response effect** — `$this->redirect()` (with `navigate:true` for SPA) becomes
    an effect, not a 302, during an AJAX call, with a real 302 fallback on non-AJAX
    (`SupportRedirects.php:61-72`; `js/features/supportRedirects.js`). A browser `fetch` can't follow
    a 302 the way the framework needs. lievit has no redirect story.
    **Action**: spec redirect handling (depends on #17's channel). Note the skip-render-on-redirect
    default (`HandlesRedirects.php:15-17`).

19. **Loading states (`wire:loading` + targets + delay)** — request-lifecycle-driven loading UI with
    `wire:target` scoping, `.except` inversion, named delay tiers (50ms..1000ms) to avoid flicker,
    and `.class`/`.attr`/`.remove` modes (`wire-loading.js`). Plus auto-disabling forms during a
    request to prevent double-submit (`supportDisablingFormsDuringRequest.js`). Table-stakes UX for
    the target segment.
    **Action**: spec `l:loading` and form-disable. With htmx, `htmx-request` class + `hx-indicator`
    cover much of this — map explicitly, don't hand-roll. Note the delay-tier-to-avoid-flicker idea.

20. **Request batching + buffering** — Livewire coalesces multiple components' updates into one POST
    with a 5ms buffer window and fingerprint-based action squashing (`js/request/index.js:266-301`,
    `messageBus.js:74-86`, `action.js:71-90`). lievit's protocol is one component per `POST
    /lievit/{componentId}/call`. This forecloses page-wide-event-touches-N-components-in-one-request.
    **Status**: DIVERGENT-but-unexamined (PR #5 flagged this). For the CRUD/business segment the
    single-component path is defensible (lower complexity), but the `{componentId}`-in-path design
    *structurally* prevents batching.
    **Action**: ADR recording the conscious choice to NOT batch in v0.1, and what it costs (a parent
    re-render that should also refresh a sibling needs an explicit event round-trip). Note `#[Isolate]`
    is Livewire's opt-OUT of batching (`BaseIsolate`, memo flag) — lievit is isolated-by-default.

21. **Streaming (`wire:stream`)** — progressive output by switching the *same* action response to
    chunked `text/event-stream` and `flush()`-ing JSON fragments (`SupportStreaming.php:48-67`); the
    JS reads with a `ReadableStream` and patches incrementally. The natural home for LLM-token
    streaming (relevant given iambilotta's AI work).
    **Action**: defer-but-record. lievit's brand element `<lievit-stream>` exists (ADR-0005), so
    streaming is anticipated; spec it when #17's channel is decided. SSE/WebSocket is already v0.2
    roadmap (ADR-0001) — note that Livewire does streaming over plain chunked HTTP, no WS.

22. **`wire:key` / morph stability for lists** — Livewire tracks children by key (not DOM position)
    across renders (`SupportNestingComponents.php:81,93-111`) and even auto-derives loop keys at
    compile time (`SupportCompiledWireKeys.php:167-190`) because devs forget them. Idiomorph (lievit's
    morph, ADR-0001) also keys on `id`/explicit key. lievit specs Idiomorph but not the `l:key`
    contract for loops/nested components.
    **Action**: spec `l:key` (the attribute name) and the rule that nested `@LievitComponent`s need a
    stable key for morph identity. Cheap, prevents a class of list-rerender bugs.

23. **`wire:poll` (polling)** — declarative polling with a shared synchronized timer, background-tab
    throttling (drop ~95% unless `.keep-alive`), `.visible` viewport-gating, offline/expiry pause
    (`wire-poll.js`). Common for dashboards. htmx has `hx-trigger="every Ns"` but not the
    background-throttle/visibility intelligence.
    **Action**: spec `l:poll`; consider porting the background-throttle + `.visible` gating (pure
    client logic) on top of htmx's polling.

24. **`wire:ignore` (morph exclusion)** — exclude a subtree from morph (`.self` = own attrs update
    but children frozen; `.children` = inverse) for third-party-managed DOM
    (`wire-ignore.js`, `morph.js:147-149`). Idiomorph supports ignore via callbacks; lievit must
    expose it.
    **Action**: spec `l:ignore[.self/.children]` mapped to Idiomorph's ignore callback.

25. **File uploads** — three-phase protocol (start→finish→error) over dedicated endpoints with
    signed short-lived temp references, S3 direct PUT, progress via XHR, serial upload queue,
    opportunistic temp cleanup (`WithFileUploads.php`, `supportFileUploads.js`,
    `TemporaryUploadedFile.php`). A large, self-contained feature.
    **Action**: defer-but-record as a known major feature. When specced, copy the signed-temp-
    reference + dedicated-endpoint design (uploads can't ride the snapshot channel — binary + size).

## Lower-priority but real

26. **Pagination** with URL integration and per-paginator page state (`SupportPagination.php`,
    `HandlesPagination.php`). **Action**: spec when CRUD lists land; depends on #13 (URL binding).
27. **`wire:dirty`** (client-side diff of current vs last-server state) (`wire-dirty.js:44-62`).
    **Action**: spec `l:dirty`; pure client logic.
28. **`wire:offline`** (native `online`/`offline` events toggle UI) (`wire-offline.js`).
    **Action**: trivial; spec `l:offline`.
29. **`wire:confirm`** (native confirm/prompt before a destructive action, `.prompt` type-to-confirm)
    (`wire-confirm.js`). lievit specs `l:click` but not a confirm guard. **Action**: spec
    `l:confirm`; pure client, gates the action.
30. **`wire:navigate` SPA-mode** (prefetch-on-hover, `@persist`, scroll restoration, back-button
    snapshot cache) (`js/plugins/navigate/`). **Action**: ADR — htmx `hx-boost` covers basic SPA nav
    but NOT prefetch/persist/scroll-cache. Decide how much SPA-feel lievit wants; likely lean on
    `hx-boost` and record what's dropped.
31. **Full-page components** (`#[Layout]`, `#[Title]`, component-as-route) (`HandlesPageComponents.php`).
    **Action**: spec how a `@LievitComponent` becomes a full page inside a JTE layout (Spring MVC
    controller returns it). Decide if `@LievitComponent` gains a `layout`/`title` field (within cap)
    or it's done via the controller.
32. **Computed/`@js`/JS-modules per-component** (`SupportJsModules`, `SupportScriptsAndAssets`):
    per-component JS that auto-loads. lievit's answer is Lit components imported by `main.ts`
    (README). **Action**: record as DIVERGENT (lievit's Lit-island model replaces this); no gap.

---

# The full catalog (every decision, grouped by area)

Format per row: **decision | Livewire's choice (`file:line`) | lievit status**. All paths are
relative to `livewire/livewire`. "GAP-N" cross-references the summary above.

## A. Component model + class structure

| decision | Livewire (`file:line`) | lievit status |
|---|---|---|
| Component = abstract base class, subclassed | `Component.php:25` | DIVERGENT — lievit uses `@LievitComponent` on a plain typed Java class (ADR-0002), no required base class; cleaner for type-safety. |
| Behavior from 15 mixed-in traits, not inheritance | `Component.php:29-44` | N/A — Java composition / Spring beans; the feature-per-module idea maps to lievit's module packaging (ADR-0008). |
| Property/method access via EventBus `trigger()` | `Component.php:113-173` | DIVERGENT — reflection/dynamic dispatch conflicts with ADR-0006 (zero runtime reflection); lievit resolves at compile time (APT). |
| Reserved state name-mangled (`$__id`) out of snapshot | `Component.php:46-47` | ALREADY-IN-SPEC — only `@Wire` fields serialize (`wire-protocol.md` §2); framework state is not `@Wire`. |
| Render-control flags via store (`skipRender`, `forceRender`) | `Component.php:74-101` | TRANSFERABLE-GAP (minor) — lievit has no "skip render" concept; needed for renderless actions + redirect (GAP-18). |
| Hook system: framework `ComponentHook` vs user `Component` | `ComponentHook.php:5` | N/A — internal architecture; lievit's equivalent is APT-generated wiring. |
| Hooks instantiated per-component, GC'd via WeakMap | `ComponentHookRegistry.php:10-36` | N/A — JVM/Spring scope management. |
| Two hook shapes: fire-and-forget vs before/after-closure | `ComponentHook.php:14-84` | TRANSFERABLE-GAP — the before/after pair is how `updating`/`updated` work (GAP-10). |
| `LivewireManager` thin facade over mechanisms | `LivewireManager.php:32-141` | N/A — design taste. |

## B. Lifecycle hooks

| decision | Livewire (`file:line`) | lievit status |
|---|---|---|
| `mount` — first load only | `SupportLifecycleHooks.php:35-36` | ALREADY-IN-SPEC — `@LievitMount` (ADR-0002, `wire-protocol.md` §1). |
| `boot`/`booted` — every request | `:30,38-39,46,59-60` | TRANSFERABLE-GAP-9. |
| `hydrate`/`hydrateFoo` — restore from snapshot | `:51-57` | TRANSFERABLE-GAP (minor) — lievit rehydrates `@Wire` fields (`wire-protocol.md` §1 phase 4) but specs no user hook to post-process. |
| `updating`/`updatingFoo`/nested | `:71-87` | TRANSFERABLE-GAP-10. |
| `updated`/`updatedFoo`/nested (after-closure) | `:89-96` | TRANSFERABLE-GAP-10. |
| `dehydrate`/`dehydrateFoo` — serialize back | `:154-162` | TRANSFERABLE-GAP (minor) — symmetric to hydrate hook. |
| `rendering`/`rendered` | `:143-151` | TRANSFERABLE-GAP (minor) — `@LievitRender` is pre-render (ADR-0002); no post-render `rendered(html)` hook. |
| `exception` hook with `stopPropagation` | `:137-141` | TRANSFERABLE-GAP — component-level error handling; relates to GAP-8/GAP-11 (validation exceptions). |
| `destroy` — end of request | `ComponentHook.php:78-80` | N/A — JVM GC. |
| Lifecycle hooks NOT client-callable | `:99-135` | TRANSFERABLE-GAP-2 (the allowlist). |
| Trait-suffixed hook variants (`mountWithFileUploads`) | `:180-217` | N/A — trait mechanism; lievit composition differs. |

## C. Data binding (`wire:model` + modifiers)

| decision | Livewire (`file:line`) | lievit status |
|---|---|---|
| **Deferred by default** (no network until an action) | `js/directives/wire-model.js:31-36,121` | TRANSFERABLE-GAP / CORRECTION — *PR #5 already flagged that lievit's "500ms debounce default" is wrong; the canonical default is **deferred**.* ADR-0001 / `wire-protocol.md` §5 should be corrected: bare `l:model` defers, no per-keystroke traffic. |
| `.live` = the network delimiter (modifiers before it = client timing, after = network) | `js/directives/wire-model.js:31-39` | DIVERGENT/SIMPLIFY — lievit can keep `.live` meaning "send on input" without the Alpine x-model split (no Alpine). |
| `.live` default debounce = **150ms** | `js/directives/wire-model.js:86` | CORRECTION — lievit's spec says 500ms; Livewire's actual value is 150ms. Pick deliberately. |
| `.blur` / `.change`/`.lazy` (commit on change) | `:56-57,42-46` | ALREADY-IN-SPEC — `l:model.blur`/`.lazy` (`wire-protocol.md` §5). |
| `.debounce.Nms` / `.throttle.Nms` | `:66-67,85-91` | ALREADY-IN-SPEC — `l:model.debounce.500ms` (`wire-protocol.md` §5). |
| `.number`/`.fill`/`.trim` delegated to Alpine x-model | `:131-158` | N/A — no Alpine; lievit handles casting server-side via typed `@Wire` fields. |
| File inputs bypass binding → upload pipeline | `:24-26` | TRANSFERABLE-GAP-25. |
| Warn on binding an undeclared property | `:19-21` | TRANSFERABLE-GAP (minor) — dev-time guard; lievit gets this free at compile time (type-safe binding, ADR-0003). |

## D. Hydration / snapshot / synthesizers

| decision | Livewire (`file:line`) | lievit status |
|---|---|---|
| Snapshot = `{data, memo, checksum}` | `HandleComponents.php:281-299` | DIVERGENT — lievit uses `{cid,cls,wire,iat,exp}` signed JWT-like (ADR-0001). Livewire's `memo` (id/name/children) maps to lievit's `cid`/`cls`; lievit adds `iat`/`exp` (TTL) which Livewire lacks. |
| Checksum = HMAC-SHA256 over `{data,memo}`, app key | `Checksum.php:81-94` | ALREADY-IN-SPEC — HMAC-SHA256, dedicated `LIEVIT_SIGNING_KEY` + `kid` rotation (ADR-0001 — lievit is *stronger*: separate key + rotation, Livewire reuses APP_KEY with no kid). |
| Timing-safe compare (`hash_equals`) | `Checksum.php:25` | ALREADY-IN-SPEC — "compares in constant time" (`wire-protocol.md` §3). |
| `memo.children` excluded from hash | `Checksum.php:84-87` | N/A-becomes-relevant — only if lievit adds child-tracking to the snapshot (GAP-22); if so, exclude the mutable child map from the HMAC. |
| Checksum-failure rate limit (10/600s/IP → 429) | `Checksum.php:11-12,60-63` | TRANSFERABLE-GAP-3. |
| `[value, metadata]` synthetic tuple, `meta.s`=synth key | `HandleComponents.php:323-329` | DIVERGENT — Livewire's synthesizer registry is runtime-reflective polymorphic serialization; conflicts with ADR-0006. lievit serializes typed `@Wire` fields with compile-time-known types (no `@class` in payload) → also the security win in GAP-4. |
| Synthesizer registry (8 default, first-match, prependable) | `HandleComponents.php:19-50` | DIVERGENT — same as above; lievit's `@LievitProperty(serialize=...)` hook (ADR-0002) is the bounded, type-directed equivalent. |
| Enum/Carbon stored as value+class/type-token | `EnumSynth.php:22-35`, `CarbonSynth.php:12-18` | TRANSFERABLE (pattern) — for lievit, value objects round-trip by declared field type; never carry a client-controlled class name. |
| Class denylist before instantiation | `HandleComponents.php:358-382`, `SecurityPolicy.php` | TRANSFERABLE-GAP-4. |
| Only subclass-declared public props serialized | `HandleComponents.php:303` | ALREADY-IN-SPEC — only `@Wire` fields (`wire-protocol.md` §2). |
| `__rm__` removal sentinel for nested unset | `HandleComponents.php:352-355` | TRANSFERABLE-GAP (minor) — relevant if lievit supports nested `l:model` paths (form objects, GAP-14). |
| Max nesting depth / max calls payload guards | `:517-519,656-659` | TRANSFERABLE-GAP-7. |
| Strict snapshot/call shape validation → 404 | `:201-224` | TRANSFERABLE-GAP-2/7 — fail-closed on malformed payload. |
| Effects (transient) vs memo (persisted) split | `ComponentContext.php:6-7` | TRANSFERABLE-GAP-17 (the effects channel). |

## E. Actions + magic actions

| decision | Livewire (`file:line`) | lievit status |
|---|---|---|
| `wire:X` → Alpine `x-on:X` (reuse Alpine event engine) | `js/directives/wire-wildcard.js:12` | N/A — no Alpine; lievit uses htmx triggers. The reserved-directive denylist (`:9-10`) maps to lievit's reserved `l:*`. |
| Action expression → `$wire.method()` | `js/evaluator.js:42-87` | N/A — lievit has no client expression language; actions are htmx-attribute-driven (README), method named directly. |
| `wire:submit` auto-`.prevent` | `js/directives/wire-wildcard.js:15-17` | ALREADY-IN-SPEC — "`l:submit` prevents the native submit" (`wire-protocol.md` §5). |
| Calls payload `{method, params, metadata}` | `js/request/index.js:270-280` | ALREADY-IN-SPEC — `_calls` (ADR-0001 / `wire-protocol.md` §1). |
| Only subclass public methods callable, minus `render` | `HandleComponents.php:684-694` | TRANSFERABLE-GAP-2 (lievit is better: `@LievitAction` is the allowlist). |
| `__dispatch` allowlisted entry point | `HandleComponents.php:690` | TRANSFERABLE-GAP-16 (events). |
| `$refresh`/`$set`/`$toggle`/`$commit` magic | `SupportMagicActions.php:11-26`, `$wire.js:196-304` | TRANSFERABLE-GAP (minor) — lievit has none; `$refresh` (empty re-render) and `$set` are cheap, useful client conveniences. Decide. |
| `$parent` = client DOM walk, memoized | `$wire.js:333-345` | TRANSFERABLE-GAP-16 — parent access; decide server-concept vs client walk. |
| `.renderless`/`.async` action modifiers (Livewire-owned) | `wire-wildcard.js:19-37` | TRANSFERABLE-GAP (minor) — `.renderless` (skip re-render) pairs with GAP-18 redirect / renderless actions. |
| `.prevent`/`.stop`/`.debounce` delegated to Alpine | `wire-wildcard.js:12` | N/A — map to htmx modifiers. |
| `wire:confirm` (native confirm/prompt, `.prompt` type-to-confirm) | `js/directives/wire-confirm.js:3-26` | TRANSFERABLE-GAP-29. |
| Flush pending debounces before an action | `wire-wildcard.js:45` | TRANSFERABLE-GAP (subtle) — "type in debounced field, hit submit" race; the pending `l:model` update must flush before the action's snapshot is collected (`wire-protocol.md` §5 says actions collect pending updates — make the flush explicit). |

## F. Validation

| decision | Livewire (`file:line`) | lievit status |
|---|---|---|
| `#[Validate]` attribute, repeatable, on prop/form | `Validate.php:9`, `BaseValidate.php:10` | TRANSFERABLE-GAP-11 — map to `@LievitProperty` validation field + Jakarta Bean Validation. |
| Rules from method/property/attribute merged | `HandlesValidation.php:107-122` | TRANSFERABLE-GAP-11. |
| Real-time validate-on-update, `onUpdate` default true | `BaseValidate.php:18,85-107` | TRANSFERABLE-GAP-11 (the timing decision). |
| Validation rides the `update` lifecycle hook (not a pipeline) | `SupportAttributes.php:46-58` | TRANSFERABLE-GAP-10/11 — clean seam; needs the update hook first. |
| Error bag in component store, persisted across requests (filtered) | `HandlesValidation.php:42-63`, `SupportValidation.php:43-55` | TRANSFERABLE-GAP-11 — the error bag must round-trip; decide where (in `wire` or parallel signed channel). |
| `ValidationException` auto-caught → error bag (no 500) | `SupportValidation.php:57-64` | TRANSFERABLE-GAP-11 (relates to GAP exception hook). |
| `validateOnly` field filtering, preserves other errors | `HandlesValidation.php:324-421` | TRANSFERABLE-GAP-11. |
| Form-object validation aggregation | `HandlesValidation.php:263-322` | TRANSFERABLE-GAP-14. |

## G. Events

| decision | Livewire (`file:line`) | lievit status |
|---|---|---|
| `dispatch()` queues an Event (flushed as effect) | `HandlesEvents.php:15-22` | TRANSFERABLE-GAP-16/17. |
| Event targeting self/component/ref/el/to | `Event.php:14-90` | TRANSFERABLE-GAP-16. |
| `#[On]` listener, repeatable, method-less = `$refresh` | `On.php:9`, `BaseOn.php:11-22` | TRANSFERABLE-GAP-16 — annotation-vs-convention decision (cap). |
| Dynamic event names with `{property}` placeholders | `SupportEvents.php:127-134` | TRANSFERABLE-GAP-16 (advanced). |
| Listeners registered once on mount (effect) | `SupportEvents.php:55-64` | TRANSFERABLE-GAP-16/17. |
| Browser CustomEvents as the bus; bubbling=broadcast | `js/events.js:4-69` | TRANSFERABLE-GAP-16 — same mechanism works with htmx/Lit (DOM events). |
| `dispatchTo` by registered name (cross-component) | `js/events.js:24-30` | TRANSFERABLE-GAP-16. |
| Server dispatches fired after triple microtask (post-morph) | `supportDispatches.js:10-17` | TRANSFERABLE-GAP-16 (subtle ordering: listeners must see patched DOM). |
| Authorization re-applied on listener path | `SupportEvents.php:29-36` | TRANSFERABLE-GAP-5. |
| Nested listener `@event` attr → `$parent.handler` | `SupportNestedComponentListeners.php:20-29` | TRANSFERABLE-GAP-16 (parent-listens-to-child). |
| Internal `EventBus` (before/after/finisher middleware) | `EventBus.php:9-107` | N/A — internal framework hook bus, distinct from component events; lievit's APT-generated lifecycle is the analog. |

## H. File uploads / downloads

| decision | Livewire (`file:line`) | lievit status |
|---|---|---|
| Dedicated upload/preview endpoints (bypass snapshot round-trip) | `SupportFileUploads.php:34-38` | TRANSFERABLE-GAP-25. |
| Three-phase start→finish→error, event-driven | `WithFileUploads.php:13-121` | TRANSFERABLE-GAP-25. |
| Signed HMAC temp-path tokens (8-char) | `TemporaryUploadedFile.php:266-289` | TRANSFERABLE-GAP-25 (signed short-lived refs). |
| S3 browser-direct presigned PUT; no multiple on S3 | `GenerateSignedUploadUrl.php:18-62` | TRANSFERABLE-GAP-25. |
| Default rules `required|file|max:12288`, throttle `60,1` | `FileUploadConfiguration.php:102-121` | TRANSFERABLE-GAP-25. |
| Progress via XHR `upload.progress` + 5 CustomEvents | `supportFileUploads.js:186-191,20-32` | TRANSFERABLE-GAP-25 (client). |
| Serial upload queue per property | `supportFileUploads.js:140-146` | TRANSFERABLE-GAP-25. |
| Opportunistic 24h temp cleanup on upload | `WithFileUploads.php:28-32,123-139` | TRANSFERABLE-GAP-25. |
| Downloads ride the response as base64 `download` effect | `SupportFileDownloads.php:12-46` | TRANSFERABLE-GAP-17 (needs effects channel). |
| Client rebuilds file via Blob + invisible anchor click | `supportFileDownloads.js:3-53` | TRANSFERABLE-GAP-17 (client). |

## I. Pagination / polling / loading / lazy

| decision | Livewire (`file:line`) | lievit status |
|---|---|---|
| Pagination opt-in via trait, `$paginators` keyed state | `SupportPagination.php:31-34`, `HandlesPagination.php:10` | TRANSFERABLE-GAP-26. |
| Override Laravel paginator resolvers per-component, restore at destroy | `SupportPagination.php:36-85` | N/A — Laravel global-state trick; lievit (long-lived JVM) must NOT port static mutation; use request scope. |
| URL-integrated by default, `WithoutUrlPagination` opt-out | `SupportPagination.php:95-135` | TRANSFERABLE-GAP-26 (depends on GAP-13). |
| `wire:poll` default 2000ms, `$refresh` default action | `wire-poll.js:5-6,27` | TRANSFERABLE-GAP-23. |
| Shared synchronized timer per interval | `wire-poll.js:59-81` | TRANSFERABLE-GAP-23 (client opt). |
| Background-tab throttle (drop ~95% unless `.keep-alive`) | `wire-poll.js:14,96-106` | TRANSFERABLE-GAP-23 (the intelligence htmx lacks). |
| `.visible` viewport gating; offline/expiry pause | `wire-poll.js:15,108-125` | TRANSFERABLE-GAP-23. |
| `wire:loading` driven by request lifecycle, target scoping | `wire-loading.js:7-26,188-219` | TRANSFERABLE-GAP-19. |
| Named delay tiers (50..1000ms) to avoid flicker | `wire-loading.js:28-71` | TRANSFERABLE-GAP-19 (the anti-flicker idea). |
| `data-loading` attr auto-set on origin element | `supportDataLoading.js:3-27` | TRANSFERABLE-GAP-19. |
| Forms auto-disabled during request (readonly text, disabled rest) | `supportDisablingFormsDuringRequest.js:11-73` | TRANSFERABLE-GAP-19 (double-submit guard). |
| `#[Lazy]`/`#[Defer]`: placeholder now, mount on 2nd request | `SupportLazyLoading.php:97-138` | TRANSFERABLE-GAP-15. |
| Lazy=`x-intersect`, Defer=`x-init` trigger | `SupportLazyLoading.php:167-169` | TRANSFERABLE-GAP-15 (map to IntersectionObserver / `l:init`). |
| Mount params smuggled via base64 throwaway-component snapshot | `SupportLazyLoading.php:140-154` | TRANSFERABLE-GAP-15 (signed-params-survive-to-deferred-mount pattern). |
| Isolation default-on, `.bundle` opt-out | `SupportLazyLoading.php:51,63-64` | TRANSFERABLE-GAP-15/20. |
| Placeholder resolution order with `<div></div>` fallback | `SupportLazyLoading.php:180-203` | TRANSFERABLE-GAP-15. |
| `wire:init` runs an action on element init | `js/directives/wire-init.js:5-11` | TRANSFERABLE-GAP-15 (the `l:init` primitive). |

## J. Nested components / reactive props / computed / forms / URL / models

| decision | Livewire (`file:line`) | lievit status |
|---|---|---|
| Child tracked by `key`, id stable across renders | `SupportNestingComponents.php:81,93-111` | TRANSFERABLE-GAP-22. |
| Already-rendered child → stub, skip re-render | `SupportNestingComponents.php:17-31` | TRANSFERABLE-GAP-22 (perf + state preservation). |
| `wire:key` injected into HTML root | `SupportNestingComponents.php:41-45` | TRANSFERABLE-GAP-22 (`l:key`). |
| Security-validate reused tag/id (regex) before echo | `SupportNestingComponents.php:99-108` | TRANSFERABLE-GAP-4 (injection guard on memo-derived HTML). |
| Compile-time auto-derived loop keys | `SupportCompiledWireKeys.php:167-190` | TRANSFERABLE-GAP-22 — lievit's JTE/HtmlFlow compile step could auto-key loops (devs forget). |
| `#[Reactive]` prop immutable in child, hash-checked | `BaseReactive.php:21,62-66` | TRANSFERABLE-GAP-16 (one-way data flow; needs nested components). |
| Reactive value re-pushed each request from parent | `SupportReactiveProps.php:24-26` | TRANSFERABLE-GAP-16. |
| Skip child request if reactive inputs unchanged | `SupportReactiveProps.php:53-84` | TRANSFERABLE-GAP-20 (batching/skip optimization). |
| `#[Modelable]` two-way bind into child (Alpine x-modelable) | `SupportWireModelingNestedComponents.php:88-91` | TRANSFERABLE-GAP-16 (parent override-wins ordering, `BaseModelable.php:45-54`). |
| `#[Computed]`, per-request memo, persist/cache tiers | `BaseComputed.php:31-95` | TRANSFERABLE-GAP-12. |
| Computed not directly callable (caching never bypassed) | `BaseComputed.php:23-29` | TRANSFERABLE-GAP-12. |
| Form objects: typed prop, prefixed errors, own lifecycle | `Form.php`, `SupportFormObjects.php:25-99` | TRANSFERABLE-GAP-14. |
| Form reuse on consolidated update (keep booted attribute state) | `FormObjectSynth.php:36-44` | TRANSFERABLE-GAP-14. |
| `#[Url]` query-string binding (as/history/keep/except/nullable) | `BaseUrl.php:12-18` | TRANSFERABLE-GAP-13. |
| Present-vs-absent sentinel; partial array merge; defensive decode | `BaseUrl.php:57-110` | TRANSFERABLE-GAP-13 (attacker-controlled input hardening). |
| URL push (history) vs replace; popstate handling | `supportQueryString.js:20-71` | TRANSFERABLE-GAP-13 (client; needs htmx reimpl). |
| Models serialize identity-only (class+key), re-fetched on hydrate | `ModelSynth.php:21-87` | TRANSFERABLE (pattern) — entity binding: carry an identity reference, re-load server-side, never ship row data to client. Relevant for HouseTree-style CRUD. |
| Legacy model binding opt-in; bindable only if a rule exists | `EloquentModelSynth.php:101-105` | TRANSFERABLE (security pattern) — the validation rule IS the mass-assignment allowlist; lievit's `@Wire` on a nested object should require explicit per-field opt-in. |
| `Wireable` interface (author-defined round-trip) | `Wireable.php:5-10`, `WireableSynth.php` | DIVERGENT — lievit's `@LievitProperty(serialize/transform)` (ADR-0002) is the bounded analog; no open `@class`. |
| Class guard on hydrate even with checksum (defense-in-depth) | `WireableSynth.php:38`, `ModelSynth.php:66` | TRANSFERABLE-GAP-4. |

## K. JS integration / Alpine / morph / navigate (mostly N/A — no Alpine)

| decision | Livewire (`file:line`) | lievit status |
|---|---|---|
| `$wire` Proxy: state + magic + server methods on one object | `$wire.js:62-90` | DIVERGENT — lievit's client model is htmx + Lit islands (README), not a JS proxy over the component. |
| Three data copies: canonical/ephemeral/reactive; diff to send | `component.js:35-39` | TRANSFERABLE (pattern) — sending only changed `@Wire` fields (`_updates`) needs a client-side canonical-vs-current diff; lievit specs `_updates` (ADR-0001) but not how the client computes the diff without Alpine reactivity. |
| `Alpine.entangle` two-way local↔server binding | `supportEntangle.js:12-49` | N/A — most Alpine-specific feature; lievit's Lit islands hold ephemeral state, server holds truth (README "state has one owner"). |
| `@js`/`$js` server→client JS (named + one-shot) | `supportJsEvaluation.js:13-32` | DIVERGENT — lievit forbids inline script / arbitrary client expression eval (README, CSP); behavior lives in `frontend/src/*.ts`. No gap, deliberate. |
| Per-component JS module auto-loaded (`@script`/`@assets`) | `SupportJsModules.php:16-43` | DIVERGENT — lievit uses Lit components imported by `main.ts`. |
| `wire:ignore[.self/.children]` morph exclusion | `wire-ignore.js:3-11`, `morph.js:147-149` | TRANSFERABLE-GAP-24. |
| Morph engine = `@alpinejs/morph` (NOT Idiomorph) | `lifecycle.js:13,24`, `morph.js:61` | DIVERGENT / CORRECTION — *PR #5 flagged ADR-0001's claim that Idiomorph "converges with Livewire v3" is wrong* (Livewire uses Alpine's morph; Turbo 8 is the Idiomorph precedent). lievit's Idiomorph choice stands; fix the justification text. |
| Morph keys by `wire:id`→`wire:key`→`id` | `morph.js:188-197` | TRANSFERABLE-GAP-22 (Idiomorph keys similarly; spec `l:key`). |
| Child components cloned to preserve state across morph | `morph.js:40-56` | TRANSFERABLE-GAP-22. |
| Fragment markers via HTML conditional comments | `fragment.js:76-82` | TRANSFERABLE-GAP-17 (slots/islands boundary scheme). |
| `wire:navigate` SPA over Alpine plugin (prefetch/persist/scroll/back-cache) | `js/plugins/navigate/` | TRANSFERABLE-GAP-30 (htmx `hx-boost` partial). |
| Back-button no-store middleware | `DisableBackButtonCacheMiddleware.php:21-31` | TRANSFERABLE-GAP-30 (sensitive pages). |
| JS hook bus + interceptors (request/message/component) | `hooks.js:11-92`, `request/interceptor.js` | TRANSFERABLE (pattern) — lievit's client needs *some* request-lifecycle hook points (loading, dirty, errors all hang off these); design without Alpine. |
| Request batching (5ms buffer, fingerprint squash, scope symbols) | `request/index.js:266-301`, `messageBus.js` | TRANSFERABLE-GAP-20. |
| Response = `{snapshot, effects}` JSON channel | `request/index.js:418-455` | TRANSFERABLE-GAP-17. |
| `X-Livewire: 1` header (Cloudflare won't strip) | `request/index.js:314` | TRANSFERABLE (minor) — lievit needs a request-marker header for the CSRF/header guard (GAP-6). |
| AbortController per request, cancellation cascade | `request/request.js:37-49` | TRANSFERABLE (minor) — superseded-request cancellation. |

## L. Streaming / redirects / session / page / isolating / slots / teleport / transitions / islands

| decision | Livewire (`file:line`) | lievit status |
|---|---|---|
| Streaming = chunked `text/event-stream` + `flush()`, same request | `SupportStreaming.php:48-67` | TRANSFERABLE-GAP-21. |
| Stream targets: directive/element/ref; replace vs append | `SupportStreaming.php:27-37` | TRANSFERABLE-GAP-21. |
| Redirect = effect (not 302) on AJAX; real 302 fallback | `SupportRedirects.php:61-67` | TRANSFERABLE-GAP-18. |
| `navigate:true` redirect uses SPA nav | `HandlesRedirects.php:13` | TRANSFERABLE-GAP-18/30. |
| Skip-render-on-redirect default | `HandlesRedirects.php:15-17` | TRANSFERABLE-GAP-18. |
| Redirector container swap (all redirect idioms → effect) | `SupportRedirects.php:33-47` | N/A — Laravel container trick; lievit uses Spring MVC's redirect. |
| `#[Session]` property persisted to session | `BaseSession.php:9-28` | TRANSFERABLE (minor) — declarative session persistence; decide if lievit needs it (vs server-side state). |
| Flash kept/cleared based on whether a redirect happened | `SupportRedirects.php:20-24` | TRANSFERABLE-GAP-18 (subtle: an AJAX update is not a page load, flash must be managed). |
| Page component as invokable controller; `#[Layout]`/`#[Title]` | `HandlesPageComponents.php:7-33`, `BaseLayout.php` | TRANSFERABLE-GAP-31. |
| Route params → `mount()` via model binding | `SupportPageComponents.php:126-156` | TRANSFERABLE-GAP-31 (Spring MVC `@PathVariable` → `@LievitMount` params). |
| `#[Isolate]` opt-out of batching (memo flag) | `BaseIsolate.php:7-11`, `SupportIsolating.php:9-21` | TRANSFERABLE-GAP-20 (lievit is isolated-by-default; this is Livewire's opposite default). |
| Slots via fragment markers; `$slot`/`$slots` proxy | `Slot.php:46-53`, `SlotProxy.php` | TRANSFERABLE (pattern) — JTE has its own content/slot mechanism; map `@param Content content` (lievit README) rather than copy. |
| Skipped-child slot capture (effects) | `SupportSlots.php:64-72` | TRANSFERABLE-GAP-15/17 (lazy + slots interaction). |
| `@teleport` → Alpine `x-teleport` | `SupportTeleporting.php:12-18` | N/A — no Alpine; lievit would use a Lit/DOM teleport if needed. |
| `wire:transition` = native View Transitions API, JIT names | `wire-transition.js:120-137,11-30` | TRANSFERABLE (minor) — `l:transition` over the View Transitions API is framework-agnostic; reduced-motion handling (`:55-71`) is a nice a11y default. |
| Islands = named partial-render regions, fragment-marked, modes morph/append/prepend/skip | `SupportIslands.php:17-86`, `js/island.js` | TRANSFERABLE-GAP-17 (advanced; v4 feature). lievit's `<lievit-*>` custom elements + islands could map; defer. |
| Island targeted re-render (component skipRender) | `HandlesIslands.php:107-141` | TRANSFERABLE-GAP-17/20 (partial update without full re-render). |

## M. Misc directives + testing

| decision | Livewire (`file:line`) | lievit status |
|---|---|---|
| `wire:dirty` = client diff canonical vs current | `wire-dirty.js:44-62` | TRANSFERABLE-GAP-27. |
| `wire:offline` = native online/offline events | `wire-offline.js:7-20` | TRANSFERABLE-GAP-28. |
| `wire:show`/`wire:text`/`wire:bind` → Alpine x-* | `wire-show.js:4` etc. | N/A — htmx/Lit equivalents or plain server render. |
| `wire:sort` → Alpine x-sort (SortableJS) | `supportWireSort.js:6` | N/A — Lit island if needed. |
| `wire:current` active-nav, recompute on navigated | `wire-current.js:1,12` | TRANSFERABLE (minor) — active-link helper for SPA nav (GAP-30). |
| `$wire.$refs` element refs persisted via memo | `SupportWireRef.php:8-10` | TRANSFERABLE (minor) — element refs; low priority. |
| `wire:preserve-scroll` (action-level height compensation) | `supportPreserveScroll.js:17-28` | TRANSFERABLE-GAP-19/30 (no scroll jump on height change). |
| Auto-inject Livewire JS/CSS into head/body | `SupportAutoInjectedAssets.php:24` | TRANSFERABLE (minor) — lievit needs its client script injected; ADR-0008 packaging is the home. |
| Large-payload `String.fromCharCode` overflow guard | `SupportLargePayloads/BrowserTest.php:18` | N/A — JS impl detail; relevant only when lievit's client hashes large payloads. |
| `Livewire::test()` runs a real fake request cycle (no network) | `Testable.php:44-60`, `InitialRender.php`, `SubsequentRender.php` | TRANSFERABLE-GAP (testing) — lievit should ship a `Lievit.test(Component.class)` harness: GET initial render, then POST `_calls`/`_updates` to the real endpoint with security/exception bypass, immutable state carrier. |
| Fluent assertions: `assertSet`/`assertSee`/`assertDispatched`/`assertRedirect`/`assertHasErrors` | `MakesAssertions.php`, `TestsEvents.php`, `TestsRedirects.php`, `TestsValidation.php` | TRANSFERABLE-GAP (testing) — the assertion vocabulary to mirror once the corresponding features land. Fits lievit's contract-first/TDD law (repo CLAUDE.md). |
| Effects ledger access + Laravel TestResponse passthrough | `Testable.php:376-420` | TRANSFERABLE-GAP (testing) — the test API reads the effects channel (GAP-17). |

---

## Count

**Decisions catalogued: 180+** across 13 areas (A–M), each with a `file:line` citation.
**TRANSFERABLE-GAP items: 32** (the don't-miss list above), of which the **8 security items are the
highest priority** (and item 1, `#[Locked]`, was the original PR #5 finding — confirmed and
detailed here). **Corrections to existing lievit ADRs: 3** (deferred-by-default `l:model`; 150ms not
500ms `.live` debounce; the Idiomorph "converges with Livewire" justification is factually wrong —
all three were first surfaced by PR #5 and are restated here in context).

## Cross-references

- PR #5 / `livewire-internals.md` — the protocol-depth companion; this doc is the breadth pass.
- ADR-0001 / `wire-protocol.md` — the wire protocol the security gaps (1–8) and channel gaps (17–21)
  attach to.
- ADR-0002 — the seven-annotation cap that constrains how new hooks (boot, updated, events,
  computed, url, lazy) may be added: prefer fields-on-existing-annotations and conventions over an
  8th annotation; any genuinely-new annotation needs an ADR superseding 0002.
- ADR-0006 — zero runtime reflection: the reason Livewire's synthesizer registry / open `@class`
  serialization / gadget-denylist-via-`is_a` are DIVERGENT (lievit serializes by compile-time-known
  declared types, which is also the security win in GAP-4).
