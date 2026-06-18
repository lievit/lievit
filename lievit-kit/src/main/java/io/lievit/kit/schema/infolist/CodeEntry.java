/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema.infolist;

import org.jspecify.annotations.Nullable;

/**
 * A code-block infolist entry (the filament-infolists {@code CodeEntry} carried over): renders the
 * record's value as a syntax-highlighted code block in a chosen language, with optional copy and
 * line numbers. The kit carries the language/grammar marker; the actual highlighting is the
 * runtime's.
 */
public final class CodeEntry extends Entry<CodeEntry> {

    private @Nullable String language;
    private boolean copyable;
    private boolean lineNumbers;

    private CodeEntry(String name) {
        super(name);
    }

    /**
     * @param name the record attribute holding the code text
     * @return a new code entry
     */
    public static CodeEntry make(String name) {
        return new CodeEntry(name);
    }

    /**
     * Sets the highlighting language/grammar.
     *
     * @param language the language token ({@code "json"}, {@code "sql"}, {@code "java"})
     * @return this entry
     */
    public CodeEntry language(String language) {
        this.language = java.util.Objects.requireNonNull(language, "language");
        return this;
    }

    /**
     * @return the highlighting language, or {@code null} for plain text
     */
    public @Nullable String language() {
        return language;
    }

    /**
     * Adds a click-to-copy affordance.
     *
     * @return this entry
     */
    public CodeEntry copyable() {
        this.copyable = true;
        return this;
    }

    /**
     * @return {@code true} if the code is copyable
     */
    public boolean isCopyable() {
        return copyable;
    }

    /**
     * Shows line numbers in the gutter.
     *
     * @return this entry
     */
    public CodeEntry lineNumbers() {
        this.lineNumbers = true;
        return this;
    }

    /**
     * @return {@code true} if line numbers are shown
     */
    public boolean hasLineNumbers() {
        return lineNumbers;
    }
}
