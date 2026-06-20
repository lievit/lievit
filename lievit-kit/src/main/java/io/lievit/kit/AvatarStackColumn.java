/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

/**
 * A stacked-avatar column (the Filament {@code ImageColumn::stacked()->limit()->limitedRemainingText()}):
 * the cell's raw value is a collection of items (people, tags, owners), rendered as the first
 * {@link #limit(int) N} avatars overlapping/stacked, then a {@code "+K"} overflow badge when the list
 * exceeds N.
 *
 * <p>Each item maps to an {@link Avatar}: an image URL via the {@link #image(Function) image mapper}
 * (the {@code <img src>}), with a {@link #label(Function) label mapper} fallback for an initials/name
 * chip when no image is available (the empty-image avatar). The {@code "+K"} badge, and optionally the
 * row as a whole, can carry a link to the row's detail (the inherited {@link Column#url(Function) url
 * mapper}) and a hover title (the {@link #overflowTitle(Function) overflow-title mapper}, the Filament
 * {@code limitedRemainingText} tooltip).
 *
 * <p>Avatars are {@link #circular() circular} by default (the avatar shape); call
 * {@code circular(false)} for square thumbnails.
 *
 * @param <T> the row type
 */
public final class AvatarStackColumn<T> extends Column<T> {

    /**
     * One rendered avatar in the stack: an image URL (may be blank) and a label (initials/name) the
     * template falls back to when the image is blank. Pure data the JTE stamps as an {@code <img>} or
     * an initials chip.
     *
     * @param image the image source URL (never null; empty means render the label chip instead)
     * @param label the label / initials fallback (never null; empty for an image-only avatar)
     */
    public record Avatar(String image, String label) {

        /** Compact constructor: normalises nulls to empty strings. */
        public Avatar {
            image = image == null ? "" : image;
            label = label == null ? "" : label;
        }

        /** @return whether this avatar has an image (vs. rendering the {@link #label()} chip) */
        public boolean hasImage() {
            return !image.isBlank();
        }
    }

    private int limit = 3;
    private boolean circular = true;
    private int size = 32;
    private @Nullable Function<Object, @Nullable String> imageMapper;
    private @Nullable Function<Object, @Nullable String> labelMapper;
    private @Nullable Function<? super T, String> overflowTitle;

    /**
     * @param label the column header
     * @param extractor extracts the items (a {@link Collection}) from a row
     * @param <T> the row type
     * @return a new avatar-stack column
     */
    public static <T> AvatarStackColumn<T> make(String label, Function<? super T, ?> extractor) {
        return new AvatarStackColumn<>(label, extractor);
    }

    private AvatarStackColumn(String label, Function<? super T, ?> extractor) {
        super(label, extractor);
    }

    /**
     * Maps a stack item to its avatar image URL (the {@code <img src>}). A null/blank result leaves
     * the avatar imageless, so the {@link #label(Function) label} chip renders instead.
     *
     * @param mapper the item to image-URL function
     * @return this column
     */
    public AvatarStackColumn<T> image(Function<Object, @Nullable String> mapper) {
        this.imageMapper = Objects.requireNonNull(mapper, "mapper");
        return this;
    }

    /**
     * Maps a stack item to its label / initials (the avatar fallback when there is no image, the
     * Filament default-image-as-initials). Also used as the avatar's hover title.
     *
     * @param mapper the item to label function
     * @return this column
     */
    public AvatarStackColumn<T> label(Function<Object, @Nullable String> mapper) {
        this.labelMapper = Objects.requireNonNull(mapper, "mapper");
        return this;
    }

    /**
     * Sets how many avatars render before the {@code "+K"} overflow badge (the Filament
     * {@code ->limit()}). Defaults to 3.
     *
     * @param n the maximum number of avatars (at least 1)
     * @return this column
     */
    public AvatarStackColumn<T> limit(int n) {
        if (n < 1) {
            throw new IllegalArgumentException("limit must be >= 1, got: " + n);
        }
        this.limit = n;
        return this;
    }

    /**
     * Renders the avatars circular (the default) or square.
     *
     * @param value whether the avatars are circular
     * @return this column
     */
    public AvatarStackColumn<T> circular(boolean value) {
        this.circular = value;
        return this;
    }

    /**
     * Renders the avatars circular (convenience for {@code circular(true)}).
     *
     * @return this column
     */
    public AvatarStackColumn<T> circular() {
        return circular(true);
    }

    /**
     * Sets the rendered avatar size in pixels (square box; circular when {@link #circular()}).
     *
     * @param px the size in pixels (at least 1)
     * @return this column
     */
    public AvatarStackColumn<T> size(int px) {
        this.size = px < 1 ? 1 : px;
        return this;
    }

    /**
     * Sets a hover title for the {@code "+K"} overflow badge (the Filament {@code limitedRemainingText}
     * tooltip, e.g. the names of the hidden people). Receives the whole row.
     *
     * @param mapper the row to overflow-title function
     * @return this column
     */
    public AvatarStackColumn<T> overflowTitle(Function<? super T, String> mapper) {
        this.overflowTitle = Objects.requireNonNull(mapper, "mapper");
        return this;
    }

