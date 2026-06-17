# ADR-0023: The v4 compiler layer (single-file compilation, `<lievit:...>` tag compilation, deterministic keys)

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

Livewire 4's headline is a **compiler**: a single-file component (a `.blade.php` mixing a `<?php
class ?>` block, a view, a root `<script>`, a `<style>`, and a `@placeholder`) is parsed and cached
to artifacts (an anonymous class with injected `view()/script()/style()/placeholder()` methods, a
hoisted view, side script/style files), and `<livewire:foo :bar="x" wire:key="k">` tags are
precompiled into a runtime mount call. When no `wire:key` is given, Livewire's
`DeterministicBladeKeys` generates a *stable* `lw-<crc32(view-path)>-<counter>` key so a re-render of
the same template position reuses the same component id, the morph anchor.

Three forces shape the lievit answer:

1. **The render seam is the `TemplateAdapter` SPI (ADR-0004) and the authoring split is fixed
   (ADR-0003/0018).** lievit already compiles its markup: the single-file mode is the type-safe DSL
   (`@LievitRender` returning `Html`), the multi-file mode is JTE (type-checked by the JTE annotation
   processor). lievit does **not** need a bespoke source-text parser/classgen pipeline the way
   Livewire does, because the JVM compiler and JTE's processor already *are* the compiler. So the
   "compiler" issue (#173) maps mostly to **caching the reflected/parsed component shape** keyed by
   source identity, plus a documented map of which Livewire compiler steps lievit replicates vs
   replaces vs marks `N/A` (Blade-coupled).

2. **The deterministic key is load-bearing and currently missing (#175).** Children are declared
   through the `LievitChildren` sink (ADR-0016), which today **requires** an explicit key
   (`child(key, Cls, props)`). An author writing a list hand-rolls `"row-" + i`. Without a generated
   stable key for the keyless case, a `<lievit:row/>` inside a loop has no morph identity and state
   bleeds between rows on re-render, exactly the gestionale list/table bug #175 names.

3. **The compile layer must stay out of the dispatcher (ADR-0007/0018).** The `WireDispatcher`,
   `SnapshotCodec`, registry, and the `POST /lievit/{id}/call` edge are engine-agnostic and must stay
   so. The compiler is an authoring/compile concern: it produces the inputs the dispatcher consumes
   (a component shape, a mount declaration, a key), it never reshapes the wire.

## Decision

Ship the compile layer as a new module **`lievit-compiler`** that depends only on `lievit-core`
(pure Java, zero Spring, zero new runtime reflection beyond what the core already does, GraalVM-native
unchanged), with three parts.

### 1. Deterministic keys (`DeterministicKeys` + `DeterministicKeyScope`)

`DeterministicKeys.of(templateId, counter)` yields `lw-<crc32(templateId)>-<counter>` (Livewire
`DeterministicBladeKeys` parity: same prefix, same crc32, same counter shape). `templateId` is the
**template/render identity** (the component FQN for a single-file render; the JTE template path for a
multi-file render), so two different templates never collide and the same position in the same
template is stable across re-renders.

A request-scoped `DeterministicKeyScope` holds the per-template counter and a per-render set of
already-emitted keys (so an explicit key and a generated key cannot collide). It is bound around a
render exactly as `LievitChildren` / `LievitEffects` are (a `ThreadLocal`, cleared in a `finally`),
which is why the **core seam touch** below is minimal and consistent with the existing sink pattern.

### 2. Keyless children: a core seam change in `LievitChildren` (coordinated with ADR-0016)

`LievitChildren` gains keyless overloads `child(Class, props)` / `child(Class)` that, when a
`DeterministicKeyScope` is bound, pull the next deterministic key for the current template position;
the explicit-key overloads are unchanged. This is the only `lievit-core` change: it closes ADR-0016's
key contract for the keyless case without moving the wire protocol, the snapshot schema, or the
codec, and without an eighth annotation (it is a runtime call, like ADR-0016's sink). The duplicate-key
hard error and the blank-key rejection (ADR-0016) are preserved; a generated key is registered in the
scope so a later explicit key equal to it is still caught.

The scope is **optional**: if no scope is bound (e.g. a unit test calling the sink directly), the
keyless overload falls back to a positional key (`lievit-child-<n>`), so `lievit-core` keeps building
and testing without a hard dependency on `lievit-compiler`. The starter binds a real
`DeterministicKeyScope` per render (the wiring lives in the starter, not the core), so production
renders get the crc32 keys.

### 3. `<lievit:...>` tag compilation (`LievitTagCompiler` -> `CompiledTag`)

`LievitTagCompiler` parses a `<lievit:foo .../>` tag (open / self-closing / closing / slot forms)
into a `CompiledTag`: the component name (kebab tag segment), the **bound** attributes (`:bar="expr"`,
value is an expression to evaluate against the parent's model) vs **literal** attributes
(`bar="text"`), attribute-name kebab->camel, the explicit key (`wire:key` / `l:key` / `key`), the
reserved params (`lazy`, `defer`, `lazy.bundle`, `wire:ref` / `l:ref`), the dynamic-component form
(`:is="expr"`), and the `<lievit:styles>` / `<lievit:scripts>` asset shortcuts. The compiler is the
**parse step only**: it emits a `CompiledTag` descriptor that the render layer turns into a
`LievitChildren.child(...)` call (explicit key honored, deterministic key generated when absent). It
does not itself mount or evaluate expressions, so it stays pure and out of the dispatcher. Bound and
literal values escape by the same rules the DSL/JTE output obeys (the tag compiler never emits an
unescaped attribute).

### 4. Single-file compilation cache (`CompiledComponent` + `ComponentCompiler`)

`ComponentCompiler.compile(type)` returns a `CompiledComponent`: the cached compiled shape of a
single-file component, carrying its `ComponentMetadata` (the reflected class + view), the
render-template id used for keys, and the optional **side artifacts** the single-file form colocates,
a script-module entry (the `run($wire, $js)`-equivalent convention, named per ADR), a scoped/global
style, and a placeholder (the lazy-load hook, part 5). The cache is keyed by the component class and
invalidated by a **source-staleness signature** (the class file's last-modified time, the JVM analogue
of Livewire's `source path + mtime`), so a dev-mode change recompiles and a production build compiles
once. The compiler does **not** parse Java source text or generate classes: the JVM compiler and JTE
already produce the class and the type-checked view, so the lievit "compilation" is *reflect + parse
the colocated side regions + cache*, not *classgen*. The replicate-vs-replace-vs-N/A map is recorded
in this ADR (below) and in the module's `package-info`.

### 5. Lazy/placeholder hook

A single-file component may declare a placeholder via `@LievitRender(placeholder = true)`-shaped
convention captured as the `CompiledComponent.placeholder()` artifact: the markup shown while a `lazy`
child mounts. The tag compiler reads `lazy` / `lazy.bundle` reserved params; the placeholder artifact
is the markup the render layer emits in the placeholder's slot until the real mount completes. This is
the compile-side hook only; the deferred-mount transport (mount-on-intersection) is a client/runtime
concern for a later issue, so v0.1 ships the hook and the artifact, not the transport.

## What lievit replicates / replaces / marks N/A (the #173 map)

| Livewire 4 compiler behavior | lievit |
|---|---|
| Single-file form (class + view + script + style + placeholder) | **Replaced** with the JTE-native shape: a typed Java class (DSL `@LievitRender` for single-file, or `@LievitComponent(template=...)` for multi-file) + a colocated `.ts` module + scoped CSS. Same five regions, JVM-native carriers. |
| Parse `<?php class ?>` block, generate an anonymous class | **N/A**: the JVM compiler owns class generation; the class is the source of truth, reflected, not generated. |
| Hoist `use` statements from the class block into the view | **N/A**: Java imports are resolved by the compiler; JTE `@import` is type-checked by its processor. |
| Cache artifacts keyed by source path + mtime, recompile on staleness | **Replicated**: `ComponentCompiler` caches the `CompiledComponent` keyed by class + last-modified signature. |
| Root-level `<script>` extracted (col 0), nested scripts left in view, body wrapped in `run($wire,$js)` | **Replaced**: a colocated `.ts` module exports the lievit `run`-equivalent entry; extraction is build-time (Vite), the compiler records the entry name, it does not slice source text. |
| Scoped + global `<style>` extraction | **Replaced**: scoped CSS is a colocated artifact the compiler records; emission is the asset pipeline's job (#171). |
| `@placeholder` block -> lazy placeholder method | **Replicated**: the `placeholder()` artifact + the lazy hook. |
| Multi-file directory form (`foo/{foo.blade.php,foo.php,foo.js}`) | **Replicated** as the multi-file shape: a Java class + a JTE template + an optional `.ts`. |
| `@verbatim` / `@script` / `@assets` exclusion regexes, anonymous-class return shim | **N/A**: Blade-text-parsing concerns with no JTE/Java analogue. |
| `<livewire:foo :bar wire:key>` tag precompiler -> `@livewire(...)` call | **Replicated**: `LievitTagCompiler` -> `CompiledTag` -> `LievitChildren.child(...)`. |
| `DeterministicBladeKeys` (`lw-<crc32(path)>-<counter>`) | **Replicated**: `DeterministicKeys`, same prefix/crc32/counter shape. |

## Consequences

- The deterministic key closes ADR-0016's keyless gap: a `<lievit:row/>` (or a keyless
  `children.child(Row.class)`) in a loop now gets a stable, distinct `lw-...-N` key, so the morph
  reuses the right DOM node and row state stops bleeding (#175's gestionale case).
- **The dispatcher, codec, registry, and HTTP edge are untouched.** The compiler produces inputs
  (a key, a `CompiledTag` descriptor, a cached `CompiledComponent`); the existing `WireDispatcher`
  and `ChildRenderer` consume them unchanged. The only `lievit-core` touch is the additive keyless
  `LievitChildren.child(...)` overload + the optional `DeterministicKeyScope` binding, consistent
  with the existing `LievitEffects`/`LievitChildren` sink pattern, no new annotation (ADR-0002 cap
  held), no wire-protocol change (ADR-0001 held).
- A second authoring carrier (the `<lievit:...>` tag) is documented and tested, but it lowers to the
  same `LievitChildren` mount call ADR-0016 already established, so it adds a surface, not a path.
- GraalVM-native is unchanged (ADR-0006): no new runtime reflection; the compile cache uses the same
  reflection the core already performs, memoized.

## Alternatives considered

**A source-text parser + bytecode classgen pipeline (a literal Livewire port).** Rejected: the JVM
compiler and JTE's annotation processor already generate the class and type-check the view; a
bespoke parser/classgen would duplicate the toolchain, reintroduce the unchecked-markup hole ADR-0018
closes, and break GraalVM-native. lievit "compiles" by reflecting + caching, not by generating.

**Put deterministic keys in `ChildRenderer` (the starter).** Rejected: the key must be generated at
**declaration** time (when the parent calls `child(...)` during render), inside the per-render scope,
not at substitution time in the web layer, or the counter cannot be scoped per template position. The
generator is pure and belongs in the compile module; the scope is bound by the starter.

**A new `@LievitKey` / `@LievitTag` annotation.** Rejected: breaches the ADR-0002 cap. The keyless
`child(...)` overload + the `wire:key` attribute on the tag give the same ergonomics at zero
annotation cost, the same call ADR-0016 made for `modelable` and the children sink.

## Cross-references

- ADR-0003 / ADR-0018 — the single-file (DSL) and multi-file (JTE) authoring modes the compiler caches.
- ADR-0004 / ADR-0007 — the `TemplateAdapter` SPI and the engine-free-core boundary the compiler respects.
- ADR-0016 — the nested-components key contract this ADR completes for the keyless case.
- ADR-0002 — the seven-annotation cap (held: runtime overloads + tag attribute, no new annotation).
- ADR-0006 — GraalVM-native (held: no new runtime reflection).
- wire-protocol.md — unchanged (compilation is an authoring concern, the wire is engine-agnostic).
