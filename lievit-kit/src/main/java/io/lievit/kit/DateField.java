/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import org.jspecify.annotations.Nullable;

/**
 * A date/datetime input field: renders as {@code <input type="date">} (or {@code datetime-local}
 * once a time component is added in a later slice).
 *
 * <p>The optional {@link #format(String)} pattern is a {@link java.time.format.DateTimeFormatter}
 * pattern string used when serialising the field's initial value for the HTML attribute. If none
 * is set, the template applies its own default formatting.
 */
public final class DateField extends Field {

    private @Nullable String pattern;

    /**
     * Creates a date field with an explicit label.
     *
     * @param name  the bound field name
     * @param label the display label
     * @return a new date field
     */
    public static DateField make(String name, String label) {
        return new DateField(name, label);
    }

    /**
     * Creates a date field with a humanized label.
     *
     * @param name the bound field name
     * @return a new date field
     */
    public static DateField make(String name) {
        return new DateField(name, Field.humanize(name));
    }

    private DateField(String name, String label) {
        super(name, label);
    }

    /**
     * Sets the {@link java.time.format.DateTimeFormatter} pattern used when serialising the field
     * value for the rendered HTML attribute.
     *
     * @param pattern a non-null formatter pattern (e.g. {@code "yyyy-MM-dd"})
     * @return this field
     */
    public DateField format(String pattern) {
        this.pattern = java.util.Objects.requireNonNull(pattern, "pattern");
        return this;
    }

    /**
     * @return the formatter pattern, or {@code null} if none was set
     */
    public @Nullable String pattern() {
        return pattern;
    }
}
