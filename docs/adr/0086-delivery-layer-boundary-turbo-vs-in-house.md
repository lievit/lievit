# ADR-0086: The delivery-layer boundary — Turbo vs htmx vs in-house, decided per-piece (nav / morph / live)

- **Status:** accepted
- **Date:** 2026-06-24
- **Deciders:** Francesco Bilotta
- **Relates to:** ADR-0084 (renounce in-house where battle-tested exists; the cost test), ADR-0085 (adopt Turbo Drive for navigation), ADR-0019 (client runtime bundle + per-wire morph), ADR-0009 (first-party-only supply chain), ADR-0024 (wire-snapshot merge)

## Context

ADR-0084 set the **cost test** (adopt the battle-tested option when it is reputable + low-supply-chain
AND what you'd write is hard/critical AND it does not reopen a closed attack surface). ADR-0085 applied
it to ONE piece — page navigation — and adopted Turbo Drive. This ADR records the **complete, evidence-
based comparison across the whole delivery layer**: the three things that move HTML and state between
server and client, compared against the three reputable engines available (Turbo, htmx, Idiomorph), and
decided **per-piece**, not as a single "framework choice".

The delivery layer is three distinct pieces with three distinct contracts:

1. **NAVIGATION** — page-level: a link click or form submit fetches a new page and swaps `<body>` + history.
2. **MORPH** — per-wire-call: one component's re-render is reconciled against the server's authoritative
   wire state, preserving uncontrolled input, keyed identity, and in-flight transitions.
3. **LIVE / SSE** — out-of-band server→client push: the broadcast channel (#304/#45) and the AI text
   stream (#153), both over an `EventSource`.

A naive reading of ADR-0084/0085 ("renounce in-house where battle-tested exists") could be over-applied
to "so adopt Turbo for everything". That is wrong: the cost test is **per-piece**, and the same library
that wins navigation **loses** morph and live. The evidence below is why.

The constraints carried from the manifesto + earlier ADRs: **first-party-only** supply chain (vendored,
no CDN, no install-time scripts, ADR-0009), and a **strict CSP** (`script-src 'self'`, no `eval` /
`new Function`). Any adopted engine must survive both.

## Decision

**Decide each piece on its own contract. Delegate the GENERIC, non-differentiating engine (page
navigation) to a vendored reputable library; KEEP in-house the layers INTIMATE to lievit's typed
component model (the per-call morph hooks, the typed effects/event channel).** This is "glue golden path"
(ADR-0084's reframed identity) applied correctly: stand on giants for the generic-hard, invent only the
differentiated.

| Piece | Decision | Engine |
|---|---|---|
| **NAVIGATION** | **Adopt** (vendored, thin glue) | **Turbo Drive** (`@hotwired/turbo`, vendored, ADR-0085) |
| **MORPH** | **Keep in-house** (direct Idiomorph wiring) | `runtime/morph.ts` over vendored Idiomorph |
| **LIVE / SSE** | **Keep in-house** (typed channels) | `runtime/features/stream.ts` + `broadcast.ts` |

### NAVIGATION → Turbo Drive (ratifies ADR-0085)

Navigation is the **generic, non-differentiating engine**: fetch a page, swap the body, merge the head,
push history, restore scroll, prefetch, draw a progress bar. It is not lievit's value (the wire
reactivity is), and it is a large correctness surface.

Evidence:
- **Turbo is battle-tested and feature-complete in one vendorable artifact** (37signals, MIT, years of
  Rails production). The whole responsibility set maps onto Turbo-native mechanisms (ADR-0085 §3).
- **lievit's clone had 8 real bugs** found in the harden pass (in-flight nav race, focus loss, cache
  invalidation, title sync, ...) — non-differentiating debt we were paying to keep correct.
- **htmx is eliminated for navigation.** htmx's core mission is **partial-body swaps** (`hx-get` → a
  fragment into a target), not full SPA page navigation; full-page nav with history needs htmx core **+
  the `htmx-history`/boosting behavior + extensions**, and the canonical extension delivery is CDN-first
  — against the first-party-only posture. Decisively, **htmx evaluates attribute-encoded behavior** (it
  is the eval-shaped programming model), which is **incompatible with strict CSP** (`script-src 'self'`,
  no `eval`) without de-featuring it down to a subset. Turbo Drive, vendored, is `eval`-free and CSP-clean.
- The residual gaps (wire re-bind after a swap, the `lievit:navigate*` event bridge) are closed in the
  **~126-line glue** via Turbo's event API (`turbo:load` / `turbo:before-visit` / `turbo:before-render`),
  never by editing the vendored dist.

### MORPH → in-house (direct Idiomorph, `morph.ts`)

The morph **algorithm** is **Idiomorph in all three options** — lievit vendors it directly, Turbo 8 uses
it for page-refresh morphing, and the htmx morph extension wraps it. So there is **no algorithmic gain**
from switching to a wrapper: you get the same diffing either way. The question is purely **how many veto
hooks the wrapper forwards** — and lievit's morph contract needs **five**:

1. **client-owned `data-lievit-rt-*` markers** must survive a morph (the server never authors them);
2. **input value / checked (the lievit #13 rule)**: a server-asserted value clears/updates a dirty
   `.value`, an un-asserted re-render **keeps in-progress typing** — the inverse of Idiomorph's native
   input sync;
3. **`l:ignore`** skip / self / children (partial-freeze of a subtree);
4. **`l:transition`** deferred removal (an element animates out, removal waits for the transition);
5. **root reconcile** (attributes preserved, children morphed id-independently — ADR-0085 §"NOT replaced").

Only the **direct Idiomorph callbacks** (`beforeNodeMorphed`, `beforeAttributeUpdated`,
`afterNodeMorphed`, `beforeNodeRemoved`) give **all five**. The wrappers do not:

- **Turbo** forwards only **`beforeNodeMorphed`** as a real callback and **degrades the rest to DOM
  events** (coarser, less control), and it has **NO seam for `l:transition` deferred removal** — Turbo
  issue **#1477** (deferred/async removal on stream-morph) is **open**. Turbo's stream-morph is also
  **rAF-async**, which fights lievit's **synchronous** wire lifecycle (the effects loop expects the DOM
  settled when it returns).
- **htmx's morph extension** forwards **ZERO** of Idiomorph's hooks to the author and **gates its config
  behind `new Function`** — **CSP-illegal** here.

And lievit's wrapper is not merely "as good": it **fixes a shared open Idiomorph bug**. The Idiomorph
input-value-on-reorder issue (Idiomorph **#27 / #132**) is exactly lievit's **#13**, fixed in
`morph.ts`'s `afterNodeMorphed` value reconcile. Adopting a wrapper would **lose** that fix.

So for morph the cost test inverts: the library wrapper is **debt, not savings** — it loses fit (5 hooks
→ 1 + degraded events + a missing one), reopens a CSP problem (htmx), and gives up a bug-fix lievit
already shipped, all for **no algorithmic gain** (the algorithm is Idiomorph either way). Keep the
direct in-house wiring.

### LIVE / SSE → in-house (`stream.ts` + `broadcast.ts`)

There is a **fundamental impedance mismatch** between Turbo Streams and lievit's live channel:

- **Turbo Streams pushes DOM operations** (`<turbo-stream action="replace" target="...">…</turbo-stream>`:
  an HTML-action wire format).
- **lievit's broadcast pushes TYPED EVENTS** — `{name, detail, to}`, structurally **≡ a
  `DispatchedEvent`** — routed through the same wire-dispatch machinery (`receiveBroadcast`): re-emit on
  `window`, fire `runtime.on` listeners, deliver to mounted `@LievitOn` listeners. There is **no
  `<turbo-stream>` representation** for "fire this typed event on the bus and to component X".
- **lievit's `stream.ts` is a text-token sink** (`{target, content, replace}`) for **AI streaming** —
  progressive token append into an `l:stream` element. Turbo Streams has no append-text primitive of this
  shape (its `append` inserts HTML nodes, not raw text tokens into an existing node).
- The **non-DOM effects** lievit's channel must be able to carry (dispatch / redirect / url / js /
  transition — the effects vocabulary) have **no Turbo-Streams representation** at all.
- Turbo's **SSE reconnection is the weakest of the three** (issue **#1261**: a `<turbo-stream-source>`
  reconnect has **no gap-recovery** — it does not replay missed events).

