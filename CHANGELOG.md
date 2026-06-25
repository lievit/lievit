# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.1] - 2026-06-25

### Fixed

- **Namespace residuals the 1.0.3 `io.lievit → dev.lievit` rename missed** (it ran over `.java`/`.jte`
  but not `.xml`/`.html`/CI): the `lievit-cli` shaded-jar `<mainClass>` (was `io.lievit.cli.LievitCli`,
  so `java -jar lievit-cli.jar` threw `ClassNotFoundException` — the directive linter was broken), the
  CI native-test filter `-Dtest=...`, and the kit-crud example's Thymeleaf `T(io.lievit.kit.Cell.*)`
  refs. (1.1.0 was built but never reached Central; 1.1.1 is the first published 1.1.x.)

### Added

- **lievit-kit Filament-parity backflow** (issues #489-495, ADR sw-architecture-008): seven generic
  admin features harvested from the gest dogfood — gest had kept them as publish-to-customize
  overrides because lievit-kit lacked them; now they ship upstream so adopters drop the override.
  All additive + backward-compatible (new optional `@param` slots default null, opt-in flags).
  - **table** (`kit/table.jte`): toolbar slots `scopeBar` / `headerActionsExtra` / `bulkActions` /
    `favoriteTabs` / `viewsManager` (#489); a per-row `rowActionsSlot` (#490); an opt-in
    **HMAC-signed sort token** so a tampered `?sort=` is rejected server-side — `SortTokenSigner`
    reuses lievit-core's HMAC-SHA256 primitive (no hand-rolled crypto), wired via
    `KitTableView.withSignedSort(signer)` (#491).
  - **app shell** (`kit/page.jte`): brand-logo slot + page-header opt-out (#492); a responsive
    mobile hamburger + sidebar-footer user-menu (#493).
  - **sidebar nav** (`kit/page/sidebar-nav.jte`): multi-level parent/child groups + external
    `target=_blank rel=noopener` links (#494). `lievit-ui` `sidebar/item.jte` gains `target`/`rel`
    (smart-attribute null-omission, no change for existing callers).
  - **global search** (`kit/page/global-search.jte`): a responsive mobile magnifier popover (#495).

## [1.0.3] - 2026-06-25

### Changed

- **Maven coordinate AND Java package are now `dev.lievit`** (were the `io.github.lievit` groupId +
  the `io.lievit.*` package), published to **Maven Central**. `dev.lievit` is the reverse-DNS of the
  validated `lievit.dev` domain; the old `io.lievit` package (from the never-purchased lievit.io) is
  retired. This is the canonical distribution: consumers resolve `dev.lievit:lievit-*:1.0.3` from
  Central everywhere (local, CI, any adopter), and — unlike JitPack — the `lievit-maven-plugin`
  resolves too (a Maven plugin carries its groupId in its descriptor, so JitPack's `com.github.*`
  re-coordinate failed it; Central with the real groupId works).

## [1.0.2] - 2026-06-25

### Fixed

- **`pagination` builds a valid query when `baseUrl` already has a query string.** The URL-mode page
  links hard-coded `${baseUrl}?page=N`, so a `baseUrl` carrying filters (e.g. `/x?user=a&date=b`)
  produced a malformed double-`?` href (`/x?user=a&date=b?page=2`), breaking pagination on any
  filtered/sorted list. The separator is now chosen by content (`&` when `baseUrl` contains `?`, else
  `?`), so filter-preserving pagination works. Surfaced by the gest dogfood (filtered activity table).

## [1.0.1] - 2026-06-25

### Fixed

- **`lievit-maven-plugin` is now groupId-agnostic.** `stage-templates` no longer hard-codes the
  lievit groupId (then `io.github.lievit`): it scans ALL compile-scope dependency jars and stages any
  that contain `*.jte` resources. A JitPack consumer (who resolved the artifacts under
  `com.github.lievit.lievit:*`) previously got ZERO templates staged because the groupId never
  matched; now the plugin works regardless of the coordinate the consumer used (JitPack, Central,
  or local). The optional `<namespaces>` filter + the auto-detect default are unchanged. This
  unblocks the first external import-consumer (gest) on JitPack.

## [1.0.0] - 2026-06-25

First stable release. lievit is server-rendered to the core: the UI primitives are JTE partials +
plain-TS progressive enhancers, **no Lit, no Web Components shipped** (the v-next re-forge replaced
the early light-DOM Lit islands wholesale). The libraries are consumable **by import**: each module
ships its `.jte` sources + client runtime in its jar, and the new `lievit-maven-plugin`
(`stage-templates`) auto-stages every `@template.<lib>.*` namespace for the consumer's JTE precompile
(one dependency + one plugin = the compile-gate path); copy-in (`lievit add`) stays as the opt-out.
lievit-ui (~66 re-forged primitives, controlled/uncontrolled overlays, OKLCH token source-of-truth)
and lievit-kit both build green and dogfood the import path end-to-end (`examples/import-poc`,
`examples/import-poc-kit`). Semantic versioning starts here.

### Changed

- **OKLCH as color-token source-of-truth** (architecture-contract §4 D1, `feat/vnext-oklch-tokens`).
  Every `--lv-color-*` custom property in `lievit-ui/registry/tokens/lievit-tokens.css` is now
  authored in `oklch(L C H)` — the perceptually-uniform, native-2026-browser format.
  All 29 unique hex values (light mode + dark mode across 50 token declarations) were converted via
  the standard sRGB → linear sRGB → XYZ D65 → OKLab → OKLCH pipeline (Björn Ottosson's OKLab
  matrices, 4 decimal places on L and C, 2 on H; near-achromatic colors with C < 0.001 get C=0).
  Fallback pattern: plain double-declaration — the hex value is declared first, the oklch on the
  immediately following line for the same property. Old browsers that do not understand `oklch()`
  keep the hex declaration; modern browsers override it via cascade. No `@supports` wrapper needed.
  Token NAMES are byte-identical: the 31 v0.1 names and all v2 additive names are unchanged.
  Non-color tokens (spacing, radius, typography, shadows, z-index, motion, icon) are untouched.
  The v0.1 aliases (`--lv-color-danger`, `--lv-color-info`) are preserved and also converted.
  `registry/registry.json` regenerated to match (drift-gated by `test/registry-json.test.ts`).
  All 1803 vitest tests pass; `tsc --noEmit` clean; `npm run build` green.

### Added

- feat(runtime): focus-trap.enhancer.ts — WAI-ARIA APG Dialog Modal focus trap (activate/trap/restore/scroll-lock/Escape), registered in installAllFeatures
- feat(runtime): collection-nav.enhancer.ts — WAI-ARIA APG Listbox+Menu roving-tabindex/aria-activedescendant collection keyboard nav (ArrowDown/Up, Home/End, typeahead, disabled-skip, Enter-to-select), registered in installAllFeatures
- feat(runtime): popover-anchor.enhancer.ts — native popover API seam (opener bookkeeping, focus-return on light-dismiss, close() wire sync, autofocus delegation), registered in installAllFeatures

- **SSE reconnection hardening on the live/delivery channels** (ADR-0086). lievit's two real-time
  channels — the per-user broadcast push (`openBroadcastSource`, #304/#45) and the AI text-token stream
  (`openStream`, #153) — now self-heal across dropped connections instead of relying on the browser's
  weak native `EventSource` reconnect. A new `runtime/features/reconnecting-source.ts` adds **exponential
  backoff with full jitter** (capped, **reset on a successful message**) and **`Last-Event-ID`
  gap-recovery** (the client tracks the last received event id and carries it on the managed re-open so
  the server can replay the gap). Modeled on htmx's `ws`/`sse` extensions (inspiration; original
  implementation, not copied code) — the only one of the three compared delivery engines with real
  reconnect hardening. **Server contract for replay:** the SSE endpoint must emit an `id:` line per event;
  without ids the client still reconnects (backoff) but cannot recover the gap, and never falsely claims
  replay. CSP-clean (same-origin `EventSource`, no `eval`). The `EventSource` factory + clock are
  injectable, so the backoff schedule, reset-on-message, `Last-Event-ID` propagation, and the cap are
  unit-tested against a fake clock (`test/reconnecting-source.test.ts`). Isolated to the SSE wrapper:
  morph / nav / wire are untouched.

### Changed

- **The client runtime's DOM morph is now Idiomorph, vendored** (ADR-0084: renounce in-house where a
  proven implementation exists). lievit shipped a bespoke ~390-line morph; DOM morphing is a hard
  algorithm (its #12 unkeyed-sibling mis-pair was the standing evidence), so it is replaced by
  **Idiomorph** (the htmx-ecosystem morph, 0BSD, eval-free), vendored as a single file with a
  provenance header at `lievit-ui/runtime/vendor/idiomorph.js` (pinned v0.7.4). The bundle stays
  dependency-free (no npm dep) and CSP-clean (no `eval` / `new Function`). `runtime/morph.ts` is now a
  thin lievit wiring around Idiomorph's callbacks that preserves every wire-relied behavior: the
  client-owned `data-lievit-rt-*` markers survive a morph (`beforeAttributeUpdated`); native + custom-
  element value/checked follow the lievit #13 rule (a server-asserted value clears/updates a dirty
  `.value`, an un-asserted re-render keeps in-progress typing — the inverse of Idiomorph's native
  input sync, run in `afterNodeMorphed`); the ADR-0019 morph hooks (`l:ignore` skip/self/children,
  `l:transition` deferred removal) map onto `beforeNodeMorphed` / `beforeAttributeUpdated` /
  `beforeNodeRemoved`. Net win: a leading insertion among ID-keyed siblings now keeps node identity
  and in-progress typing (the #12 bug is gone for keyed nodes; Idiomorph MOVES the keyed node instead
  of destroy+recreate), and focus + caret selection survive a morph (Idiomorph `restoreFocus`).
  A genuinely UNKEYED sibling (no `id`) still mis-pairs on a leading shift — fundamental to any
  greedy, no-LCS morph — so the mitigation remains to key siblings with a stable `id`. Note: the
  bespoke morph keyed on `id` THEN `name`; Idiomorph keys on `id` only, so a `name`-only sibling
  reorder no longer preserves identity (use `id`).

### Documentation

- **The delivery-layer boundary is recorded, decided per-piece on evidence** (ADR-0086). A rigorous
  comparison (Turbo vs htmx vs in-house) across navigation / morph / live, decided per-piece:
  **navigation → Turbo Drive** (vendored, ratifies ADR-0085); **morph → in-house** (the algorithm is
  Idiomorph in all three, so no gain switching wrappers — lievit's contract needs 5 veto hooks that only
  the direct Idiomorph callbacks give; Turbo forwards 1 + degrades the rest + has no `l:transition`-
  removal seam (Turbo #1477), htmx's morph ext forwards 0 hooks + gates config behind `new Function`
  (CSP-illegal); lievit's wrapper even fixes a shared open Idiomorph bug ≡ #13); **live/SSE → in-house**
  (impedance mismatch — Turbo Streams pushes DOM operations, lievit's channel pushes typed events
  `{name,detail,to}` + an AI text-token sink + non-DOM effects with no `<turbo-stream>` representation;
  Turbo's SSE reconnect is the weakest, #1261). The boundary principle: delegate the generic non-
  differentiating engine (page navigation), keep in-house the layers intimate to lievit's typed component
  model. Recorded in `docs/adr/0086-delivery-layer-boundary-turbo-vs-in-house.md`, with the SSE server
  `id:`-per-event replay contract for adopters.

- **The Turbo Drive backend contract is now documented for adopters** (ADR-0085 follow-up). Adopting
  Turbo Drive imposed an undocumented **server-side** contract on every standard `<form method=post>`
  navigation, and the default Spring MVC form idiom violates it silently — the #1 gotcha for the
  Spring-MVC audience. Verified against the official Turbo 8 handbook and recorded in two places:
  a **"Backend contract for adopters"** section in `docs/adr/0085-adopt-turbo-drive-for-navigation.md`
  and a new guide `docs/guide/turbo-backend-contract.md` (linked from the guide read order). The two
  rules: a successful form POST must redirect with **303 See Other** (Spring's `redirect:` defaults to
  302; a 200 carrying HTML is discarded by Turbo), and a validation error must re-render the form with
  **422 Unprocessable Content** (the default `return "view"` → 200 is silently dropped, so the user
  never sees the errors). The **scope rule** is load-bearing: only standard form navigations are
  affected — the lievit **wire** (`l:model`/`l:submit` → programmatic `fetch`) and lievit **SSE**
  (`stream.ts`/`broadcast.ts`) are exempt and keep returning 200. Also documents the
  Turbo-Streams ↔ lievit-SSE relationship: Turbo Streams (`text/vnd.turbo-stream.html`) is dormant
  (lievit ships no `<turbo-stream>` markup); lievit's SSE shares only the `EventSource` transport, not
  the wire format.

### Fixed

- **The `kit-crud-admin` example now obeys the Turbo form contract** (ADR-0085). The product
  controller (`ProductAdminController`) returned Spring's default **302** on a successful create/edit/
  delete and a **200** on a validation error — both wrong under Turbo (a 200-POST is discarded, hiding
  the validation errors). Fixed to **303 See Other** on success (create/edit/delete) and **422
  Unprocessable Content** on a validation re-render, so the demo is correct for the audience that
  copies it. The lievit wire endpoints are untouched (exempt). New `TurboFormContractTest` pins the
  three status codes.

- **Runtime CSS scoping (`scoped-css.ts`) no longer corrupts real-world stylesheets** (ADR-0084
  watch list: the selector-rewrite scoper is a dependency-free hand-roll kept on purpose, hardened
  where robustness bugs hide before 1.0). Seven concrete breakages, each pinned by a golden test:
  - A comma inside a functional pseudo-class (`:not(.b, .c)`, `:is(.a, .b)`, `:has(> img, > svg)`)
    was split as if it were a selector-list separator, shredding the compound and scoping each
    fragment wrongly. Splitting is now top-level only (commas inside `()`/`[]`/strings/`\,` escapes
    are part of one selector).
  - A comma inside an attribute value (`[data-x="a,b"]`) was likewise split. Same fix.
  - A brace inside an attribute value (`[data-x="a{b}c"]`) or inside a `/* } { */` comment was
    treated as a rule-block boundary, mismatching `{`/`}` and corrupting the whole sheet. Block
    open/close scanning now skips comments and quoted strings.
  - A leading comment in selector position (`/* note */ .x`) leaked into the scoped selector and
    broke the rule; it is now stripped from the selector head.
  - `@keyframes` step selectors (`from`, `to`, `50%`) and `@font-face` descriptors could be
    rewritten as element selectors when nested under a scoped at-rule; only the rule-list at-rules
    (`@media`/`@supports`/`@container`/`@layer`/`@scope`) recurse, everything else passes through.
  - An escaped comma in a class name (`.foo\,bar`) was split as a separator.
  - A media condition (`@media (min-width: 600px)`) is kept verbatim and never scoped as a selector.
  A real-CSSOM integration test (happy-dom `getComputedStyle`) proves a `:not()`-bearing scoped rule
  reaches the owning component and not an identically-classed foreign one. Behavior is identical to
  before for all previously-valid input; only the broken cases changed. CSP-clean (no parser, no eval).
- **The validation gate is now intent-driven, not shape-driven** (three silent-drop bugs collapsed
  into one correct decision): a failing `@Wire`-field validation used to skip a single `else` block
  that bundled three unrelated intents (real form-submit actions, framework magic mutations, inbound
  events), so any unrelated invalid field silently dropped all three. The dispatcher now gates ONLY
  the real form-submit `@LievitAction` calls. A magic `$set` / `$toggle` mutation applies regardless
  of an unrelated invalid field (the "click expand, nothing happens because an email field is empty"
  bug is gone), and an inbound dispatched `@LievitOn` event is delivered independent of validation
  (an event is not a form submit). One POST carrying a magic mutation and a real submit gates each
  intent independently. Net less code: the gate no longer bundles three concerns behind one `if`.
- **`LievitFormObject` typed fields now round-trip without loss** (the kit-CRUD blocker): the
  form-object dehydrate / rehydrate / dotted-update paths went through `FormField.read` / `write`
  (numeric coercion only), so a typed sub-field bypassed the synthesizer registry: a `LocalDate`
  threw on the raw `Field.set`, a `BigDecimal` lost its scale, an enum could not bind. The three
  paths now reuse the existing synthesizer golden path (`synthesizers.dehydrate` / `hydrate` /
  `hydrateForUpdate(formField.type(), value)`), the same machinery a top-level `@Wire` field uses
  (ADR-0020), so a form object can hold typed fields, not just String / primitive.
- **`@LievitOn` no longer drops a handler when two listeners share an event name.**
  `EventListenerMetadata.resolve()` collapsed the listeners into a `Map<resolvedName, Method>`, so a
  component declaring two `@LievitOn("saved")` methods kept only the last-declared one and silently
  dropped the other (Livewire fires *all* matching listeners). `resolve()` now returns a
  `List<ResolvedListener>` (reflection order) and `EventInvoker.invokeMatching` invokes every pair
  whose name matches. A two-handlers-one-event test pins both firing.
- **`@LievitRender` single-file vs multi-file ambiguity now fails fast at reflect time.** A component
  declaring both a named `@LievitComponent(template="...")` AND a markup-returning `@LievitRender`
  method was undefined (the adapter silently picked a winner). `ComponentMetadata.of` now rejects the
  combo at startup with a message naming both halves and the fix; the two legal modes (named template
  + void prepare-hook, or empty template + markup-returning render) are unaffected.
### Security

- **The DSL's URL-attribute XSS gap is closed with context-aware encoding + a URL scheme allowlist**
  (`lievit-dsl`, ADR-0084): the render-time escaper was a correct 5-char escaper (`& < > " '`) for
  element text and quoted-attribute-value positions, but it had no URL-attribute context. A `@Wire`
  value bound into a URL-bearing attribute (`href`, `src`, `formaction`, `xlink:href`, `poster`, ...)
  carrying `javascript:alert(1)` or `data:text/html,<script>…` has no `< > & " '` to escape, so it
  survived intact and executed on click: a real XSS vector. The DSL now (a) delegates encoding to the
  **OWASP Java Encoder** (`Encode.forHtmlContent` for text, `Encode.forHtmlAttribute` for ordinary
  attributes) instead of the hand-rolled escaper, and (b) detects URL-bearing attributes by name and
  runs their value through a **scheme allowlist** before attribute-encoding: only `http`, `https`,
  `mailto`, `tel` and scheme-less relative / absolute-path / scheme-relative / anchor / query URLs
  pass; any other scheme is replaced with `about:blank#blocked` and a dev warning is logged. The
  scheme test strips the control/whitespace characters a browser ignores and is case-insensitive, so
  the classic evasions (` javascript:`, `java\tscript:`, `java\nscript:`, `java\0script:`,
  `JaVaScRiPt:`) are all caught; legal URLs (`https://x`, `/path`, `./rel`, `#anchor`, `?q=1`,
  `mailto:a@b`, `tel:+39…`) pass byte-for-byte unchanged. Encoding alone never neutralized the
  scheme (it is a valid URI), so the allowlist is the actual fix and OWASP encoding is the correct
  base layer for the other contexts. New `UrlAttributeEscapingTest` pins the blocked vectors and the
  legal pass-through; the attribute golden moves to OWASP's canonical entity spellings (`&#34;`).

- **Prototype pollution closed in the wire-snapshot surgical merge** (`lievit-ui/runtime/merge.ts`,
  ADR-0024 / #87): `writePath` walked a dot-keyed path and created intermediate objects without
  rejecting prototype-chain segments, so a path whose segment was `__proto__` (or `constructor` /
  `prototype`) wrote onto `Object.prototype` instead of the snapshot. `writePath` is fed `pending`
  field paths reconciled against the server snapshot on every wire response, partly attacker-
  influenced, so this was a real prototype-pollution vector, not theoretical. `merge.ts` now refuses
  any path containing a forbidden segment: `writePath` is a no-op on such a path, `readPath` reports
  it as absent (`undefined`), matching the existing missing-segment contract, so the legitimate #87
  reconciliation, dot-keyed nesting, array-index removal and key-order / sparse-key handling are
  unchanged. Tests pin that `__proto__.polluted` and `constructor.prototype.x` (anywhere in the path)
  leave `Object.prototype` clean and never throw, while legitimate paths still merge.
- **Reserved-key smuggling at the dehydrate/hydrate boundary is closed** (`SynthesizerRegistry`,
  ADR-0020): the typed-tuple envelope was detected purely structurally, so a client-controlled plain
  `Map` or `DynamicObject` whose key was literally `@w` (or any reserved `@`-sigil key, e.g. `@memo`)
  was mis-read as a typed-state tuple on the next hydrate, corrupting integrity or self-DoSing the
  request (a 422/500; the `ClassInstantiationGuard` already capped the blast radius at integrity +
  self-DoS, never RCE). Reserved-sigil keys on the plain-map / `DynamicObject` path are now escaped on
  dehydrate (a leading `@` is doubled: `@w` → `@@w`) and unescaped on hydrate, so user data can never be
  shaped into an envelope. The documented invariant "a `DynamicObject` / plain map can never smuggle a
  typed object" is now literally true by construction, not by coincidence. Plain maps without sigil keys
  are untouched, so the Counter snapshot stays byte-identical. New round-trip tests pin a user map keyed
  `@w` (and a `DynamicObject` keyed `@w`) reconstructing as DATA.
- **`ChecksumFailureLimiter` no longer grows unbounded under IP rotation** (memory-DoS): the per-client
  `ConcurrentHashMap` never evicted a client whose deque had drained, so a rotating-IP attacker turned
  the anti-brute-force control into a memory-DoS vector (the "bounded by the active client set" claim
  was false). Drained entries are now evicted on touch under the deque lock (value-checked remove, no
  lost in-flight failure), plus an amortized sweep on `recordFailure` once the map outgrows the
  plausible active set, so the map collapses back to the currently-active clients. No new dependency
  (`lievit-core` stays pure-Java, zero-Spring); a test pins that 2000 rotated IPs collapse to the live
  set after the window elapses.

### Changed

- **`lievit-kit` CSV is now RFC-4180 via Apache Commons CSV; the hand-rolled CSV mechanics are
  retired** (ADR-0084: in-house CSV is data-critical, the quoting/escaping/embedded-delimiter/newline
  edge cases silently corrupt data, so it failed the cost test). The byte-level read/write moved off
  the three hand-rolled code paths onto the canonical library: `CsvFormat.assemble` (export) now
  serializes through `CSVPrinter` over `CSVFormat.RFC4180` (configured with the dialect's separator /
  quote / line ending), `CsvSource` (import) parses through `CSVParser`, and `ImportAction`'s
  failed-rows report writes through `CSVPrinter` instead of its own `csvLine`/`escape`. The public
  API is unchanged: the `ExportColumn`/`ImportColumn` column model, the `Exporter`/`Importer`
  contracts, the `ExportAction`/`ImportAction`/`ExportBulkAction` surface, the `CsvFormat` dialect
  presets (`standard()`/`excelItalian()`/`tabSeparated()`), the UTF-8 BOM option, and the delimiter
  auto-detection all keep their signatures and behaviour. One visible improvement falls out of the
  correct library: a field with leading/trailing spaces is now quoted on export so a trimming reader
  cannot eat the spaces (the old writer left it unquoted). Added a round-trip suite proving an
  embedded delimiter, an embedded quote, an embedded newline, surrounding spaces, an empty field, and
  a formula-looking value survive export→import losslessly under both the comma and the semicolon
  dialect. Pulls in `org.apache.commons:commons-csv:1.14.1` (Apache-2.0; not managed by the Spring
  Boot BOM, so version-pinned in `lievit-kit/pom.xml`).
- **SPA navigation is now Turbo Drive; the hand-rolled `navigate.ts` is retired** (ADR-0085, the
  reframed clause-1 of ADR-0084: "lievit = glue golden path"). lievit deleted ~377 lines of its own
  navigation engine (fetch + body morph + `<head>` merge + history + page cache + progress bar +
  scroll + `l:persist` + hover prefetch) and adopted **Turbo Drive** (`@hotwired/turbo` 8.0.23, MIT,
  37signals), **vendored first-party** at `lievit-ui/runtime/vendor/turbo.es2017-esm.js` (no CDN, no
  runtime npm dep, verified `eval`-free so it runs under `script-src 'self'`). Drive is used
  standalone (Frames/Streams stay dormant, opt-in via markup). Each old responsibility maps to a
  Turbo-native mechanism: head merge → Drive's head reconciliation; tracked-asset reload →
  `data-turbo-track="reload"`; progress bar → `.turbo-progress-bar`; `l:persist` →
  `data-turbo-permanent`; hover prefetch → Drive's default prefetch; scroll → Drive's restoration.
  **Author contract changes from opt-in to opt-out**: all same-origin links are SPA by default; opt
  out with `data-turbo="false"`; a leftover `l:navigate` attribute is a harmless no-op. lievit keeps
  only the thin residual glue in `features/navigate.ts` (export name `installNavigate` unchanged): it
  re-binds wire components after each Turbo swap (`runtime.start` on `turbo:load`, the load-bearing
  glue) and bridges Turbo's lifecycle events to lievit's existing `lievit:navigate*` CustomEvents, so
  `l:current` and the broadcast channel keep working unmodified. The per-wire-call surgical morph
  (`morph.ts`, ADR-0019) and the wire snapshot merge (`merge.ts`, ADR-0024) are a different
  granularity and are **untouched**.
- **Removed the vestigial Lit references from `lievit-ui` and the README** (an honesty fix: Lit was
  deliberately dismantled but two surfaces still advertised it). The `lievit-ui` client is the
  dependency-free TypeScript runtime; nothing in the shipped code imports Lit, and the test suite
  actively gates against any `import ... from "lit"` / `LitElement`. Concretely: dropped the unused
  `lit` dependency from `lievit-ui/package.json` (and its lockfile entry + the stale package
  description), dropped the dead `"lit"` entry from the esbuild externals in `build-islands.ts`, and
  corrected the README Stack line, the lievit-ui feature-matrix row (now "68 copy-in server-rendered
  JTE component primitives driven by a dependency-free TypeScript client runtime", not "28 light-DOM
  Lit components"), and the Custom-elements section (the `<lievit-*>` tags are plain native custom
  elements reserved by ADR-0005, not "Lit-based"; loading/error UX ships today as runtime attribute
  directives, `<lievit-stream>` is reserved for the roadmap `stream` effect). `npm ci` + the full
  vitest suite (1773 tests) + `tsc` stay green with Lit absent, proving nothing imported it.
- **The public-annotation surface is now documented by role, not by a count.** The "seven / eight /
  nine annotations" slogan had drifted out of sync with the actual 20 runtime `@interface` types,
  teaching a false invariant. `package-info.java` replaces the integer with a stable ROLE taxonomy
  (bootstrap / component / state / action / events / lifecycle / authorization / loading / page), and
  a build-time `AnnotationTaxonomyInvariantTest` asserts the documented set equals the actual set of
  runtime annotations in `dev.lievit`, so the doc can never silently drift again. The per-annotation
  javadoc "one of the seven public annotations" lines were updated to the role-based language.

- **`dropdown-menu` gains an optional `triggerClass` param** (backflow from gest, dogfood-then-extract):
  extra utility classes applied to the trigger `<button>` itself (the wrapper's `cssClass` left the
  inline-flex button content-tight). Empty default, backward-compatible. `kit/page/user-menu` uses it
  for a new `inFooter` placement: the user menu can now render as a full-width sidebar-FOOTER row
  (`triggerClass = "w-full justify-between"`, opens upward, name + chevron `lv-sidebar-collapsible` so a
  collapsed icon rail shows the avatar only), the Filament panel user-menu placement, in addition to the
  default compact topbar trigger.
- **Table chrome Filament-fidelity pass** (backflow from gest): the data-column header cells
  (`lievit-ui` `table/head` + `lievit-kit` `kit/table/sortable-head`) lighten from the heavy 70%-surface
  band to a subtle 35% tint with a small muted-semibold label (faithful `fi-ta-header-cell`); data cells
  (`table/cell`) get comfortable `px-3 py-3` padding (was cramped `p-2`); and `kit/table` shows an
  `l:loading.delay` spinner on the results row during a wire call (Filament's `fi-ta` async indicator).
- **lievit-ui is now a SERVER component library** (ADR-0012): the 46 light-DOM Lit islands were
  retired in favour of one predictable, convention-driven model: JTE partials for presentation,
  lievit-wire components (typed Java state + `l:*`) for stateful interactivity, htmx/native for
  simple swaps, and a typed-vanilla-TS micro-enhancement as the rare client escape hatch. Root
  cause of the pivot: light-DOM custom elements use native `<slot>`, inert without a shadow root,
  so slotted content silently failed to project, with no console error and no failing test. The
  new library ships **40 JTE partials + 14 wire components + 0 Lit islands**; every partial and
  wire template carries a render-asserting test (vitest source-contract + lievit-kit ITs through
  the real runtime) that would have caught a non-projected slot. Highlights: the overlay seam is
  the native `popover` attribute + CSS Anchor Positioning (no floating-ui); the calendar is a
  server-rendered wire grid with the `l:model.debounce` / `l:init` / `l:loading` optimization
  toolkit and a typed-TS drag enhancer (no @event-calendar, no Lit); the kit renders badge/icon
  cells and the four blocks (app-shell, dashboard, login, signup) as partial markup, not island
  tags. The `light-dom` Lit style helper was dropped with the last island. `lievit add` copies a
  component on both layers (Java + JTE) via the `registry:wire` two-root mechanism. The CLI
  single-root back-compat is now pinned against a synthetic `registry:ui` fixture.

### Added

- **lievit-kit ships its first RENDER templates (the table chrome)**: the kit was a render-less
  builder layer (its only `.jte` were test fixtures), so every adopter hand-assembled the Filament
  table chrome inline and it drifted. The kit now ships the canonical `kit/table.jte` (+ `kit/table/
  {sortable-head,rich-cell}.jte`) under `lievit-kit/src/main/resources/jte/`, rendering a
  `KitTableView` onto the existing `lievit-ui` `data-table/*` + `table/*` + pagination / empty /
  badge / checkbox / chip / native-select / dropdown-menu / icon partials. All 14 Filament pieces are
  server-first (real GET `<a href>` / `<select>` / `<form>` POST or `l:*` wire hook, strict-CSP
  clean): header heading + header-actions bar, global search, filters trigger + inline panel,
  active-filter indicator chips + reset-all, bulk select-all + per-row checkbox + the N-of-M bar,
  sortable header cells with `aria-sort` + chevron, header-group super-row, per-page selector,
  numbered pagination + "Showing X to Y of Z" count, column-manager, summary/footer row, empty state,
  and the typed rich-cell switch. New view-model surface: `dev.lievit.kit.page.KitTableView` (the
  render-time bundle: URL patterns + filter-indicator chips + bulk `Selection` + `ColumnSummary`
  footer) and `KitTableComponent` (the generic kit-owned render entry that derives the server-first
  URL patterns from a resource's `AdminRoutes`), plus `AdminListView.Pagination.firstShown()` /
  `lastShown()` for the results-count line. Copy-in registered as the `kit-table` registry item
  (`lievit-kit/registry/jte/kit-table/meta.json`, Filament's publish-views model). A new
  `lievit-kit/test/jte-compile` harness compiles the chrome against the built kit jar + the staged
  lievit-ui partials and renders an `AdminListView` fixture asserting all 14 pieces
  (`KitTableChromeRenderTest`, green). This is the reference render pattern the other kit builders
  (forms, panels, infolists) replicate.
- **Typed JTE component facade (jte-models)**: the `lievit-ui` registry partials now generate a
  typed `gg.jte.generated.precompiled.Templates` interface (one compile-checked method per partial,
  parameters derived from each `@param`) via the `jte-models` `ModelExtension`, so an adopter's IDE
  indexes the components from the jar (`templates.button(..)`, `templates.badge(..)`,
  `templates.chip(..)`) instead of stringly-typed template names. The `test/jte-compile` harness
  generates + javac-compiles the facade and proves it through `TypedFacadeTest` (renders real
  components through `StaticTemplates`); see `lievit-ui/test/jte-compile/README.md` for the adopter
  copy-paste. `switch.jte` is excluded from the facade only (reserved Java word; still ships +
  compiles).
- **lievit-ui component-API increments** (in-flight, across the current registry wave): a removable
  `chip` partial (Filament active-filter pill / shadcn dismissible badge), an icon SPI for pluggable
  icon sets, a size scale on `input`, and a safe-attributes pass-through on `button`. Each lands
  with its source-contract test and is covered by the real-compiler + typed-facade gate above. See
  the per-component entries below as they are filled in by the wave.
- **Typed-state round-trip** (ADR-0020, the confirmed kit-CRUD blocker): a `Synthesizer<T>` SPI +
  `SynthesizerRegistry` (`dev.lievit.wire.synth`) so a non-primitive `@Wire` property (record, enum,
  `LocalDate`/`LocalDateTime`/`LocalTime`/`Instant`, `BigDecimal`/`BigInteger`, `UUID`, `Set`, a
  non-String-keyed `Map`, or a user value object) dehydrates to a `@w`-tagged `{d, s, t}` tuple and
  hydrates back to the **exact** type, recursively — instead of decoding to a bare `LinkedHashMap`.
  Built-in synths for the JVM analogues of Livewire's set; a `Wireable` SPI (`toWire()` / static
  `fromWire(Object)`) the registry prefers over reflection and the native-safe escape hatch; the
  typed-update path coerces a raw `wire:model` value (an `<input type=date>` string, a `<select>`
  enum name) to the field's declared type. Primitives and plain JSON pass through unwrapped, so the
  Counter snapshot stays byte-identical. The AOT processor registers the typed `@Wire` field types so
  it round-trips in a native image too.
- **Class-instantiation guard** (ADR-0021, the new part of the gadget-denylist issue): a
  `ClassInstantiationGuard` consulted before any synthesizer reflectively instantiates the class
  named in a tuple's `t`. Default-deny by gadget-prone root (`Runtime`, `ProcessBuilder`, IO / net /
  naming / scripting / templating, Spring context, …) layered under the existing ADR-0013 JSON-shape
  allowlist; a denied class is a `FORBIDDEN_DESERIALIZATION` (422), never a 500. The shipped HMAC /
  `PayloadGuard` / `ChecksumFailureLimiter` paths are untouched.
- **Request lifecycle + interceptor bus** (ADR-0022): a fixed, observable phase order
  (`HYDRATE → UPDATE → UPDATED → CALL → RENDER → DEHYDRATE → DESTROY`, mount variant
  `MOUNT → RENDER → DEHYDRATE → DESTROY`) dispatched through a named `LifecycleBus`
  (`on(phase, listener)` / `trigger(phase, ctx)` with `finish`-callback semantics), so a feature
  registers as a listener instead of a hardcoded branch. Strict ordering: `UPDATED` finishers run
  after **all** updates (one hook can override another), a `CALL` listener can early-return to skip
  the method (the magic-action seam), `RENDER` is skippable (the renderless seam), and a `DEHYDRATE`
  memo survives the stateless round trip in the snapshot wire (the locales / persistent-middleware
  pattern). The default bus is empty (behavior-neutral). `WireDispatcher`, `SynthesizerRegistry`, and
  `LifecycleBus` are auto-configured beans, overridable by the application.

- **Livewire v4 client convergence** (ADR-0024), all additive on the ADR-0019 client seams (no
  dispatcher/codec/bundle-core rewrite):
  - **Client interceptors** (#93): a participating `InterceptorChain` alongside the observing
    `LifecycleBus`, with the pinned phase order
    `onInit → onSend → onSuccess → onSync → onEffect → onMorph → onFinish → onRender` plus
    `onCancel` / `onError` / `onRedirect`. An interceptor can `cancel()` a call, mutate outgoing
    headers/updates, and block a server redirect; global / per-action / per-component scopes.
  - **Surgical snapshot merge** (#87): `mergeNewSnapshot(base, server, intent)` keeps an in-flight
    client edit to a path the server did not change (same-path server change wins), with
    reverse-indexed array removals, dot-paths, key-order preservation, and large/sparse numeric keys
    kept as keyed objects. The runtime keeps an ephemeral wire mirror seeded from the snapshot.
  - **Islands** (#89): HTML-comment fragment markers + `parseIslands` / `morphIslands` (replace /
    append / prepend, deduped) and an `l:island` directive that re-renders only the named region; an
    additive `islands` effect key.
  - **v4 directives** registered through one `registerV4Directives`: `l:bind.<attr>` (#75),
    `l:text` (#77), `l:dirty` + `$dirty` (#85), `l:error` / `l:errors` + `$errors` (#101),
    `l:ref` (#109), `l:sort` (#111), `l:click.async` (#97), and disable-during-request (#125).
  - **Request bundling** (#95): a per-component commit queue (a click burst collapses to ordered
    round-trips), `.async` opts out to race.
  - **Release tokens + bfcache** (#105): a `release` effect key + `data-lievit-release`, and a
    `pageshow`-from-bfcache reload, both CSP-safe.
  - **CSP-safe `$js`** (#131): a `JsRegistry` (`runtime.js.register(name, fn)`) + a `js` effect key
    the server triggers by name — lievit's no-inline-script replacement for Livewire's `$js`; an
    unknown name is a logged no-op, never an `eval`.
  - Server side: additive `island(name)` / `js(name, args...)` / `release(token)` on `LievitEffects`,
    serialized as new `Lievit-Effects` keys (`islands` / `js` / `release`), header omitted when empty
    (byte-for-byte ADR-0001/0012 backward compatible); native hints for the new `WireEffects.Js`.

- `Lievit.test()`: the developer-facing component test harness (ADR-0010), shipped as a feature in
  `lievit-spring-boot-starter` (`dev.lievit.test`). A fluent tester that mounts and drives
  a `@LievitComponent` through the real wire pipeline (codec → registry → dispatcher → template →
  the `POST /lievit/{id}/call` HTTP edge over `MockMvc`), headless, carrying the signed snapshot
  internally. Surface: `mount()`, `model(field, value)`, `call(action)`, `assertWire(path, value)`
  (typed, dotted + `.size`), `assertWireMatches(predicate)`, `assertSee` / `assertDontSee` /
  `assertSeeHtml` / `assertSeeInOrder`, `assertSnapshotRotated` / `assertSnapshotValid`, and
  `assertRejected(<reason>.class)` for the error-code state machine — including `LockedProperty`
  (403, attacker's seat) and `TooManyFailures` (429), the two Livewire's own component tester cannot
  reach. Hostile-seat affordances `tamperUpdate` / `forgeSnapshot`. The `@LievitTest` meta-annotation
  bundles the `@SpringBootTest` slice + dev signing key + `MockMvc` (test-scope; does not count
  against the seven-annotation cap). Failure messages name the call sequence. The Spring-test deps
  are `optional` so they reach an adopter's test classpath, never their runtime. Dogfooded: the
  verbose `CounterRoundtripIT` is rewritten on top of it; the harness has its own test suite
  (`LievitTesterIT`). Deferred (open questions): `assertModelLive` / `assertModelDeferred` (gated on
  the template-parse surface, ADR-0010 sect. 2.4/2.6) and an `assertEffect`-style surface (waits on
  the sibling effects-channel work).
- `lievit-kit`: the admin layer ("Filament for Spring") as an in-monorepo reactor module on the
  lievit runtime (ADR-0008, amended 2026-06-17). Skeleton: `AdminPanel` builder DSL,
  instance-based `AdminResource<T>`, the shared `AdminSchema` parent of the `AdminForm`/`AdminTable`
  builders (one hierarchy from v0.1, no later unification), `AdminRenderHook` named injection
  points, the persistence-agnostic `AdminRecordRepository<T>` port, `AdminPanelPlugin`
  (`getId`/`register`/`boot`), and the first-class `@AdminPage`. Proven end-to-end by a hello-admin:
  a list-only `AdminResource` rendered through the runtime via lievit-jte (`HelloAdminIT`).
- `lievit-kit` CRUD data spine (the Filament P0, full-page List / Create / Edit / Delete only;
  modal / single-page CRUD is deferred to the nested-component wave). `RecordRepository` gains a
  bounded read (`Query` offset+limit + `Page<T> page(Query)`, replacing unbounded `findAll`, kept as
  a default) and the write path (`create` / `update` / `delete`). `Form` owns the write: a
  `FormBinder<T>` maps string state to and from the typed record, an optional `FormValidator`
  (Jakarta Bean Validation) gates `save` at submit time and collects `FieldError`s, and `save`
  returns a `SaveResult<T>`. `AdminAction<T>` is the first-class action abstraction with built-in
  `CreateAction` / `EditAction` / `DeleteAction`; on success they flash an `AdminNotification` and
  redirect on the existing `LievitEffects` substrate (`DeleteAction` is server-confirmed). The
  write boundary funnels through the `AdminAuthorizer` seam (default `permitAll()`; the host wires
  its policy). `AdminListView` (with `Pagination`) / `AdminFormView` are the render view-models;
  `ListPageDriver` / `FormPageDriver` are the reusable page logic a concrete `@LievitComponent`
  delegates to (the core binds only members declared on the component class itself); `ResourcePages`
  + `Resource.pages()` bind a resource to its four pages. A worked CRUD example (`ListingResource`
  + three page components + JTE templates) drives the whole spine List→Create→Edit→Delete through
  the real runtime and effects channel (`HelloAdminIT`).
- Release readiness: `jitpack.yml` so the Java 25 reactor builds on JitPack and is consumable as
  `dev.lievit:<module>`; the README gained a JitPack install snippet (Maven + Gradle).
  Single source of version truth via the Maven CI-friendly `${revision}` property + the
  flatten-maven-plugin (a version bump is now a one-line edit, not 12). CI un-stubbed: the `build`
  job runs the real `./mvnw -B verify`, the `native` job runs the real AOT reachability gate, and
  the placeholder `tracegate` job was removed (it gated nothing).
- Repository foundation: organisation, conventions, and the doc set derived from the locked
  design decisions in the project entity. README-driven skeleton (category, three strata, the
  seven-annotation public API, wire protocol v0.1, quickstart). Foundational ADRs under
  `docs/adr/`. Living-docs plan under `docs/PLAN.md`.
- The Maven build is wired and green across all 11 modules (the wire runtime, the single-file DSL,
  five template adapters, the Spring Boot starter, the admin kit, the CLI) plus a runnable
  golden-path example.

### Fixed

- **Island vs whole-component snapshot race — silent lost update (#7).** An `l:island` re-render and a
  whole-component re-render share one `state.snapshot` but ran their commits across an `await` with no
  ordering, so a `l:model` edit typed while an island call was in flight was silently wiped (the
  island's commit cleared the WHOLE pending set; `SnapshotCodec.verify` checks signature+expiry only,
  no CAS, so it was silent, not a 409). The snapshot-commit critical section is now serialized per
  component (a `commitChain` mutex) so concurrent island/whole-component commits apply one at a time in
  completion order, and a commit drops ONLY the pending paths it actually sent, preserving a newer edit
  that arrived mid-flight. The network stays concurrent (independent scopes still fly in parallel).
- **`.async` same-scope race — silent `@Wire` clobber (#8).** `l:async` actions bypass the commit
  queue to run in parallel, but each rotated the shared snapshot, so a stateful `.async` action
  silently lost-updated `@Wire` (the markup advertised safe parallel mutation it could not deliver).
  `.async` is now RESTRICTED to renderless / side-effect-only actions: a `.async` run never reads or
  rotates the snapshot, never merges, never morphs — it applies only its side effects (`dispatch` /
  `redirect` / `url` / `js`). To mutate `@Wire`, use a normal queued action.
- **File-upload re-entrancy — orphaned controller + stale-ref clobber (#9).** A second file pick
  overwrote the in-flight `AbortController`, orphaning the first (uncancellable), and a slow first
  upload could write a stale temp-ref over `@Wire` out of order. `uploads.handle()` now aborts any
  existing controller for the input before starting, tags each run with a monotonic id, and drops a
  superseded run's `setModel` so only the latest pick's ref lands.
- **Native text input could not be server-cleared once typed into (#13).** A dirty `.value` detaches
  from the `value` attribute, so a server-asserted empty/changed value reconciled only the attribute
  and never reached the screen. The morph now pushes a server-asserted `value`/`checked` onto the live
  property, so a server clear (`value=""`) or change actually lands; an un-asserted re-render still
  preserves in-progress typing.

### Changed

- **Client-runtime morph markers are namespaced under one reserved prefix `data-lievit-rt-*`.** The
  morph's "preserve client-owned attributes" allowlist was a per-NAME list that had to grow with every
  new marker (re-creating the same double-bind defect each time). All runtime bind/state markers
  (`bound-*`, `init-fired`, `current-bound`, `page-bound`, `poll-armed`, `lazy-loaded`, `upload-bound`,
  `loading-active`) moved under `data-lievit-rt-`, and `isClientOwnedMarker` is now a one-line
  `startsWith`. Behaviour identical; adding the next marker needs no morph edit. The no-LCS /
  no-backtracking morph mis-pair of unkeyed siblings on a leading tag-shift (#12) is documented as a
  deliberate non-goal in the morph source, with keying as the user-side mitigation (golden tests pin
  both the mis-pair and the keyed fix).

## [0.1.0] - unreleased

_Wire protocol v0.1 target. Not yet shipped._
