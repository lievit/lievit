# Architecture Decision Records

Each file under `docs/adr/` records a non-trivial design decision in a fixed format
([Michael Nygard's ADR template](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions)):
status, date, context, decision, consequences, alternatives. Short.

The point is honesty: a future contributor (or future me) can re-evaluate a decision with the
full context that produced it, instead of guessing from the code.

Most of these foundational ADRs are transcribed from the project's locked design decisions, so
they are `accepted`. The module-packaging ADR (0008) is `proposed`: it records a genuinely open
question and is pending a final call.

## Index

- [ADR-0001](0001-wire-protocol-v0.1.md): Wire protocol v0.1 (stateless HTTP + HMAC-signed snapshot). **accepted**
- [ADR-0002](0002-seven-annotation-api-surface.md): The public API is exactly seven annotations. **accepted**
- [ADR-0003](0003-single-file-multi-file-dual-mode.md): Single-file and multi-file authoring, both type-safe. **accepted**
- [ADR-0004](0004-template-adapter-strategy.md): Engine-agnostic template adapters, JTE canonical primary. **accepted**
- [ADR-0005](0005-theming-zero-css-default.md): Zero-CSS default, opt-in theme package. **accepted**
- [ADR-0006](0006-graalvm-native-day-one.md): GraalVM native day one, zero runtime reflection. **accepted**
- [ADR-0007](0007-quality-gates.md): No-compromise quality gates. **accepted**
- [ADR-0008](0008-module-packaging.md): Module packaging (one starter, modular internals). **proposed (DECISION PENDING)**
- [ADR-0009](0009-lievit-ui-copy-in-registry.md): lievit-ui is a copy-in component registry, not a Maven artifact. **accepted**
- [ADR-0010](0010-dev-test-harness.md): `Lievit.test()` — the developer-facing component test harness. **proposed**
- [ADR-0011](0011-lievit-ui-v0.1-registry-decisions.md): lievit-ui v0.1 registry decisions (manifest, config, tokens, light-DOM). **accepted**

## How to add an ADR

1. Copy `0000-template.md` to the next available number, kebab-case the title.
2. Set status to `proposed`. Open a PR. After review, flip to `accepted`.
3. If a later ADR supersedes an earlier one, reference both ways (`Superseded by`, `Supersedes`).
4. Never delete an old ADR. Mark it `superseded` or `deprecated` and link the replacement.
