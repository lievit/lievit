# Developer testing DX: testing YOUR components on lievit

> **Scope (sharp).** This document is about the testing experience lievit gives to a developer who
> is **building an application on lievit** and wants to test **their own** components. It is *not*
> about lievit's internal test suite (codec, lifecycle, property-based, fuzzing): that is lievit's
> own quality, covered by ADR-0007, and from the user's seat it is invisible magic that simply has
> to be true. Everything below is from one seat: *"I am a dev with a `@LievitComponent` I wrote.
> How do I test it, and is it delightful?"*

The thesis, in one line: **lievit's server-driven, typed, deterministic wire lets a developer test
more of their component's real behaviour in a fast in-process test than Livewire can, because the
behaviour Livewire pushes into a flaky browser (Dusk / Pest-browser) is, in lievit, on the server
where a `MockMvc`-grade test can reach it.** Part 1 is the evidence for the Livewire gap; Part 2 is
the `Lievit.test()` proposal that turns lievit's architecture into a developer-facing feature.

---

## Part 1 — The Livewire user's real testing experience (the evidence)

Livewire ships a genuinely good first-party component-test API, `Livewire::test()`. The point of
this section is not that it is bad: it is to map, with citations, the **exact line** where the
component test stops being able to cover the component's behaviour, and the user is forced into a
real browser. That line is where flakiness, slowness, and the "green test, broken page" class of
bug live.

### 1.1 What `Livewire::test()` lets the user assert (the good part)

From the seat of a dev testing their Livewire component, `Livewire::test('post.create')` returns a
fluent tester that runs the component **server-side, without a browser**, and lets them:

- **Set / assert properties** — `set('title', '…')` / `assertSet('title', '…')` /
  `assertNotSet` / `assertCount` (`docs/testing.md:200-208`, `:488-503`).
- **Call actions** — `call('save')`, with parameters `call('deletePost', $id)`
  (`docs/testing.md:259-285`).
- **Assert rendered HTML** — `assertSee('…')`, `assertDontSee`, `assertSeeHtml('<div>…')`,
  `assertSeeInOrder([...])` (`docs/testing.md:132-145`, `:504-508`).
- **Assert view data** — `assertViewHas('posts', fn ($posts) => count($posts) === 3)`
  (`docs/testing.md:148-169`).
- **Assert events** — `assertDispatched('post-created', …)` / `assertNotDispatched`
  (`docs/testing.md:352-402`).
- **Assert validation** — `assertHasErrors(['title' => ['min:3']])` / `assertHasNoErrors`
  (`docs/testing.md:286-308`).
- **Assert auth / redirect / status** — `assertForbidden()`, `assertUnauthorized()`,
  `assertRedirect('/posts')`, `assertStatus(500)` (`docs/testing.md:310-350`, `:526-528`).
- **Run authenticated** — `Livewire::actingAs($user)` (`docs/testing.md:171-194`).

This is a lot, and most of it is server-side state-machine behaviour. A Laravel dev can test the
business logic of a Livewire component fast and headless. **That part lievit must match or beat.**

### 1.2 The practical gap: what the component test CANNOT cover

`Livewire::test()` exercises the **PHP** side of the roundtrip: hydrate snapshot → set props →
call action → re-render → read state/HTML. It does **not** run the **JavaScript** side. Everything
Livewire's own client (`livewire.js` / Alpine) does in the browser is absent from the component
test. The Livewire docs are explicit that the browser path is a *separate* tool
(`Livewire::visit()` over Pest-browser/Playwright, `docs/testing.md:89-128`). So the following
behaviours of the user's OWN component are simply **not reachable** from `Livewire::test()`:

1. **`wire:model` live binding and update-timing modifiers.** The whole `.live` / `.lazy` /
   `.blur` / `.debounce.Xms` machinery is **client-side**: it decides *when* the browser sends a
   network request as the user types. The doc states the default outright: *"By default, Livewire
   will only send a network request when an action is performed … NOT when a `wire:model` input is
   updated"* (`docs/wire-model.md:53-55`), and the timing logic lives in JS
   (`js/directives/wire-model.js:31-44`: it splits modifiers at the `.live` boundary to decide
   client-sync vs network timing). `Livewire::test()->set('title', …)` jumps straight to the
   *server* state and **bypasses this entire layer** — the test cannot tell you whether a real
   keystroke would have debounced, fired, or deferred. A `wire:model.live.debounce.300ms` typo that
   floods the server on every keystroke passes every component test.

