/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The lievit v4 compiler layer: the authoring/compile concern, kept strictly separate from the
 * dispatch engine (ADR-0023). Three parts:
 *
 * <ul>
 *   <li>{@link dev.lievit.compiler.DeterministicKeys} — {@code lw-<crc32(template)>-<counter>} key
 *       generation (Livewire {@code DeterministicBladeKeys} parity), the morph anchor for keyed
 *       children declared without an explicit {@code wire:key}; wired into the core's
 *       {@code DeterministicKeyScope} via {@link dev.lievit.compiler.DeterministicKeys#GENERATOR}.
 *   <li>{@link dev.lievit.compiler.LievitTagCompiler} / {@link dev.lievit.compiler.CompiledTag} — the
 *       {@code <lievit:...>} tag parser (Livewire {@code LivewireTagPrecompiler} parity): a tag
 *       becomes a pure-data mount declaration (bound vs literal attributes, kebab-&gt;camel, explicit
 *       key, reserved params, {@code :is} dynamic, asset shortcuts). The render layer lowers it to a
 *       {@code LievitChildren.child(...)} call; the compiler never mounts or evaluates expressions.
 *   <li>{@link dev.lievit.compiler.ComponentCompiler} / {@link dev.lievit.compiler.CompiledComponent} —
 *       the single-file compilation cache (Livewire {@code Compiler} + {@code CacheManager} parity),
 *       keyed by class + a source-staleness signature, carrying the reflected metadata, the
 *       key-namespace template id, and the colocated side artifacts (script module, scoped style,
 *       lazy placeholder).
 * </ul>
 *
 * <h2>What lievit replicates / replaces / marks N/A (the #173 compiler map)</h2>
 *
 * lievit does NOT parse Java source text or generate classes: the JVM compiler and the JTE
 * annotation processor already produce the type-checked class + view, so lievit "compiles" by
 * <em>reflect + parse colocated regions + cache</em>. Concretely:
 *
 * <ul>
 *   <li><b>Replaced</b> with a JTE/JVM-native shape: the single-file form (one Java class +
 *       colocated {@code .ts}/{@code .css}), root-script extraction (a colocated module + Vite
 *       build, not source slicing), scoped-style extraction (a colocated artifact the asset pipeline
 *       emits).
 *   <li><b>Replicated</b>: the artifact cache keyed by source-staleness, the multi-file directory
 *       form, the placeholder/lazy hook, the {@code <lievit:...>} tag-to-mount precompile, and the
 *       deterministic-key generation.
 *   <li><b>N/A</b> (Blade-text concerns with no analogue): {@code <?php class ?>} parsing +
 *       anonymous-class generation, {@code use}-statement hoisting, {@code @verbatim}/{@code @script}/
 *       {@code @assets} exclusion regexes, the anonymous-class return shim.
 * </ul>
 *
 * <h2>Boundary</h2>
 *
 * Pure Java, depends only on {@code lievit-core}, never on Spring, never on a template-engine
 * adapter (ADR-0004/0006/0007). No new runtime reflection beyond what the core already performs
 * (memoized here), so the GraalVM-native posture is unchanged (ADR-0006). The layer produces the
 * inputs the dispatcher consumes (a key, a mount declaration, a cached shape); it never touches the
 * {@code WireDispatcher}, the {@code SnapshotCodec}, the registry, or the {@code POST /lievit/{id}/call}
 * edge.
 */
@NullMarked
package dev.lievit.compiler;

import org.jspecify.annotations.NullMarked;
