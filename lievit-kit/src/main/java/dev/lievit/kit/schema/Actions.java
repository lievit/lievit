/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * A schema-embedded actions row (the filament-schemas {@code Actions} component): a non-input
 * component that renders a row of {@link SchemaAction} buttons inline in a form, for inline
 * "Generate" / "Verify" toolbars between fields. It binds no state path, contributes nothing to
 * validation, and is never dehydrated (a transparent passenger in the engine, like {@link Text} or
 * {@link Placeholder}); the buttons' closures mutate sibling fields when invoked.
 */
public final class Actions extends SchemaComponent<@Nullable Object, Actions> {

    /** Where the actions row aligns within its column. */
    public enum Alignment {
        /** Aligned to the start (default). */
        START,
        /** Centered. */
        CENTER,
        /** Aligned to the end. */
        END
    }

    private final List<SchemaAction> actions = new ArrayList<>();
    private Alignment alignment = Alignment.START;
    private boolean fullWidth;

    private Actions(List<SchemaAction> actions) {
        for (SchemaAction a : actions) {
            this.actions.add(Objects.requireNonNull(a, "action"));
        }
        dehydrated(false);
    }

    /**
     * @param actions the action buttons, in display order
     * @return a new actions row
     */
    public static Actions make(List<SchemaAction> actions) {
        return new Actions(actions);
    }

    /**
     * @param actions the action buttons, in display order
     * @return a new actions row
     */
    public static Actions make(SchemaAction... actions) {
        return new Actions(List.of(actions));
    }

    /**
     * @return the action buttons in display order (unmodifiable)
     */
    public List<SchemaAction> actions() {
        return List.copyOf(actions);
    }

    /**
     * Sets the horizontal alignment of the actions row.
     *
     * @param alignment the alignment
     * @return this component
     */
    public Actions alignment(Alignment alignment) {
        this.alignment = Objects.requireNonNull(alignment, "alignment");
        return this;
    }

    /**
     * @return the horizontal alignment (default {@link Alignment#START})
     */
    public Alignment alignment() {
        return alignment;
    }

    /**
     * Makes the buttons span the full available width.
     *
     * @return this component
     */
    public Actions fullWidth() {
        this.fullWidth = true;
        return this;
    }

    /**
     * @return {@code true} if the buttons span the full width
     */
    public boolean isFullWidth() {
        return fullWidth;
    }
}
