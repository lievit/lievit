/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

/**
 * A flexbox row container (the filament-schemas {@code Flex} carried over): lays children in a
 * horizontal flex row where each child honors grow/shrink (via its {@link Layout#columnSpan}). Use
 * a {@link Grid} for a fixed column layout; use {@code Flex} for a fluid row.
 */
public final class Flex extends Layout<Flex> {

    private Flex() {}

    /**
     * @return a new flex row
     */
    public static Flex make() {
        return new Flex();
    }
}
