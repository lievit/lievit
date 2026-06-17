# ADR-0018: The single-file DSL render path (a type-safe HTML builder + a TemplateAdapter)

- **Status:** accepted
- **Date:** 2026-06-17
- **Deciders:** Francesco Bilotta

## Context

ADR-0003 locks two authoring modes, both type-safe: multi-file (a Java class + a JTE template) and
single-file (a Java class with the markup inline via a typed HTML DSL, no separate template file).
The multi-file path exists end-to-end (the JTE adapter, ADR-0004). The single-file path was a sketch
in the README (`div(button(text("-")).attr("l:click","decrement"), ...)`) with no runtime.

The constraints the path must hold are already fixed elsewhere and do not move for it:

- The render seam is the single `TemplateAdapter` SPI (ADR-0004); the wire codec, dispatcher,
  registry, and the `POST /lievit/{id}/call` edge are engine-agnostic and must stay so (ADR-0007).
- Output must carry the same wire markers a template emits — the `data-lievit-component` root marker
  (see `counter.jte`) and the `l:*` directives the client binds (wire-protocol.md §5).
- Escape-by-construction (XSS) and CSP-safety are non-negotiable; the single-file shape must not be
  where type-safety or output-safety is lost (ADR-0003 explicitly rejects an unchecked text block).
- Zero new runtime reflection, GraalVM-native unchanged (ADR-0006).

## Decision

Ship the single-file mode as a new module **`lievit-dsl`** that depends only on `lievit-core`, with
two parts:

1. **A type-safe HTML builder.** A sealed `Html` tree (`Element`, `TextNode`, `RawNode`, `Fragment`)
   built by static factories on `H` (`div`, `span`, `button`, `text`, `el`, ...). `Element` is
   immutable with a fluent `attr(name, value)` and wire-binding helpers (`wireClick`, `wireSubmit`,
   `wireKeydownEnter`, `wireModel`, `wireModelLive`) that emit the `l:*` directives. **Escape by
   construction**: every `TextNode` body and every attribute value is HTML-escaped at render time;
   the only literal-markup path is the explicit, audit-visible `H.raw(...)`. Attribute and tag names
   are grammar-validated, so an attacker-influenced name cannot inject a second attribute or a
   handler. There is no inline-`<script>` / `on*` factory, so the output is CSP-safe by construction,
   the same rule the JTE templates obey.

2. **A `DslTemplateAdapter implements TemplateAdapter`** (the core SPI) plus a routing
   `DslOrEngineTemplateAdapter`. A component renders through the DSL when it declares **no template**
   and has an `@LievitRender` method **returning `Html`**; otherwise it delegates to the engine
   adapter (JTE primary). The DSL adapter invokes that one `@LievitRender` method, requires a single
   root `Element`, injects the `data-lievit-component` marker if the author did not, and serializes.

The starter installs the router as the primary `TemplateAdapter` bean (still
`@ConditionalOnMissingBean`). **The dispatcher, codec, registry, and controller are unchanged**: a
single-file-DSL component flows through mount → wire call → effects → morph exactly like a template
component, because the only thing that differs is which `TemplateAdapter` produces the HTML.

## Consequences

- Reactive, single-file, compile-time-checked components become real (the ADR-0003 differentiator
  versus Volt/PHP), reusing the entire existing wire pipeline; no fork of `WireDispatcher` or
  `SnapshotCodec`.
- The one reflective call (`@LievitRender.invoke`) is the same one the core dispatcher already
  performs (it discards the return; the adapter consumes it). For a DSL component the render method
  runs twice per render (dispatcher + adapter); it must be a pure function of state, which the
  event-sourcing-style "render is derived from state" model already assumes. No new reflection is
  introduced, so the GraalVM-native posture (ADR-0006) is unchanged.
- The builder is a second authoring surface to document, learn, and test (the cost ADR-0003 already
  accepted). It is curated, not exhaustive: `H.el(tag, ...)` covers any element the named factories
  omit.
- The public-API cap (ADR-0002, seven annotations) is untouched: the DSL adds types and static
  factories, no eighth annotation. `@LievitRender` returning `Html` is the single-file render, which
  ADR-0002 already names.

## Alternatives considered

**Extend the core `WireDispatcher` to render the DSL directly.** Rejected: it would couple the
engine-free core to a specific markup representation and fork the render path the SPI exists to keep
single (ADR-0004/0007). Routing behind the `TemplateAdapter` SPI keeps the core untouched.

**A separate `@LievitView`/`@LievitDsl` annotation to mark single-file components.** Rejected: it
would breach the seven-annotation cap (ADR-0002) for no gain. "No template + an `@LievitRender`
returning `Html`" is already an unambiguous, annotation-free signal the router reads.

**A string-template / text-block builder (the dumbest thing).** Rejected for the same reason
ADR-0003 rejects it: it reintroduces the unchecked-markup, XSS-prone hole the typed builder exists to
close. The typed tree is the canonical, escape-by-construction path.

**Pull in an existing typed-HTML library (j2html / HtmlFlow).** Rejected for v0.1 to keep
`lievit-dsl` dependency-free (only `lievit-core`), keep escaping/CSP/`l:*` semantics under our
control, and keep the GraalVM-native surface minimal. Adopting one later stays an internal change
behind the same `Html`/`H` surface.
