/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import org.jspecify.annotations.Nullable;

/**
 * One rendered table cell: a <strong>typed</strong> projection of a {@link Column}'s value for a
 * single row. This is what the list view-model carries per cell instead of a flat string, so the
 * template can render rich content (a coloured badge, a real link, an icon) rather than escaped text
 * only.
 *
 * <p>The kit derives the concrete cell type from the column's TYPE and config (the Filament column
 * shape, mapped to Java): a {@link BadgeColumn} yields a {@link Badge}, a column carrying a
 * {@link Column#url(java.util.function.Function) url mapper} yields a {@link Link} (the Filament
 * {@code ->url(...)}), an {@link IconColumn} yields an {@link Icon}, and a plain {@link TextColumn}
 * or default column yields {@link Text}. The template switches on the cell type and stamps the
 * matching server-first lievit-ui partial (the badge partial's {@code <span class="lv-badge ...">},
 * an {@code <a href>}, the icon partial's inline {@code <svg>}, escaped text). Pure data: no
 * rendering or engine knowledge lives here.
 *
 * <p>Every variant carries the cell's {@link #text() display text} (the escaped string projection)
 * so the simplest template path, and any consumer that only wants the text, reads it uniformly
 * without switching on the type.
 */
public sealed interface Cell permits Cell.Text, Cell.Badge, Cell.Link, Cell.Icon {

    /**
     * @return the cell's display text: the {@link Column#cell(Object) string projection} of the
     *     value, to be HTML-escaped by the template. Never {@code null} (empty string for a missing
     *     value). For an {@link Icon} cell this is the optional adjacent label (may be empty).
     */
    String text();

    /**
     * A plain text cell: the default. The template renders {@link #text()} as escaped text.
     *
     * @param text the escaped display text (never null)
     */
    record Text(String text) implements Cell {}

    /**
     * A badge cell (the Filament {@code ->badge()}): the template renders {@link #text()} inside the
     * badge partial's {@code <span class="lv-badge lv-badge--<variant>">}. The {@link #variant()} is
     * the semantic colour/variant the
     * column's {@link BadgeColumn#color(java.util.function.Function) colour mapper} produced (for
     * example {@code "success"}, {@code "danger"}, {@code "green"}); empty for the neutral default.
     *
     * @param text the badge text (never null)
     * @param variant the badge variant/colour token, empty for the default neutral badge
     */
    record Badge(String text, String variant) implements Cell {}

    /**
     * A link cell (the Filament {@code ->url(...)}): the template renders {@link #text()} inside a
     * real {@code <a href>} pointing at {@link #href()}. When {@link #newTab()} is true the anchor
     * opens in a new tab ({@code target="_blank"} + {@code rel="noopener noreferrer"}).
     *
     * @param text the link text (never null)
     * @param href the link target URL (never null)
     * @param newTab whether the link opens in a new browser tab
     */
    record Link(String text, String href, boolean newTab) implements Cell {}

    /**
     * An icon cell (the Filament {@code IconColumn}): the template renders the named lievit icon,
     * optionally followed by adjacent {@link #text()}. The {@link #name()} is the icon name from the
     * column's {@link IconColumn#icon(java.util.function.Function) icon mapper}; {@link #color()} is
     * the optional semantic colour token from its colour mapper (empty for the default).
     *
     * @param name the icon name (never null; empty means render no icon)
     * @param text the optional adjacent label (never null; empty for an icon-only cell)
     * @param color the optional semantic colour token, empty for the default colour
     */
    record Icon(String name, String text, String color) implements Cell {}

    /**
     * A plain text cell.
     *
     * @param text the display text (a null value becomes the empty string)
     * @return a text cell
     */
    static Text text(@Nullable String text) {
        return new Text(text == null ? "" : text);
    }
}