Adopting Turbo Streams here would mean translating lievit's typed channel into an HTML-action format that
cannot express most of what it carries, and inheriting the weakest reconnect. Keep the in-house channels;
they ARE lievit's differentiated value (the typed effects/event model on the wire).

## The boundary principle

**Delegate the generic, non-differentiating engine; keep in-house the layers intimate to the typed
component model.** Navigation is generic-hard and reput--ably solved (vendor Turbo). The per-call morph
hooks and the typed effects/event channel are lievit's differentiation: delegating them **loses fit and
adds coupling for no gain** (morph: 5 hooks → 1; live: a typed channel → an HTML-action format that can't
express it). This is the precise statement of ADR-0084's "glue golden path": stand on giants for the
generic-hard, invent only where lievit's own model is the value.

The corollary, encoded so it is not re-litigated: **"adopt the battle-tested option" is a per-piece cost
test, never a blanket framework choice.** The same library (Turbo) wins navigation and loses morph and
live, on evidence, in the same delivery layer.

## The one evidence-driven improvement: SSE reconnection hardening

The comparison surfaced exactly one place where lievit's in-house live layer was **weaker than an
available engine, with a clear remedy**: gap-recovery after a dropped SSE connection. **All three are
weak** here — Turbo worst (issue #1261, no replay), the browser's native `EventSource` only fixed-interval
with no jitter — and **htmx's `ws`/`sse` extensions are the only ones with real hardening** (managed
reconnect + backoff). So lievit hardens its OWN `EventSource` wrappers, modeled on htmx's approach
(inspiration, **original implementation — not copied code**):

