# ADR-0061: `@script` / `@assets` once-semantics (compile-time capture, deterministic keys)

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

Issue #119. Livewire's `@script` registers per-component JS that runs once when the component
initializes on the client; `@assets` registers head scripts/styles loaded once per page regardless of
instance count, deduped by a deterministic compile-time key. lievit needs the same once-semantics, but
in the JVM-native model (ADR-0023): there is no Blade text to slice, the JVM compiler already produced
the class.

The per-component `@script` analogue already exists: the colocated `<Simple>.lievit.ts` module, which
the compiler records and the asset pipeline (ADR-0060) serves as the `run($wire,$js)` entry, loaded
once per component type. What was missing is the `@assets` analogue: shared third-party head assets
(a CDN stylesheet, a charting library `<script src>`) a component declares and the page ships *once*,
deduped across instances.

## Decision

- A component declares its `@assets` head tags in a colocated **`<Simple>.lievit.assets`** resource,
  one head tag per non-blank line (`#`-comment and blank lines skipped). The compiler captures them
  **verbatim** (no parsing, no rewriting; ADR-0023's "reflect + parse colocated regions") into
  `CompiledComponent.assets()` (a `ComponentAssets` record).
- The capture stamps a **deterministic dedup key** `lw-<crc32(templateId)>-assets`
  (`DeterministicKeys`-family, the same identity hash as the keyless-child key, suffixed by role).
  Stable across re-renders, distinct per component, so the page ships a component's `@assets` exactly
  once regardless of how many instances render.
- The starter's `ComponentAssetEmitter` (ADR-0060) emits the `@assets` head tags into the wire
  update's `assets.headTags` only when the key has not shipped on this page yet; the client
  `applyAssets` injects each once. The per-component `.lievit.ts` ships once per component type (the
  `@script` once-per-component analogue).

## Consequences

- A component can ship shared head assets once per page and per-component init JS once per component
  type, the Livewire once-semantics, without any Blade-style text parsing: the carriers are colocated
  files the JVM build already produces.
- The dedup is deterministic and content-addressed: a renamed/moved component changes its key (the
  spec follows the code), and the page never double-loads a shared asset.
- `@assets` tags are author-provided markup served verbatim, the same trust model as a hand-written
  head tag; the client refuses a bare inline `<script>` (no `src`) to keep the strict-CSP posture.

## Alternatives considered

**Parse `@script` / `@assets` blocks out of a template's text.** Rejected (ADR-0023 already marks this
N/A): lievit has no Blade text layer; the colocated-file carriers are the JVM-native shape and need no
text slicing.

**A runtime annotation (`@LievitAssets`) on the class.** Rejected: it adds to the seven-annotation cap
(ADR-0002) for what a colocated convention file already expresses, and would force the head-tag strings
into Java source (worse for a CSP review than a plain `.assets` file).
