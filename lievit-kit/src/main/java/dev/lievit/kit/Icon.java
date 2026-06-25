/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.Objects;

/**
 * A semantic icon reference. The kit refers to icons by a stable <em>alias</em> (for example
 * {@code "nav.dashboard"}, {@code "actions.delete"}) rather than a concrete glyph name, so a theme
 * or adopter can re-map an alias to a different icon set through the {@link IconRegistry} without
 * touching the component that consumes it (the Filament {@code FilamentIcon}/{@code IconManager}
 * seam, mapped to the Java idiom).
 *
 * <p>The kit deliberately ships only the alias/registry seam, not a 648-case glyph catalog: the
 * concrete glyph name is data the adopter supplies. The default registry maps each kit alias to a
 * Heroicon-style outline name (for example {@code "heroicon-o-trash"}) so the out-of-the-box
 * rendering is sane; an adopter overrides any alias.
 *
 * @param alias the stable semantic alias the kit references
 */
public record Icon(String alias) {

    /** Compact constructor: the alias is required and must not be blank. */
    public Icon {
        Objects.requireNonNull(alias, "alias");
        if (alias.isBlank()) {
            throw new IllegalArgumentException("icon alias must not be blank");
        }
    }

    /**
     * @param alias the semantic alias (for example {@code "nav.dashboard"})
     * @return an icon reference for that alias
     */
    public static Icon of(String alias) {
        return new Icon(alias);
    }
}
