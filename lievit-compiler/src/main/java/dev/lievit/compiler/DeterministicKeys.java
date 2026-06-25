/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.compiler;

import java.nio.charset.StandardCharsets;
import java.util.function.BiFunction;
import java.util.zip.CRC32;

/**
 * Deterministic {@code wire:key} generation for children declared without an explicit key (ADR-0023,
 * issue #175). The key is {@code lw-<crc32(templateId)>-<counter>}, the exact shape Livewire's
 * {@code DeterministicBladeKeys} emits (prefix {@code lw-}, a CRC-32 of the template/view identity in
 * lowercase hex, then a per-template counter).
 *
 * <p>It is the morph anchor for keyed children inside a loop: the same template position yields the
 * same key on every re-render, so the client morph reuses the right DOM node instead of bleeding one
 * row's state into the next (the gestionale list/table bug #175 names). Two different templates never
 * collide because the CRC-32 is over the template identity, and two sibling positions never collide
 * because the counter advances.
 *
 * <p>Pure function, no state, no Spring, no reflection: it is wired into the core's
 * {@link dev.lievit.component.DeterministicKeyScope} via {@link #GENERATOR}, which the starter binds
 * per render. {@code lievit-core} keeps a positional fallback so it builds without this module.
 */
public final class DeterministicKeys {

    /** The Livewire deterministic-key prefix. */
    public static final String PREFIX = "lw-";

    private DeterministicKeys() {}

    /**
     * Builds the deterministic key for a template position.
     *
     * @param templateId the render/template identity (component FQN for single-file; template path
     *     for multi-file) hashed into the key, so distinct templates never collide
     * @param counter the per-template occurrence index (0-based), so distinct sibling positions
     *     never collide and the same position is stable across re-renders
     * @return {@code lw-<crc32(templateId)>-<counter>}
     */
    public static String of(String templateId, int counter) {
        return PREFIX + crc(templateId) + "-" + counter;
    }

    /**
     * Builds a deterministic key for a named, once-per-template artifact (the {@code @assets} /
     * scoped-style dedup key, issue #119/#129): {@code lw-<crc32(templateId)>-<suffix>}. Same identity
     * hash as the positional form, so an artifact key is stable across re-renders and distinct per
     * component, but suffixed by role ({@code assets} / {@code style}) rather than a sibling counter.
     *
     * @param templateId the render/template identity hashed into the key
     * @param suffix the role suffix (e.g. {@code assets}, {@code style})
     * @return {@code lw-<crc32(templateId)>-<suffix>}
     */
    public static String of(String templateId, String suffix) {
        return PREFIX + crc(templateId) + "-" + suffix;
    }

    private static String crc(String templateId) {
        CRC32 crc = new CRC32();
        crc.update((templateId == null ? "" : templateId).getBytes(StandardCharsets.UTF_8));
        return Long.toHexString(crc.getValue());
    }

    /**
     * The generator the core's {@link dev.lievit.component.DeterministicKeyScope} uses: {@code
     * (templateId, counter) -> lw-<crc32>-<counter>}. The starter installs it per render so
     * production keyless children get the crc32 keys; absent it, the core falls back to positional
     * keys.
     */
    public static final BiFunction<String, Integer, String> GENERATOR = DeterministicKeys::of;
}
