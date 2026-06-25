/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Resolves an {@link Icon} alias to a concrete glyph name, with adopter overrides taking precedence
 * over the kit defaults (the Filament {@code IconManager.register}/{@code resolve} seam, mapped to a
 * mutable registry instance the adopter wires as a bean).
 *
 * <p>Resolution order: a registered override wins over a default; an unknown alias resolves to
 * {@link Optional#empty()} (the caller renders no icon rather than broken markup). Registration is
 * idempotent and last-write-wins, so a theme can re-map an alias the kit already mapped.
 *
 * <p>The registry is intentionally tiny: it is the indirection point that lets every navigation
 * item, widget, action, and badge name its icon semantically. The concrete glyph catalog is the
 * adopter's data, not the kit's.
 */
public final class IconRegistry {

    private final Map<String, String> glyphs = new LinkedHashMap<>();

    private IconRegistry() {}

    /**
     * @return a registry pre-seeded with the kit's default navigation/action aliases mapped to
     *     Heroicon-style outline names, so the out-of-the-box admin renders sane icons
     */
    public static IconRegistry withDefaults() {
        IconRegistry registry = new IconRegistry();
        registry.register("nav.dashboard", "heroicon-o-home");
        registry.register("nav.resource", "heroicon-o-rectangle-stack");
        registry.register("actions.create", "heroicon-o-plus");
        registry.register("actions.edit", "heroicon-o-pencil-square");
        registry.register("actions.delete", "heroicon-o-trash");
        registry.register("actions.view", "heroicon-o-eye");
        registry.register("search", "heroicon-o-magnifying-glass");
        return registry;
    }

    /**
     * @return an empty registry with no default mappings
     */
    public static IconRegistry empty() {
        return new IconRegistry();
    }

    /**
     * Maps (or re-maps) an alias to a concrete glyph name. Last write wins, so an adopter override
     * registered after the kit default replaces it.
     *
     * @param alias the semantic alias
     * @param glyph the concrete glyph name to resolve it to
     * @return this registry
     */
    public IconRegistry register(String alias, String glyph) {
        glyphs.put(
                Objects.requireNonNull(alias, "alias"), Objects.requireNonNull(glyph, "glyph"));
        return this;
    }

    /**
     * Merges a map of alias to glyph (each entry follows {@link #register} semantics).
     *
     * @param mappings the alias-to-glyph mappings to merge
     * @return this registry
     */
    public IconRegistry register(Map<String, String> mappings) {
        Objects.requireNonNull(mappings, "mappings").forEach(this::register);
        return this;
    }

    /**
     * Resolves an icon to its concrete glyph name.
     *
     * @param icon the icon reference
     * @return the registered glyph, or empty if the alias is unknown
     */
    public Optional<String> resolve(Icon icon) {
        Objects.requireNonNull(icon, "icon");
        return Optional.ofNullable(glyphs.get(icon.alias()));
    }
}
