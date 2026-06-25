/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

/**
 * How an action renders (the Filament {@code Action} view variants): a filled button, a text link,
 * an icon-only button, or a badge.
 */
public enum ActionVariant {
    /** A filled/outlined button (the default). */
    BUTTON,
    /** A text link. */
    LINK,
    /** An icon-only button (for tight rows). */
    ICON_BUTTON,
    /** A badge. */
    BADGE
}