2. **Morphing (DOM identity preservation).** Livewire patches the DOM by *morphing*, not replacing
   innerHTML, to preserve focus, selection, scroll, in-flight transitions, and uncontrolled input
   state (`docs/morph.md:1-6`). Morph correctness depends on `wire:key` placement in `@foreach`
   loops (`docs/morph.md:29-53`). `assertSee()` checks the *rendered string*; it cannot observe
   that after the patch the cursor jumped, focus was lost, or a list re-ordered wrongly because a
   `wire:key` was missing. This is the canonical **"green test, broken page"**: the HTML contains
   the right text, the morph behaviour around it is broken, and only a browser catches it.

3. **Loading / transition states.** Livewire auto-adds `data-loading` to any element that triggers
   a request, and `wire:loading` / `wire:dirty` toggle UI during the in-flight window
   (`docs/loading-states.md:1-9`, `:23-28`; `docs/dirty.md:1-32`). These exist **only while a
   network request is in flight in a real browser**. A headless component test has no in-flight
   window — the request is synchronous PHP. The loading spinner, the disabled button, the "Unsaved
   changes…" indicator (`docs/dirty.md:16-32`) are untestable without a browser.

4. **File uploads.** Livewire's upload is a multi-step, JS-driven, temporary-file dance
   (`wire:model` on a file input → JS upload → server validation). Components tests can stub the
   PHP side but not the client upload protocol.

5. **The security rate-limit, silently disabled in tests.** Livewire blocks a client after 10 bad
   checksums in 600 s to stop offline brute-forcing of the HMAC (`Checksum.php:11-12`,
   `enforceRateLimit`). But that guard **short-circuits inside unit tests**: `enforceRateLimit()`
   opens with `if (app()->runningUnitTests() && ! static::$rateLimitingEnabledForTesting) return;`
   (`Checksum.php:31`). So the very security behaviour a developer might want to assert is, by
   default, *not exercised by the component test at all* — it only fires on a real request. This is
   a precise instance of the gap: a security-relevant behaviour that the fast test cannot see.

6. **`#[Locked]` is asserted at the PHP boundary, but the *attack* is a JS/devtools tamper.**
   `#[Locked]` throws when a client tampers with a property (`docs/attribute-locked.md:1`, `:32`).
   The Livewire testing doc (`docs/testing.md`) lists **no** dedicated assertion for "a client
   update to a locked property was rejected" — the closest the user has is `assertForbidden()`
   / `assertStatus()`, and there is no `set()`-bypassing-the-lock path documented, because `set()`
   in the tester is a *trusted* server-side mutation, not a *client* update. The user cannot, with
   the documented API, easily simulate "the browser sent an `_updates` entry for `postId`" and
   assert the rejection. The defense exists; the *test of the defense from the attacker's seat* is
   awkward in the component test and tends to drift to the browser/integration layer.

### 1.3 The consequence: a forced split, and where flakiness lives

The result is a hard line through the user's test suite:

| The user's component behaviour | Where Livewire makes them test it | Cost |
|---|---|---|
| Property state, actions, validation, events, view data, auth, redirect | `Livewire::test()` — fast, headless | cheap, stable |
| `wire:model` timing, morph identity, loading/dirty UI, uploads, the live tamper of a locked field | `Livewire::visit()` — real browser (Pest-browser / Playwright) | slow, flaky, env-dependent |

The doc itself frames the browser tier as the slow, last-resort tier: *"Browser tests are slower
than unit tests but provide end-to-end confidence"* and *"Use browser tests for critical user
flows … For most component testing, the standard `Livewire::test()` approach is faster and
sufficient"* (`docs/testing.md:123`, `:127-128`). Read from the user's seat, that is an admission:
**a meaningful slice of your component's real behaviour is only testable in the slow, flaky tier.**
And the most dangerous part is item 2 — *the test is green and the page is broken* — because the
broken behaviour (morph, focus, live binding) lives precisely in the layer the green test never
ran.

This is the gap lievit's testing DX must close: **move the line.** Pull as much of the
"browser-only" column back into the fast, headless, deterministic column as the architecture
allows, and make the small browser tier that genuinely remains *honest about why it remains*.

---

## Part 2 — The testing DX lievit should give its users (the proposal)

### 2.1 Why lievit can move the line (the architecture is the feature)

Three lievit decisions, made for other reasons, happen to make the user's behaviour more testable
without a browser than Livewire's. This is the load-bearing claim of the whole proposal:

