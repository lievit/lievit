/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.compiler;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.jspecify.annotations.Nullable;

/**
 * A Vite build manifest ({@code .vite/manifest.json}), the version map the asset pipeline reads to
 * resolve a logical entry name (the runtime bundle {@code runtime/index.ts}, or a per-component
 * module {@code Foo.lievit.ts}) to its content-hashed built file (issue #171; Vite's
 * backend-integration contract). A production build emits one hashed file per entry
 * ({@code assets/index-B7PI925R.js}); serving that hashed file with a long cache TTL is how the
 * runtime is versioned and cache-busted under the strict CSP (the {@code src} changes only when the
 * bytes change).
 *
 * <p>This is the <strong>parsed</strong> manifest, not the reader: it is a pure-data lookup over the
 * Vite chunk records ({@code {src -> {file, css[], isEntry}}}). The starter wraps it with the
 * classpath read + cache; the compiler owns the shape so the manifest contract is testable without
 * Spring (the manifest format is a build-tool fact, not a web concern). When no manifest is present
 * (dev mode, or a build that did not emit one), a lookup is {@link Optional#empty()} and the caller
 * falls back to a fixed, unhashed dev path.
 *
 * <p>Pure Java, immutable, zero Spring, zero reflection.
 */
public final class AssetManifest {

    /** One resolved manifest entry: the hashed JS file plus any CSS files Vite split out of it. */
    public record Entry(String file, List<String> css) {
        public Entry {
            css = List.copyOf(css);
        }
    }

    /** The empty manifest: every lookup misses (dev mode / no build manifest). */
    public static final AssetManifest EMPTY = new AssetManifest(Map.of());

    private final Map<String, Entry> entries;

    private AssetManifest(Map<String, Entry> entries) {
        this.entries = Map.copyOf(entries);
    }

    /**
     * Builds a manifest from a parsed Vite manifest map (the raw JSON deserialized to
     * {@code {src -> {file, css?, ...}}}). Unknown keys are ignored; a record missing the required
     * {@code file} is skipped (a malformed entry never resolves rather than throwing at serve time).
     *
     * @param raw the parsed manifest ({@code src -> chunk record}); each chunk record is a map with at
     *     least a {@code file} string and an optional {@code css} list of strings
     * @return the immutable manifest
     */
    @SuppressWarnings("unchecked")
    public static AssetManifest of(Map<String, ?> raw) {
        if (raw == null || raw.isEmpty()) {
            return EMPTY;
        }
        java.util.LinkedHashMap<String, Entry> parsed = new java.util.LinkedHashMap<>();
        for (Map.Entry<String, ?> e : raw.entrySet()) {
            Object value = e.getValue();
            if (!(value instanceof Map<?, ?> chunk)) {
                continue;
            }
            Object file = chunk.get("file");
            if (!(file instanceof String fileStr) || fileStr.isBlank()) {
                continue;
            }
            List<String> css = Collections.emptyList();
            Object cssValue = chunk.get("css");
            if (cssValue instanceof List<?> cssList) {
                css = cssList.stream().filter(String.class::isInstance).map(String.class::cast).toList();
            }
            parsed.put(e.getKey(), new Entry(fileStr, css));
        }
        return parsed.isEmpty() ? EMPTY : new AssetManifest(parsed);
    }

    /**
     * Resolves a logical entry name to its hashed build entry.
     *
     * @param src the source key Vite keyed the chunk on (e.g. {@code runtime/index.ts})
     * @return the entry (hashed file + css), or empty when the manifest has no such entry (dev mode /
     *     a non-built entry)
     */
    public Optional<Entry> resolve(@Nullable String src) {
        return src == null ? Optional.empty() : Optional.ofNullable(entries.get(src));
    }

    /** @return true when the manifest carries no entries (dev mode / no build manifest). */
    public boolean isEmpty() {
        return entries.isEmpty();
    }
}
