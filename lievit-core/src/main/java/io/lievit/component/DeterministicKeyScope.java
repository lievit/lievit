/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import java.util.HashMap;
import java.util.Map;
import java.util.function.BiFunction;

import org.jspecify.annotations.Nullable;

/**
 * The per-render scope that generates a stable {@code @key} for a child declared without an explicit
 * one (ADR-0023, completing ADR-0016's key contract for the keyless case). It is bound around a
 * render exactly as {@link LievitChildren} and {@link LievitEffects} are (a {@link ThreadLocal},
 * cleared in a {@code finally}), so nothing survives between stateless wire calls (the ADR-0001
 * invariant).
 *
 * <p>A scope holds a per-template counter: for the current template position it yields a key, then
 * advances the counter. The key <em>format</em> is supplied by the binder via a generator function
 * (template-id, counter) {@code ->} key; the production binder (the starter) installs the
 * {@code lievit-compiler} {@code DeterministicKeys} generator ({@code lw-<crc32(template)>-<counter>},
 * Livewire {@code DeterministicBladeKeys} parity). When no scope is bound at all, {@link
 * LievitChildren} falls back to a positional key, so {@code lievit-core} builds and tests without a
 * hard dependency on the compiler module.
 *
 * <p>Keeping the format pluggable is what lets the crc32 detail live in {@code lievit-compiler} (the
 * authoring/compile layer) while the binding seam lives in the core next to the children sink: the
 * core never learns the key format, only that there is one and it is stable per template position.
 */
public final class DeterministicKeyScope {

    private static final ThreadLocal<@Nullable DeterministicKeyScope> CURRENT = new ThreadLocal<>();

    /** The default generator the core ships: a positional key, used until a richer one is installed. */
    public static final BiFunction<String, Integer, String> POSITIONAL =
            (templateId, counter) -> "lievit-child-" + counter;

    private final BiFunction<String, Integer, String> generator;
    private final Map<String, Integer> countersByTemplate = new HashMap<>();
    private String currentTemplate = "";

    /** Builds a scope with the positional key generator (the core default). */
    public DeterministicKeyScope() {
        this(POSITIONAL);
    }

    /**
     * Builds a scope with a custom key generator.
     *
     * @param generator {@code (templateId, counter) -> key}; the compiler installs the crc32 form
     */
    public DeterministicKeyScope(BiFunction<String, Integer, String> generator) {
        this.generator = generator;
    }

    /**
     * @return the scope bound to the current thread, or {@code null} if none is bound (the keyless
     *     sink then falls back to a positional key)
     */
    public static @Nullable DeterministicKeyScope current() {
        return CURRENT.get();
    }

    /** Binds {@code scope} as the key scope for the current thread (called by the render binder). */
    public static void bind(DeterministicKeyScope scope) {
        CURRENT.set(scope);
    }

    /** Clears the bound scope for the current thread (called by the binder in a finally). */
    public static void clear() {
        CURRENT.remove();
    }

    /**
     * Enters a template's key namespace: subsequent {@link #nextKey()} calls count within {@code
     * templateId}, so the same position in the same template is stable across re-renders and two
     * templates never collide.
     *
     * @param templateId the render/template identity (component FQN for single-file; template path
     *     for multi-file)
     */
    public void enter(String templateId) {
        this.currentTemplate = templateId == null ? "" : templateId;
        countersByTemplate.putIfAbsent(currentTemplate, 0);
    }

    /**
     * Yields the next deterministic key for the current template, then advances the counter.
     *
     * @return the generated key (stable for this template position across re-renders)
     */
    public String nextKey() {
        int counter = countersByTemplate.getOrDefault(currentTemplate, 0);
        String key = generator.apply(currentTemplate, counter);
        countersByTemplate.put(currentTemplate, counter + 1);
        return key;
    }
}