1. **Server-driven, typed wire.** A `@Wire` field is a typed Java field; an action is a typed
   method (ADR-0002). Hydrate → updates → calls → re-render is a pure server lifecycle
   (`WireDispatcher.call`, `wire-protocol.md` phases 3-4). A test can drive the *real* pipeline
   in-process and read back *typed* state, not a stringly-typed bag.

2. **The wire is deterministic and inspectable.** The snapshot is a signed, JSON-shaped
   `{cid, cls, wire, iat, exp}` (`wire-protocol.md` §2). The re-render returns HTML + a fresh
   signed `Lievit-Snapshot` (phase 4). Every interaction has a deterministic, byte-stable
   request/response — exactly the triple ADR-0007 already byte-checks internally. A user test can
   carry the real snapshot across calls, just like the browser does, with **zero** browser.

3. **The security boundary is server-side and reachable.** The locked-field rejection is a server
   decision in `WireDispatcher.applyUpdates` (`403` + `Lievit-Reason: locked-property`), and the
   checksum-failure limiter is a server component (`ChecksumFailureLimiter`) on the real call path
   — **not** short-circuited in tests the way Livewire's is (`Checksum.php:31`). So the user can
   assert the defense *from the attacker's seat* (send a hostile `_updates` entry) in a fast test.

The precedent already exists in the repo: `CounterRoundtripIT` mounts the Counter, carries its real
signed snapshot into a `POST /lievit/{id}/call`, asserts the re-rendered HTML advanced, asserts the
locked-field tamper is rejected `403`, and asserts a tampered snapshot is rejected — all
**headless, over the real codec/registry/dispatcher/JTE/HTTP stack**
(`lievit-spring-boot-starter/src/test/java/.../counter/CounterRoundtripIT.java`). That is exactly a
*user's* component test today. The problem is only that it is **verbose**: hand-built JSON maps,
raw `MockMvc`, string-grep HTML, manual snapshot juggling. The proposal is to wrap that proven path
in an ergonomic, fluent harness so the user writes the *intent*, not the plumbing.

### 2.2 The proposed user-facing API: `Lievit.test(MyComponent.class)`

A fluent tester that mounts the user's component through the **real** wire pipeline and returns a
chainable assertion object. It is the lievit answer to `Livewire::test()`, designed so the four
Livewire browser-only behaviours that *can* be server-driven become headless assertions.

```java
// The user's test of THEIR component. Headless. Fast. Over the real wire.
import static dev.lievit.test.Lievit.test;

@LievitTest                 // meta-annotation: @SpringBootTest slice + the test signing key + MockMvc
class CounterComponentTest {

    @Test
    void increment_advances_the_count_and_renders_it() {
        test(CounterComponent.class)
            .mount()                                  // phase 1-2: build, @LievitMount, render, sign
            .assertWire("count", 0)                   // typed state read-back, not a string grep
            .assertSee(">0<")                         // rendered HTML contains
            .call("increment")                        // phase 3-4 over the REAL signed snapshot
            .assertWire("count", 1)
            .assertSee(">1<")
            .assertSnapshotRotated();                 // a fresh Lievit-Snapshot came back
    }

    @Test
    void model_update_then_action_round_trips() {
        test(SearchComponent.class)
            .mount()
            .model("query", "parma")                  // simulate an l:model update entry on the wire
            .call("search")                           // the deferred model rides with the action
            .assertWire("results.size", 3)            // typed, navigable state
            .assertSee("Found 3");
    }

    @Test
    void a_client_cannot_write_a_locked_field() {
        test(CounterComponent.class)
            .mount()
            .tamperUpdate("label", "attacker-set")    // a HOSTILE _updates entry, attacker's seat
            .call("increment")
            .assertRejected(LockedProperty.class);    // 403 + Lievit-Reason: locked-property
    }

    @Test
    void brute_forcing_the_signature_is_rate_limited() {
        var t = test(CounterComponent.class).mount();
        for (int i = 0; i < 10; i++) t.forgeSnapshot().callExpectingRejection();
        t.forgeSnapshot()
         .call("increment")
         .assertRejected(TooManyFailures.class);      // 429 — REACHABLE, unlike Livewire's
    }
}
```

**The assertion surface** (Livewire-parity where it makes sense, plus what lievit can do that
Livewire cannot):