- **Exponential backoff with full jitter**, capped, **reset on a successful message** — a brief blip
  recovers fast, a long outage backs off without hammering the server, and a fleet that dropped together
  does not reconnect in a thundering herd. The native `EventSource` reconnect is taken over: on `error`
  the instance is closed (suppressing its uncontrolled reconnect) and a managed, jittered re-open is
  scheduled.
- **`Last-Event-ID` gap-recovery.** The client tracks the last received event id and, because a fresh
  `EventSource` cannot set the `Last-Event-ID` request header, carries it on the managed re-open as a
  query parameter (default `lastEventId`) the server reads to replay the gap.

  **Server-side requirement (the contract an adopter must honor):** the SSE endpoint **MUST emit an
  `id:` line per event** for replay to work. With ids set, the server resumes the stream after
  `lastEventId`; without them, the client still reconnects (backoff) but **cannot** recover the gap. The
  client never silently claims replay the server can't honor — it always reconnects, and replays **only**
  when the server provides ids. This is documented for adopters alongside this ADR.

- **CSP-clean**: a same-origin `EventSource`, no `eval`, no `new Function`. It rides the page's existing
  `connect-src 'self'`.

The hardening lives in `lievit-ui/runtime/features/reconnecting-source.ts`, used by both
`openBroadcastSource` (#304/#45) and `openStream` (#153). It is small and isolated to the SSE wrapper;
**morph / nav / wire are untouched.** The `EventSource` factory and the clock are injectable, so the
backoff schedule, the reset-on-message, the `Last-Event-ID` propagation, and the cap are unit-tested
against a fake clock and a fake source (`test/reconnecting-source.test.ts`).

## Evidence index (issue numbers cited above)

- **Turbo #1477** — open: no async/deferred removal seam on stream-morph (blocks `l:transition` removal).
- **Turbo #1261** — open: `<turbo-stream-source>` SSE reconnect has no gap-recovery / replay.
- **Idiomorph #27 / #132** — the input-value-on-reorder bug; ≡ lievit #13, fixed in `morph.ts`.
- **lievit #12** — the unkeyed-sibling mis-pair that motivated adopting Idiomorph's algorithm (ADR-0084).
- **lievit #13** — the input-value reconcile rule (server-asserted clears, un-asserted keeps typing).
- **lievit #304 / #45** — the typed broadcast channel + echo-listener bridge (`broadcast.ts`).
- **lievit #153** — the AI text-token stream (`stream.ts`).

## Consequences

- The delivery-layer positioning is now **settled per-piece**: nav = Turbo (vendored), morph = in-house
  (direct Idiomorph), live = in-house (typed channels). Future "should we adopt X for the whole runtime?"
  questions resolve against this table, not from scratch.
- lievit's live channels gain **production-grade reconnection** (backoff + jitter + `Last-Event-ID`
  resume) — the single weakest spot the comparison found, closed.
- An adopter who wants SSE replay must **emit `id:` per event** on their broadcast/stream endpoints; this
  is documented as a contract, and the client degrades gracefully (reconnects, no false replay) when it
  is absent.
- No new runtime dependency: the hardening is ~original lievit code; Turbo stays the only vendored
  delivery engine, and only for navigation.

## Alternatives considered

**Adopt Turbo (Streams) for the live layer too, for consistency.** Rejected: impedance mismatch — Turbo
Streams pushes DOM operations, lievit's channel pushes typed events + text tokens + non-DOM effects that
have no `<turbo-stream>` representation, and Turbo's SSE reconnect is the weakest (#1261). Consistency is
not a reason to lose fit.

**Adopt the htmx morph extension (it wraps the same Idiomorph).** Rejected: it forwards ZERO of
Idiomorph's hooks and gates config behind `new Function` (CSP-illegal). Same algorithm, none of the five
veto hooks lievit's contract needs.

**Adopt Turbo's morph for the wire loop.** Rejected: it forwards only `beforeNodeMorphed`, degrades the
rest to DOM events, has no `l:transition`-removal seam (#1477 open), and is rAF-async vs lievit's
synchronous wire lifecycle. No algorithmic gain (Idiomorph either way), real loss of control.

**Copy htmx's reconnect code for the SSE hardening.** Rejected in favor of an original implementation:
htmx's extension is the *inspiration* (managed backoff + `Last-Event-ID`), but lievit's channels have
their own injectable-clock + fake-source test seam and their own factory model, so a clean re-
implementation fits better than a paste and stays license-clean.