    /**
     * Links the stack (and its {@code "+K"} badge) to the URL derived from the row (the row's detail
     * page). Covariant override of {@link Column#url(Function)} so the avatar-stack fluent chain stays
     * typed regardless of call order.
     *
     * @param fn maps a row to its detail URL
     * @return this column
     */
    @Override
    public AvatarStackColumn<T> url(Function<? super T, String> fn) {
        super.url(fn);
        return this;
    }

    /** @return the configured render limit (avatars before the overflow badge) */
    public int limit() {
        return limit;
    }

    /** @return whether the avatars render circular */
    public boolean isCircular() {
        return circular;
    }

    /** @return the rendered avatar size in pixels */
    public int size() {
        return size;
    }

    /**
     * The full list of items behind a row's stack (the Filament collection): the raw value when it is
     * a {@link Collection}, else a single-element list of the value (or empty for null/blank).
     *
     * @param row the row
     * @return the items (never null)
     */
    public List<Object> itemsFor(T row) {
        Object raw = rawValue(row);
        if (raw == null) {
            return List.of();
        }
        if (raw instanceof Collection<?> c) {
            List<Object> out = new ArrayList<>();
            for (Object o : c) {
                if (o != null) {
                    out.add(o);
                }
            }
            return out;
        }
        String s = String.valueOf(raw);
        return s.isBlank() ? List.of() : List.of(raw);
    }

    /**
     * The avatars actually rendered for a row, honouring {@link #limit(int)}: the first {@code limit}
     * items mapped to {@link Avatar}s (image + label fallback), or all of them when the row fits.
     *
     * @param row the row
     * @return the visible avatars (never null)
     */
    public List<Avatar> visibleAvatarsFor(T row) {
        List<Object> items = itemsFor(row);
        int shown = Math.min(items.size(), limit);
        List<Avatar> avatars = new ArrayList<>(shown);
        for (int i = 0; i < shown; i++) {
            Object item = items.get(i);
            String img = imageMapper == null ? "" : nullToEmpty(imageMapper.apply(item));
            String lbl = labelMapper == null ? "" : nullToEmpty(labelMapper.apply(item));
            avatars.add(new Avatar(img, lbl));
        }
        return avatars;
    }

    /**
     * The overflow count for a row (the {@code K} in the {@code "+K"} badge): how many items the
     * limit hides. Zero when the row fits within the limit.
     *
     * @param row the row
     * @return the number of items beyond the limit (never negative)
     */
    public int overflowCountFor(T row) {
        return Math.max(0, itemsFor(row).size() - limit);
    }

    /**
     * @param row the row
     * @return whether the row overflows the limit (so the {@code "+K"} badge renders)
     */
    public boolean hasOverflowFor(T row) {
        return overflowCountFor(row) > 0;
    }

    /**
     * The detail URL the {@code "+K"} badge (and the stack) links to for a row, from the inherited
     * {@link Column#url(Function) url mapper}.
     *
     * @param row the row
     * @return the detail URL, or empty if this column is not linked
     */
    public java.util.Optional<String> overflowUrlFor(T row) {
        return urlFor(row);
    }

    /**
     * The hover title for the {@code "+K"} badge for a row (the {@code limitedRemainingText}), from
     * the {@link #overflowTitle(Function) overflow-title mapper}.
     *
     * @param row the row
     * @return the overflow title, or empty if none was declared (or it yields null/blank)
     */
    public java.util.Optional<String> overflowTitleFor(T row) {
        if (overflowTitle == null) {
            return java.util.Optional.empty();
        }
        String title = overflowTitle.apply(row);
        return title == null || title.isBlank()
                ? java.util.Optional.empty()
                : java.util.Optional.of(title);
    }

    /**
     * Renders a {@link Cell.AvatarStack} carrying the {@linkplain #visibleAvatarsFor(Object) visible
     * avatars}, the {@linkplain #overflowCountFor(Object) overflow count} (the {@code "+K"} badge),
     * the circular flag, and the overflow link + title. The flat comma-joined projection of the
     * visible avatars' labels is the no-CSS fallback. The url mapper here drives the overflow link,
     * NOT a whole-cell {@link Cell.Link} wrap (a stack is not a single anchor).
     */
    @Override
    public Cell cellFor(T row) {
        List<Avatar> visible = visibleAvatarsFor(row);
        String fallback =
                visible.stream()
                        .map(Avatar::label)
                        .filter(l -> !l.isBlank())
                        .reduce((a, b) -> a + ", " + b)
                        .orElse("");
        return new Cell.AvatarStack(
                visible,
                overflowCountFor(row),
                circular,
                overflowUrlFor(row).orElse(""),
                overflowTitleFor(row).orElse(""),
                fallback);
    }

    private static String nullToEmpty(@Nullable String s) {
        return s == null ? "" : s;
    }
}
