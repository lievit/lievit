/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.compiler;

import java.util.Optional;

import io.lievit.component.ComponentMetadata;

/**
 * The cached compiled shape of a lievit component (ADR-0023, issue #173): the JVM/JTE analogue of
 * Livewire 4's single-file-component compilation output. Where Livewire parses source text and
 * generates an anonymous class + side files, lievit's compile is <em>reflect + parse the colocated
 * side regions + cache</em>, because the JVM compiler already produced the class and the JTE
 * annotation processor already type-checked the view. So this record carries:
 *
 * <ul>
 *   <li>the reflected {@link ComponentMetadata} (the class, its {@code @Wire} fields, actions,
 *       lifecycle hooks, and the declared template);
 *   <li>the {@link #templateId} the {@link DeterministicKeys} generator hashes for keyless children
 *       (the component FQN for a single-file render; the template path for a multi-file render), so
 *       two templates never share a key namespace;
 *   <li>the optional colocated side artifacts the single-file form colocates and lievit discovers by
 *       convention next to the class on the classpath: a {@link #scriptModule} entry (the
 *       {@code run($wire,$js)}-equivalent module path), a scoped/global {@link #style}, and a
 *       {@link #placeholder} (the lazy-load hook).
 * </ul>
 *
 * <p>Immutable, pure data. It never holds rendered HTML or component state (the statelessness
 * invariant of ADR-0001 holds): it is the compiled <em>description</em> the render layer consumes.
 *
 * @param metadata the reflected component metadata
 * @param templateId the key-namespace identity (FQN for single-file, template path for multi-file)
 * @param singleFile whether this renders via the DSL ({@code @LievitRender} returning Html, ADR-0018)
 *     rather than a named template
 * @param scriptModule the colocated client script module path, if present (e.g.
 *     {@code Foo.lievit.ts}); the asset pipeline (#171) builds + injects it under the strict CSP
 * @param style the colocated scoped/global CSS, if present
 * @param placeholder the colocated lazy-load placeholder markup, if present
 * @param assets the per-component {@code @assets} head tags captured once-per-page (issue #119), keyed
 *     deterministically so the page dedups them across instances; empty when none declared
 */
public record CompiledComponent(
        ComponentMetadata metadata,
        String templateId,
        boolean singleFile,
        Optional<String> scriptModule,
        Optional<String> style,
        Optional<String> placeholder,
        ComponentAssets assets) {

    /**
     * @return the component's fully-qualified class name (the snapshot {@code cls})
     */
    public String className() {
        return metadata.className();
    }

    /**
     * @return true if the component colocates any side artifact (script, style, placeholder, or
     *     {@code @assets} head tags)
     */
    public boolean hasSideArtifacts() {
        return scriptModule.isPresent()
                || style.isPresent()
                || placeholder.isPresent()
                || !assets.isEmpty();
    }
}
