/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

/**
 * The panel's default color-scheme mode (the Filament {@code ThemeMode}). {@link #SYSTEM} follows
 * the OS preference; {@link #LIGHT} / {@link #DARK} pin it.
 */
public enum ThemeMode {
    /** Follow the operating-system / browser preference. */
    SYSTEM,
    /** Force light mode. */
    LIGHT,
    /** Force dark mode. */
    DARK
}
