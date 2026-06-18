/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * A syntax-highlighted code field (the filament-forms {@code CodeEditor} carried over onto the
 * schema engine): a multi-line input that renders its bound string with highlighting for a chosen
 * language, for config/snippet fields. It binds a {@link String} state path and round-trips its
 * value verbatim (no cast); the language and the soft-wrap flag are client-side presentation the
 * island reads.
 *
 * <p>The language is a small closed vocabulary mirroring Filament's {@code Language} enum so the
 * island can pick the right highlighter without a free-form string slipping through.
 */
public final class CodeEditor extends SchemaField<String, CodeEditor> {

    /** A code-editor highlighting language (the filament {@code CodeEditor\Enums\Language}). */
    public enum Language {
        /** No highlighting (plain text). */
        PLAINTEXT,
        /** CSS. */
        CSS,
        /** HTML. */
        HTML,
        /** JavaScript. */
        JS,
        /** JSON. */
        JSON,
        /** PHP. */
        PHP,
        /** YAML. */
        YAML,
        /** SQL. */
        SQL,
        /** XML. */
        XML
    }

    private Language language = Language.PLAINTEXT;
    private boolean softWraps;

    private CodeEditor(String name) {
        super(name);
    }

    /**
     * @param name the field name and state path
     * @return a new code editor
     */
    public static CodeEditor make(String name) {
        return new CodeEditor(name);
    }

    /**
     * Sets the highlighting language.
     *
     * @param language the language
     * @return this field
     */
    public CodeEditor language(Language language) {
        this.language = Objects.requireNonNull(language, "language");
        return this;
    }

    /**
     * @return the highlighting language (default {@link Language#PLAINTEXT})
     */
    public Language language() {
        return language;
    }

    /**
     * Soft-wraps long lines rather than scrolling horizontally.
     *
     * @return this field
     */
    public CodeEditor softWraps() {
        this.softWraps = true;
        return this;
    }

    /**
     * @return {@code true} if long lines soft-wrap
     */
    public boolean hasSoftWraps() {
        return softWraps;
    }

    /**
     * Reads the bound code string out of the schema state verbatim.
     *
     * @param state the live schema state
     * @return the bound code, or {@code null}
     */
    @Override
    public @Nullable String read(SchemaState state) {
        @Nullable Object raw = statePath() == null ? null : state.get(statePath());
        return raw == null ? null : raw.toString();
    }
}
