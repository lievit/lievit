# Architecture Decision Records

Each file under `docs/adr/` records a non-trivial design decision in a fixed format
([Michael Nygard's ADR template](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions)):
status, date, context, decision, consequences, alternatives. Short.

The point is honesty: a future contributor (or future me) can re-evaluate a decision with the
full context that produced it, instead of guessing from the code.

Most of these foundational ADRs are transcribed from the project's locked design decisions, so
they are `accepted`. Each entry's status is shown in the index below.

## Index

- [ADR-0001](0001-wire-protocol-v0.1.md): Wire protocol v0.1 (stateless HTTP + HMAC-signed snapshot). **accepted**
- [ADR-0002](0002-seven-annotation-api-surface.md): The public API is exactly seven annotations. **accepted**
- [ADR-0003](0003-single-file-multi-file-dual-mode.md): Single-file and multi-file authoring, both type-safe. **accepted**
- [ADR-0004](0004-template-adapter-strategy.md): Engine-agnostic template adapters, JTE canonical primary. **accepted**
- [ADR-0005](0005-theming-zero-css-default.md): Zero-CSS default, opt-in theme package. **accepted**
- [ADR-0006](0006-graalvm-native-day-one.md): GraalVM native day one, zero runtime reflection. **accepted**
- [ADR-0007](0007-quality-gates.md): No-compromise quality gates. **accepted**
- [ADR-0008](0008-module-packaging.md): Module packaging (one starter, modular internals). **accepted (amended 2026-06-17, admin moved in-monorepo)**
- [ADR-0009](0009-lievit-ui-copy-in-registry.md): lievit-ui is a copy-in component registry, not a Maven artifact. **accepted**
- [ADR-0010](0010-dev-test-harness.md): `Lievit.test()` — the developer-facing component test harness. **accepted**
- [ADR-0011](0011-lievit-ui-v0.1-registry-decisions.md): lievit-ui v0.1 registry decisions. **accepted**
- [ADR-0012](0012-effects-channel.md): The effects channel (HTML body + `Lievit-Effects` header). **accepted**
- [ADR-0013](0013-payload-hardening.md): Payload hardening — settable/callable allowlist, deserialization allowlist, structural caps. **accepted**
- [ADR-0014](0014-fail-closed-error-rendering.md): Fail-closed, leak-free error rendering + the wire endpoint's security context. **accepted**
- [ADR-0015](0015-computed-properties.md): `@LievitComputed` — computed properties with per-request memoization. **accepted (supersedes ADR-0002 on the seven-annotation cap)**
- [ADR-0016](0016-nested-components.md): Nested components (keyed children, reactive props, modelable two-way bind). **accepted**
- [ADR-0017](0017-form-objects.md): Form objects — grouped fields with co-located validation. **accepted**
- [ADR-0018](0018-single-file-dsl.md): The single-file DSL render path (a type-safe HTML builder + a TemplateAdapter). **accepted**
- [ADR-0019](0019-client-runtime-bundle.md): The client runtime bundle (wire glue, bespoke morph, extension points). **accepted**
- [ADR-0020](0020-typed-state-synthesizers.md): Typed-state round-trip — a synthesizer registry + Wireable SPI. **accepted**
- [ADR-0021](0021-class-instantiation-guard.md): Class-instantiation guard for the synthesizer path. **accepted**
- [ADR-0022](0022-request-lifecycle-bus.md): Request lifecycle — ordered phases + a trigger() interceptor bus. **accepted**
- [ADR-0023](0023-v4-compiler-and-deterministic-keys.md): The v4 compiler layer (single-file compilation, `<lievit:...>` tag compilation, deterministic keys). **accepted**
- [ADR-0024](0024-v4-client-convergence.md): Livewire v4 client convergence — interceptors, surgical merge, islands, v4 directives. **accepted**
- [ADR-0030](0030-runtime-parity-events-lifecycle-magic-redirects.md): Runtime parity — events, full lifecycle hooks, magic actions, redirects. **accepted**
- [ADR-0031](0031-renderless-session-page-components.md): `@LievitRenderless`, `@LievitSession`, and full-page components (`@LievitLayout` / `@LievitTitle`). **accepted**
- [ADR-0032](0032-batch-update-endpoint-and-json-rpc.md): Batched update endpoint + `@LievitJson` JSON RPC endpoints. **accepted**
- [ADR-0033](0033-full-page-routing-and-slots.md): Full-page routing + layout wrapping, server-side slots, and island fragment compilation. **accepted**
- [ADR-0034](0034-transition-effect-and-large-payload-encoding.md): `@LievitTransition` server effect + large-payload binary encoding. **accepted**
- [ADR-0035](0035-streaming-sse-endpoint.md): Streaming server half — a live `LievitStream` sink + an SSE endpoint. **accepted**
- [ADR-0036](0036-lazy-deferred-components.md): Lazy / deferred components — `@LievitLazy`, placeholder mount, `$refresh` load. **accepted**
- [ADR-0037](0037-locale-pinning-memo.md): Locale pinning across the stateless round trip (MessageSource + memo). **accepted**
- [ADR-0038](0038-validation-depth.md): Validation depth — validateOnly, the imperative error bag, array-element rules. **accepted**
- [ADR-0039](0039-auto-injected-runtime-assets.md): Auto-injected runtime assets on full-page responses. **accepted**
- [ADR-0040](0040-realtime-broadcast-channel-sse.md): The realtime broadcast channel (server→client push over SSE). **accepted**
- [ADR-0041](0041-with-method-extra-view-data.md): `with()` extra view data (a convention-named render contribution). **accepted**
- [ADR-0042](0042-component-finder-factory-naming.md): Component discovery, factory, and naming (Finder / Factory / component stack). **accepted**
- [ADR-0043](0043-kit-actions-and-validation-view-models.md): Custom actions, bulk action grouping/selection, and the field validation builder. **accepted**
- [ADR-0044](0044-uploads-and-download-effect.md): File uploads (signed temp files + direct upload) and the `download` effect. **accepted**
- [ADR-0050](0050-navigate-depth-head-merge-persist-progress-scroll.md): Navigate depth (head merge, `l:persist`, progress bar, scroll opt-in) (#193, #195). Extends the navigate feature, no core edit. **accepted**
- [ADR-0051](0051-request-interactions-and-error-ux.md): Request interactions, per-scope (component/island) cancel-vs-queue concurrency (#95) + the `onExpired` recovery hook and page-expired dialog (#103). Client-only, composes the interceptor seams. **accepted**
- [ADR-0052](0052-teleport-placeholder-relocation.md): `l:teleport` placeholder-in-place DOM relocation, client-only (#115). **accepted**
- [ADR-0065](0065-dynamic-object-property.md): A schemaless dynamic-object `@Wire` property (the stdClass analogue) — `DynamicObject` + deep dotted-set create-missing-keys binding (#137). **accepted**
- [ADR-0066](0066-custom-type-roundtrip-and-validation.md): Custom serializable property types — round-trip closure (nested `Wireable`), hydrate type-check, nested-path validation (#139). **accepted**

## How to add an ADR

1. Copy `0000-template.md` to the next available number, kebab-case the title.
2. Set status to `proposed`. Open a PR. After review, flip to `accepted`.
3. If a later ADR supersedes an earlier one, reference both ways (`Superseded by`, `Supersedes`).
4. Never delete an old ADR. Mark it `superseded` or `deprecated` and link the replacement.