| lievit assertion | Livewire analogue | Notes |
|---|---|---|
| `assertWire("count", 1)` | `assertSet('count', 1)` | typed; supports `"results.size"`-style navigation into the typed state |
| `assertWireMatches(c -> c.count() == 1)` | `assertViewHas(…, closure)` | a typed predicate over the **real component instance**, no stringly view bag |
| `assertSee("…")` / `assertDontSee` / `assertSeeHtml` / `assertSeeInOrder` | same | over the real re-rendered HTML fragment |
| `assertSnapshotRotated()` / `assertSnapshotValid()` | — | the wire produced a fresh, well-signed snapshot (lievit-specific) |
| `assertRejected(LockedProperty.class)` | (awkward in Livewire) | the locked-field defense, asserted from the attacker's seat, headless |
| `assertRejected(SnapshotExpired.class)` / `…(UnknownComponent.class)` | — | the error-code state machine (409/410), driven deterministically |
| `assertRejected(TooManyFailures.class)` | **untestable in Livewire** (`Checksum.php:31`) | the rate-limit, reachable because lievit's limiter is on the real path |
| `assertModelDeferred("query")` / `assertModelLive("query")` | **browser-only in Livewire** | the `l:model` modifier *intent* is declared in the typed template/component and is assertable server-side (see 2.4) |

Failure messages are a first-class DX concern (the lievit brand is "looks done = is done"): a failed
`assertWire("count", 1)` reads `expected @Wire count == 1 but was 0 after calls [increment]`, and a
failed `assertRejected` reads `expected the call to be rejected with locked-property (403) but it
returned 200 and rendered <…>`. The tester carries the call history so every message names the
sequence that produced the state.

### 2.3 The user's testability ladder (which tier the user writes, and why)

lievit gives the user **three** tiers, and the design goal is that tier 2 is *fat* (it absorbs most
of what Livewire forces into a browser) and tier 3 is *thin and honest*.

```
  Tier 1 — Pure unit of THEIR own logic           (milliseconds, zero lievit, zero Spring)
    The component is a plain Java class. A @Wire field is a field; an @LievitAction is a method.
    `new CounterComponent().increment(); assertThat(count).isEqualTo(1);`
    No framework. This is where domain/business logic of the component is tested. Fastest, most.

  Tier 2 — THEIR component round-trip over the real wire   (tens of ms, Spring slice, NO browser)
    `Lievit.test(MyComponent.class)` — the FAT tier. Drives mount → model → action → re-render
    over the real codec/registry/dispatcher/template/HTTP edge. Covers, headless:
      - state transitions through the real lifecycle (rehydrate → updates → calls → render)
      - the rendered HTML fragment for each interaction
      - the locked-field rejection (attacker's seat)
      - the error-code state machine (409 expired / 410 unknown / 413 / 504 / 429)
      - l:model modifier INTENT (deferred vs live) as declared, server-side (2.4)
    This is the tier that MOVES THE LINE: most of Livewire's "browser-only" column lives here.

  Tier 3 — The minimal browser E2E that TRULY remains    (seconds, Playwright, locate by role/text)
    Only the behaviours that are irreducibly in the browser:
      - Idiomorph DOM-identity preservation (focus/selection/scroll survive a patch)
      - the actual debounce TIMING of l:model.live (wall-clock keystroke behaviour)
      - data-loading / l:dirty visual states during a real in-flight window
      - file upload client protocol
    Happy-path only, located by role/text never CSS (ADR-0007). Edge cases stay in Tier 2.
```

The contrast with Livewire is the whole point. In Livewire, tier 2 (`Livewire::test()`) cannot
reach the locked-field tamper, the rate-limit, or the `l:model` intent, and the morph/loading/live
behaviours all sit in tier 3. In lievit, tier 2 reaches everything except the four genuinely
browser-bound behaviours, and tier 3 shrinks to exactly those four — *and the test author can see
why each tier-3 test is irreducible, because the doc and the API say so.*

### 2.4 The one subtle claim: testing `l:model` intent without a browser

The honest boundary: lievit **cannot** test the wall-clock debounce *timing* of `l:model.live`
headless — that is real-browser keystroke physics and stays in tier 3. But it **can** test the
*intent*, which is where the bug usually is. The `l:model` modifier is declared in the template
(multi-file JTE) or the typed DSL (single-file). Because lievit parses templates server-side (the
template adapter, ADR-0004, and the GraalVM-native zero-reflection model, ADR-0006, both require
build-time knowledge of the template), the harness can assert *"the `query` field is bound
`l:model.live` with a 300 ms debounce"* and *"the `title` field is deferred (no `.live`)"* against
the parsed binding metadata. That catches the common Livewire-class bug — *"I meant `.live`, I
wrote nothing, the field silently never syncs until an action"* — in a fast test, where Livewire
can only catch it in the browser. This is a candidate capability for the harness, flagged as such
because it depends on the template-parse surface being exposed to test code (a v0.1-or-v0.2 call).

