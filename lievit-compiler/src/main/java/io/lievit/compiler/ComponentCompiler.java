/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.compiler;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;

import io.lievit.component.ComponentMetadata;

/**
 * Compiles a lievit component to a cached {@link CompiledComponent} (ADR-0023, issue #173): the
 * lievit analogue of Livewire 4's {@code Compiler} + {@code CacheManager}. It reflects the component
 * metadata (the JVM compiler already produced the class), resolves the key-namespace template id,
 * discovers the colocated side artifacts by convention, and memoizes the result keyed by class plus a
 * <strong>source-staleness signature</strong> (the JVM analogue of Livewire's {@code source path +
 * mtime}): when the signature is unchanged the cached artifact is returned, when it changes (a
 * dev-mode edit) the component recompiles.
 *
 * <p>It does <strong>not</strong> parse Java source text or generate classes: that is the JVM
 * compiler's and JTE's job (the replicate-vs-replace map in ADR-0023). lievit "compiles" by
 * reflecting + parsing the colocated regions + caching, which keeps GraalVM-native unchanged (the
 * one reflective read is the same the core already performs, here memoized) and the compile layer out
 * of the dispatcher (it produces inputs the dispatcher consumes, it never reshapes the wire).
 *
 * <p>Colocated side artifacts are discovered next to the class on the classpath (the multi-file
 * directory form, ADR-0023):
 *
 * <ul>
 *   <li>{@code <Simple>.lievit.ts} (then {@code .lievit.js}) — the client script module entry;
 *   <li>{@code <Simple>.lievit.css} — the scoped/global style;
 *   <li>{@code <Simple>.placeholder.html} — the lazy-load placeholder markup.
 * </ul>
 *
 * Pure Java, zero Spring; thread-safe (the cache is a {@link ConcurrentHashMap}).
 */
public final class ComponentCompiler {

    /** A cache entry: the compiled artifact and the staleness signature it was compiled under. */
    private record CacheEntry(Object signature, CompiledComponent compiled) {}

    private final ConcurrentHashMap<Class<?>, CacheEntry> cache = new ConcurrentHashMap<>();
    private final Function<Class<?>, Object> stalenessSignature;

    /**
     * Builds a compiler with the default class-file-last-modified staleness signature (recompiles
     * when the class file on disk changes; compiles once for a packaged jar). Falls back to a
     * constant signature when the class file is not a readable file (a jar / a generated class), so a
     * production build compiles each component exactly once.
     */
    public ComponentCompiler() {
        this(ComponentCompiler::classFileSignature);
    }

    /**
     * Builds a compiler with a custom staleness signature.
     *
     * @param stalenessSignature {@code class -> signature}; the cache invalidates when the signature
     *     changes between compiles. The default reads the class file's last-modified time.
     */
    public ComponentCompiler(Function<Class<?>, Object> stalenessSignature) {
        this.stalenessSignature = stalenessSignature;
    }

    /**
     * Compiles {@code type}, returning the cached artifact if its staleness signature is unchanged.
     *
     * @param type the {@code @LievitComponent} class
     * @return the compiled component (cached; recompiled on staleness)
     */
    public CompiledComponent compile(Class<?> type) {
        Object signature = stalenessSignature.apply(type);
        CacheEntry existing = cache.get(type);
        if (existing != null && Objects.equals(existing.signature(), signature)) {
            return existing.compiled();
        }
        CompiledComponent compiled = doCompile(type);
        cache.put(type, new CacheEntry(signature, compiled));
        return compiled;
    }

    private CompiledComponent doCompile(Class<?> type) {
        ComponentMetadata metadata = ComponentMetadata.of(type);
        boolean singleFile = metadata.template().isEmpty();
        // The key namespace: the template path scopes keys for multi-file (so two components sharing
        // a template share a namespace, the Livewire behavior); the FQN for single-file.
        String templateId = singleFile ? metadata.className() : metadata.template();

        Optional<String> script =
                resourceName(type, ".lievit.ts").or(() -> resourceName(type, ".lievit.js"));
        Optional<String> style = resource(type, ".lievit.css");
        Optional<String> placeholder = resource(type, ".placeholder.html");

        return new CompiledComponent(metadata, templateId, singleFile, script, style, placeholder);
    }

    /** The script module is recorded by its resource path (the asset pipeline builds it), not inlined. */
    private static Optional<String> resourceName(Class<?> type, String suffix) {
        URL url = type.getResource(type.getSimpleName() + suffix);
        return url == null
                ? Optional.empty()
                : Optional.of(type.getPackageName().replace('.', '/') + "/"
                        + type.getSimpleName() + suffix);
    }

    /**
     * Reads a colocated text resource ({@code <Simple><suffix>}) next to the class, if present. Used
     * for styles + placeholders (read as text, the render layer emits them); the script module is
     * recorded by path via {@link #resourceName} instead (the asset pipeline builds it, not inlined).
     */
    private static Optional<String> resource(Class<?> type, String suffix) {
        try (InputStream in = type.getResourceAsStream(type.getSimpleName() + suffix)) {
            if (in == null) {
                return Optional.empty();
            }
            return Optional.of(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new IllegalStateException(
                    "failed reading colocated resource " + type.getSimpleName() + suffix
                            + " for " + type.getName(), e);
        }
    }

    /**
     * The default staleness signature: the component's {@code .class} file last-modified time when it
     * is a readable file on disk (a dev-mode edit bumps it), else a constant (packaged jar / generated
     * class), so a production component compiles exactly once.
     */
    private static Object classFileSignature(Class<?> type) {
        URL classUrl = type.getResource(type.getSimpleName() + ".class");
        if (classUrl != null && "file".equals(classUrl.getProtocol())) {
            try {
                return new java.io.File(classUrl.toURI()).lastModified();
            } catch (java.net.URISyntaxException e) {
                return "stable";
            }
        }
        return "stable";
    }
}
