/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

/**
 * Where the table renders its filter controls (the Filament {@code FiltersLayout}): in a dropdown off
 * the toolbar (the default), above or below the table content, or in a slide-over panel. The list
 * view-model carries the chosen layout so the template stamps the filter panel in the right surface
 * with the right wrapper hook.
 */
public enum FiltersLayout {

    /** Filters live in a dropdown opened from the toolbar (the Filament default). */
    DROPDOWN,
    /** Filters render in a row above the table content. */
    ABOVE_CONTENT,
    /** Filters render collapsed in a row above the table content. */
    ABOVE_CONTENT_COLLAPSIBLE,
    /** Filters render in a row below the table content. */
    BELOW_CONTENT,
    /** Filters live in a slide-over panel opened from the toolbar. */
    MODAL;

    /**
     * @return the stable token the template stamps as {@code data-filters-layout} (lower-kebab, e.g.
     *     {@code "above-content-collapsible"}), so the rendered surface is asserted without coupling
     *     to the enum constant name
     */
    public String token() {
        return name().toLowerCase(java.util.Locale.ROOT).replace('_', '-');
    }
}