### 2.5 DX: ergonomics, boilerplate, and why this is a product feature

- **Boilerplate-free.** Today's `CounterRoundtripIT` hand-builds `Map.of("_snapshot", …, "_updates",
  Map.of(), "_calls", List.of("increment"))`, performs raw `MockMvc`, and greps the response string.
  `Lievit.test()` hides all of it: the user declares mount → model → call → assert. The plumbing is
  the harness's job, the intent is the user's.
- **The snapshot is invisible.** The tester carries the real signed snapshot across calls
  internally (it *must*, to exercise the real verify path), but the user never touches the JWT
  string. They get the realism of the real wire with the ergonomics of an in-memory object.
- **One annotation to wire the slice.** `@LievitTest` is a meta-annotation bundling the
  `@SpringBootTest` slice, the dev signing key, and `MockMvc` autoconfig, so the user does not
  re-derive the `@TestPropertySource(lievit.signing-key=…)` + `@AutoConfigureMockMvc` boilerplate in
  every test class (the four-annotation header on `CounterRoundtripIT` today).
- **Failure messages that name the cause.** Covered in 2.2; this is the difference between a test
  that *catches* a bug and a test that *explains* it.
- **It is a feature, not internal QA.** This harness ships *in* `lievit-spring-boot-starter`
  (test-scope) as `dev.lievit.test.Lievit`, documented in the README and the getting-
  started guide, the same way `Livewire::test()` is a documented Livewire feature. lievit's *own*
  internal tests (codec property-based, fuzzing, golden triples — ADR-0007) are a separate world the
  user never sees. `Lievit.test()` is the user's world.

### 2.6 Open design questions (deliberately flagged, not resolved here)

- **Template-parse surface for tier-2 `l:model` intent assertions (2.4):** does v0.1 expose the
  parsed binding metadata to test code, or is that a v0.2 capability? It gates `assertModelLive` /
  `assertModelDeferred`.
- **Where the harness lives:** `lievit-spring-boot-starter` test-scope is the obvious home, but a
  thin `lievit-test` module (depending only on `lievit-core` + a test-fixtures slice) would let the
  pure-Spring path be tested without the full starter. Ties into the module-packaging decision
  (ADR-0008, still proposed).
- **Action parameters:** Livewire's `call('delete', $id)` passes args; lievit's v0.1 `_calls` is a
  list of action *names* (`wire-protocol.md` §1). If/when parameterised actions land, the harness
  `call("delete", id)` follows; until then the harness mirrors the v0.1 name-only contract.
- **Multi-component / event interaction:** Livewire tests cross-component events
  (`docs/testing.md:365-379`). lievit's event story is not yet specified; the harness's
  `assertDispatched`-equivalent waits on that decision.

---

## References

- Livewire testing API and the browser-tier framing: `~/tmp-livewire/docs/testing.md`
  (component API `:200-528`; browser tier `:89-128`).
- `wire:model` deferred-by-default + JS timing: `~/tmp-livewire/docs/wire-model.md:53-55`;
  `~/tmp-livewire/js/directives/wire-model.js:31-44`.
- Morph / "green test, broken page": `~/tmp-livewire/docs/morph.md:1-53`.
- Loading / dirty (browser-only window): `~/tmp-livewire/docs/loading-states.md:1-28`;
  `~/tmp-livewire/docs/dirty.md:1-32`.
- `#[Locked]`: `~/tmp-livewire/docs/attribute-locked.md:1-43`.
- Rate-limit disabled in tests: `~/tmp-livewire/src/Mechanisms/HandleComponents/Checksum.php:11-12,31`.
- lievit wire protocol: `docs/wire-protocol.md` (lifecycle §1, snapshot §2, error state machine §4,
  l:model modifiers §5).
- lievit decisions: ADR-0001 (wire + locked + rate-limit amendment), ADR-0002 (seven-annotation
  cap, why no eighth annotation for the harness), ADR-0007 (lievit's *own* quality gates — the
  invisible magic, distinct from this user-facing harness).
- The precedent of a user's test today: `lievit-spring-boot-starter/src/test/java/io/
  lievit/spring/counter/CounterRoundtripIT.java`.
