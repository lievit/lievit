# ADR-0085: Adopt Turbo Drive for SPA navigation, retire the hand-rolled `navigate.ts`

- **Status:** accepted
- **Date:** 2026-06-23
- **Deciders:** Francesco Bilotta

## Context

lievit shipped its own SPA navigation across ADR-0019 (the runtime bundle + extension model),
issue #155 (the `l:navigate` core), and ADR-0050 (navigate depth: head merge, `@persist`, progress
bar, scroll). It lived in `lievit-ui/runtime/features/navigate.ts`: ~377 lines that captured link
clicks, fetched the target page, merged the `<head>` additively (`mergeHead`), morphed the `<body>`
through lievit's bespoke morph, pushed/popped history, ran a bounded page cache, drew a progress bar,
restored scroll, prefetched on hover, and carried `l:persist` live nodes across the swap.

This is exactly the responsibility set that **Turbo Drive** (`@hotwired/turbo`, 37signals, MIT) was
built for and has hardened across years of production Rails use. Maintaining a second, lievit-only
implementation of page-navigation-over-the-wire is accidental complexity: it is not lievit's
differentiator (the wire reactivity is), it is a large surface to keep correct (scroll edge cases,
history replay, head dedupe, prefetch races), and every bug we fix in it is a bug 37signals already
fixed. "lievit = glue golden path" (the reframed clause-1 of ADR-0084): lievit's job is the thin
glue that makes reputable, low-supply-chain pieces compose; it is not to re-grow a navigation engine.

The constraint that makes this non-trivial: lievit's supply-chain posture is **first-party only**
(ADR-0009: the copy-in registry model; the manifesto's supply-chain doctrine: vendored, reviewed, no
install-time scripts, no CDN). So "adopt Turbo" cannot mean "add an npm runtime dependency that gets
resolved at the adopter's build and can be swapped under us." And the CSP is strict
(`script-src 'self'`): whatever we adopt must be `eval`-free.

## Decision

**Adopt Turbo Drive, standalone, vendored first-party; delete `navigate.ts`; keep a thin glue.**

1. **Vendor the reviewed dist, no CDN, no runtime npm dep.** `@hotwired/turbo@8.0.23`'s published
   ESM build (`dist/turbo.es2017-esm.js`) is checked in unmodified at
   `lievit-ui/runtime/vendor/turbo.es2017-esm.js` under a provenance header (source, version, MIT
   license, vendor date, this ADR, CSP note, upgrade recipe) — the same posture as a `lievit add`
   copy-in component. It is verified `eval`-free / `new Function`-free at vendor time, so it runs
   under `script-src 'self'`. This is the reframed ADR-0084 clause-1 applied: a reputable, stable,
   low-supply-chain-risk library (37signals, MIT, no install-time scripts) is preferable vendored
   over hand-rolled — the build-vs-buy line moves to *vendor* once the library is trustworthy.

2. **Turbo Drive only (standalone).** The vendored dist auto-`start()`s Drive on import (a
   side-effect import boots it over the document). Frames (`<turbo-frame>`) and Streams
   (`<turbo-stream>`) are opt-in via markup, and lievit ships none, so their custom elements register
   but stay dormant. We deliberately do **not** carve Drive out of the single published bundle:
   surgery on a vendored dist is the accidental complexity we are removing, and the canonical 37signals
   artifact is the whole ESM file.

