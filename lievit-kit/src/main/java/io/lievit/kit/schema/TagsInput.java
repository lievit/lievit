/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import java.util.List;

import org.jspecify.annotations.Nullable;

/**
 * A free-form tags input (the filament-forms {@code TagsInput} carried over): the user types tags
 * that accumulate as chips; the field binds a {@link List} of tag strings. Unlike
 * {@link CheckboxList} there is no fixed option set, the values are open. {@code suggestions} offer
 * an optional typeahead; {@code separator} sets the character that also commits a tag.
 */
public final class TagsInput extends SchemaField<List<String>, TagsInput> {

    private List<String> suggestions = List.of();
    private @Nullable String separator;

    private TagsInput(String name) {
        super(name);
        cast(CheckboxList.multiValueCast());
    }

    /**
     * @param name the field name and state path
     * @return a new tags input bound to a list of strings
     */
    public static TagsInput make(String name) {
        return new TagsInput(name);
    }

    /**
     * Offers a typeahead suggestion set (the values stay open; suggestions are a convenience).
     *
     * @param suggestions the suggested tags
     * @return this field
     */
    public TagsInput suggestions(List<String> suggestions) {
        this.suggestions = List.copyOf(suggestions);
        return this;
    }

    /**
     * @return the suggested tags (unmodifiable; empty for none)
     */
    public List<String> suggestions() {
        return suggestions;
    }

    /**
     * Sets a separator character that also commits the current tag (besides Enter).
     *
     * @param separator the separator (for example {@code ","})
     * @return this field
     */
    public TagsInput separator(String separator) {
        this.separator = java.util.Objects.requireNonNull(separator, "separator");
        return this;
    }

    /**
     * @return the separator, or {@code null} (Enter only)
     */
    public @Nullable String separator() {
        return separator;
    }
}
