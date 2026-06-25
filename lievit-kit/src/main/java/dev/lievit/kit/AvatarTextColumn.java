/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.Objects;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

/**
 * A column that renders the cell as an "avatar chip": one small avatar (image, or initials fallback)
 * paired with the cell text on the same line. The classic use is an owner / assignee column showing
 * the person's avatar beside their name (the mock's Assegnatario column).
 *
 * <p>Domain-agnostic: the adopter supplies the value→text projection (the label) and optional
 * value→image-URL and value→colour-slug mappers; this column carries no business meaning. A declared
 * {@link #url(java.util.function.Function) url mapper} still wraps the cell as a {@link Cell.Link}.
 *
 * @param <T> the row type
 */
public final class AvatarTextColumn<T> extends Column<T> {

    private @Nullable Function<Object, @Nullable String> imageMapper;
    private @Nullable Function<Object, @Nullable String> initialsMapper;
    private @Nullable Function<Object, @Nullable String> colorMapper;

    /**
     * @param label the column header
     * @param extractor extracts the raw value from a row (its string projection is the avatar label)
     * @param <T> the row type
     * @return a new avatar-text column
     */
    public static <T> AvatarTextColumn<T> make(String label, Function<? super T, ?> extractor) {
        return new AvatarTextColumn<>(label, extractor);
    }

    private AvatarTextColumn(String label, Function<? super T, ?> extractor) {
        super(label, extractor);
    }

    /**
     * Maps the raw cell value to an avatar image URL; null/blank falls back to initials.
     *
     * @param mapper the value→image-URL function
     * @return this column
     */
    public AvatarTextColumn<T> image(Function<Object, @Nullable String> mapper) {
        this.imageMapper = Objects.requireNonNull(mapper, "mapper");
        return this;
    }

    /**
     * Maps the raw cell value to explicit initials; null derives them from the label.
     *
     * @param mapper the value→initials function
     * @return this column
     */
    public AvatarTextColumn<T> initials(Function<Object, @Nullable String> mapper) {
        this.initialsMapper = Objects.requireNonNull(mapper, "mapper");
        return this;
    }

    /**
     * Maps the raw cell value to an avatar background intent slug (e.g. {@code "primary"}); null
     * auto-hashes from the label.
     *
     * @param mapper the value→colour function
     * @return this column
     */
    public AvatarTextColumn<T> color(Function<Object, @Nullable String> mapper) {
        this.colorMapper = Objects.requireNonNull(mapper, "mapper");
        return this;
    }

    private @Nullable String apply(@Nullable Function<Object, @Nullable String> mapper, T row) {
        return mapper == null ? null : mapper.apply(rawValue(row));
    }

    /**
     * Renders a {@link Cell.AvatarText} carrying the cell text as the label plus the resolved image /
     * initials / colour. A declared {@link #url(java.util.function.Function) url mapper} still wraps
     * it as a {@link Cell.Link}.
     */
    @Override
    public Cell cellFor(T row) {
        return linkify(
                row,
                new Cell.AvatarText(
                        cell(row),
                        apply(imageMapper, row),
                        apply(initialsMapper, row),
                        apply(colorMapper, row)));
    }
}