3. **Each old responsibility maps to a Turbo-native mechanism** (verified against the Turbo 8
   handbook):

   | lievit responsibility (old `navigate.ts`)         | Turbo Drive native                                            |
   |---------------------------------------------------|---------------------------------------------------------------|
   | fetch + `<body>` swap + pushState + back/forward  | Drive core (auto-started on import)                           |
   | `<head>` merge (`mergeHead`)                      | Drive's head reconciliation                                   |
   | tracked-asset change → full reload                | `data-turbo-track="reload"` on the `<link>`/`<script>` (+ a versioned URL); `data-turbo-track="dynamic"` removes a page-specific asset on the next nav |
   | progress bar                                       | Drive's progress bar (`.turbo-progress-bar`; CSS-styleable, hide via `visibility:hidden`) |
   | `l:persist` live nodes (mid-playback `<audio>`/`<video>`) | `data-turbo-permanent` + an `id` (Turbo matches by id and transfers the live node between pages) |
   | prefetch-on-hover (`l:navigate.hover`)           | Drive prefetch — **on by default**; opt out per-link with `data-turbo-prefetch="false"` or globally via `<meta name="turbo-prefetch" content="false">` |
   | scroll restoration                                 | Drive's scroll restoration                                    |

4. **The author-facing contract changes from opt-in to opt-out, and we accept Turbo's default.**
   The old `l:navigate` *upgraded individual links*. Turbo Drive *upgrades all same-origin links by
   default*, and a link opts **out** with `data-turbo="false"` (or `Turbo.session.drive = false` to
   flip the whole app back to opt-in). lievit adopts Turbo's default (opt-out) rather than forcing the
   old opt-in semantics on top of it: re-implementing opt-in would mean fighting Turbo's model, which
   is exactly the glue-not-engine line we are drawing. An `l:navigate` attribute left on a link is now
   a harmless no-op — Turbo drives the link regardless. Apps that relied on "only *these* links are
   SPA" migrate by marking the rest `data-turbo="false"` (see Consequences).

5. **The residual glue (the ~10-20% Turbo does not cover) stays in `features/navigate.ts`**, minimal
   and tested:
   - **Wire re-bind after a swap (load-bearing).** Turbo swaps the `<body>` but knows nothing about
     lievit's wire components. On `turbo:load` / (re-)render the glue runs `runtime.start(document.body)`
     so each freshly swapped-in `[data-lievit-component]` re-registers its snapshot and re-binds its
     `l:*` directives. `runtime.start` is idempotent on the state map and its directive scan is
     marker-guarded, so it is safe to call after every swap.
   - **Turbo → lievit event bridge.** Turbo's `turbo:before-visit` / `turbo:before-render` /
     `turbo:load` are translated into lievit's existing `lievit:navigate` / `lievit:navigating` /
     `lievit:navigated` CustomEvents, so the features that already listen on that vocabulary keep
     working unmodified: `current.ts` (`l:current` active-link re-evaluation) and `broadcast.ts` (it
     closes its SSE channel on `lievit:navigate` so a navigation does not leak the connection).
   - **No custom tracked-asset path, no custom `@persist` path.** `data-turbo-track="reload"` covers
     the bundle-hash reload (the server already versions asset URLs), and `data-turbo-permanent`
     covers mid-playback media. Both custom paths from `navigate.ts` are dropped, not re-grown.

6. **Delete `navigate.ts`'s implementation + its tests.** The old fetch/morph/head-merge/persist/
   progress/scroll code and `navigate-depth.test.ts` are removed; the `l:navigate` block in
   `navigate-stream.test.ts` is removed; the new glue is pinned by `navigate-turbo.test.ts`. The
   public export stays `installNavigate` (same name, new thin body), so the runtime barrel,
   `runtime/index.ts`, and the README's feature list need no churn beyond a wording update; an
   adopter's `installAllFeatures(runtime)` call is unchanged.

### NOT replaced: the per-wire-call morph (`morph.ts`)

This ADR is about **page-level navigation**. The per-wire-call surgical morph (`runtime/morph.ts`,
ADR-0019) reconciles **one component's** re-render against the server's authoritative wire state —
a different granularity and a different contract (it preserves uncontrolled input, keyed identity,
and in-flight transitions inside a single component). It stays lievit's own bespoke morph and is
untouched. Turbo 8 *can* morph its own page **refreshes** (`<meta name="turbo-refresh-method"
content="morph">`, which uses Idiomorph) — that is orthogonal, opt-in per app, and does not touch
the wire loop. Likewise `runtime/merge.ts` is the **wire snapshot surgical merge** (ADR-0024), part
of the component reactivity model, and is unrelated to navigation — it is NOT touched.

## Consequences

- ~377 lines of navigation engine retired; lievit owns ~115 lines of glue + an ambient type shim,
  plus a vendored, reviewed, pinned dist it does not maintain. The navigation correctness surface
  (scroll, history, head dedupe, prefetch races) moves to 37signals.
- The author contract is now **opt-out**. This is a behavior change for any app that marked only some
  links `l:navigate`: under Turbo *all* same-origin links are SPA by default. **Migration**: drop the
  `l:navigate` attributes (harmless to leave), add `data-turbo="false"` to links/forms/regions that
  must do a full load (downloads, third-party redirects, anything that re-runs page scripts), and add
  `data-turbo-track="reload"` to the versioned runtime bundle `<script>`/`<link>` so a deploy forces a
  reload. Stamp mid-playback media regions with `id` + `data-turbo-permanent` in place of `l:persist`.
- `lievit:navigate*` events keep firing (now bridged from Turbo), so `l:current` and the broadcast
  channel keep working with no code change. The event payloads are preserved where Turbo provides
  them (`turbo:before-visit` carries the destination URL).
- CSP stays satisfied: the vendored Turbo build is `eval`-free (verified at vendor time and re-checked
  on every upgrade per the file header), and the glue adds no inline script.
- The full lievit-ui gate is green after the change: `tsc --noEmit` clean, vitest 1769/1769, the
  islands build CSP-clean (esbuild would warn on `eval` in the vendored file — it does not).

### What still needs a real-browser (Playwright) pass

happy-dom has no real navigation, no layout, and does not run Turbo's actual click interception +
fetch + document rewrite. The glue (wire re-bind on `turbo:load`, the event bridge) IS asserted in
happy-dom (`navigate-turbo.test.ts`) by firing the `turbo:*` events the way Turbo does. But the
**end-to-end** behaviors below are real-browser concerns and are NOT covered by the jsdom/happy-dom
suite; they need a Playwright slice against a running app once the example apps wire Turbo:

- a real same-origin link click is intercepted, the body swaps, history advances, and back/forward
  replays — and a lievit wire component on the navigated-to page is interactive (the re-bind worked);
- `data-turbo-permanent` keeps an `<audio>`/`<video>` playing across a navigation;
- `data-turbo-track="reload"` forces a full reload when the bundle hash changes;
- prefetch-on-hover fires and `data-turbo="false"` opts a link out.

lievit-ui is a copy-in registry with no runnable app of its own (no Playwright harness here), so this
slice belongs in an adopter/example app; it is flagged, not silently assumed.

## Alternatives considered

**Keep the hand-rolled `navigate.ts`.** Rejected: it is a non-differentiating engine we were paying
to keep correct; "lievit = glue golden path" says compose a reputable piece instead of maintaining a
parallel one.

**Add `@hotwired/turbo` as a runtime npm dependency.** Rejected: violates the first-party-only
supply-chain posture (ADR-0009 + the manifesto). The adopter would resolve it at build time, and the
2026 posture prefers a reviewed, checked-in dist over a resolvable dependency.

**Carve Drive out of the Turbo bundle (strip Frames/Streams from the vendored file).** Rejected:
editing a vendored dist is the accidental complexity this ADR removes; Frames/Streams are inert
without their markup, so the cost of shipping them dormant is a few KB, not behavior.

**Re-implement opt-in `l:navigate` semantics on top of Turbo.** Rejected: it means fighting Turbo's
opt-out model with per-link bookkeeping — re-growing glue to preserve a contract that the migration
note handles more simply (`data-turbo="false"` on the exceptions).
