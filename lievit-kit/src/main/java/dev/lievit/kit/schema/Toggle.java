/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema;

import org.jspecify.annotations.Nullable;

import dev.lievit.kit.Color;

/**
 * A boolean toggle switch (the filament-forms {@code Toggle} carried over). Like a {@link Checkbox}
 * it binds a {@link Boolean} through the boolean {@link StateCast} (so the wire's
 * {@code "true"}/{@code "false"} round-trips to a real boolean), but it renders as an on/off switch
 * and adds the switch-specific affordances Filament's Toggle has and Checkbox does not: a distinct
 * on/off icon and on/off color, and the {@code accepted()}/{@code declined()} validation that gates
 * a "must be on" / "must be off" requirement (a consent toggle).
 *
 * <p>This closes the audit's {@code Toggle} row: the segmented {@link ToggleButtons} is a
 * multi-choice control, not the single boolean Toggle field this provides.
 */
public final class Toggle extends SchemaField<Boolean, Toggle> {

    private @Nullable String onIcon;
    private @Nullable String offIcon;
    private @Nullable Color onColor;
    private @Nullable Color offColor;
    private boolean inline;

    private Toggle(String name) {
        super(name);
        cast(StateCasts.bool());
        defaultValue(false);
    }

    /**
     * @param name the field name and state path
     * @return a new toggle bound to a boolean
     */
    public static Toggle make(String name) {
        return new Toggle(name);
    }

    /**
     * Sets the icon shown when the toggle is on (the filament {@code onIcon}).
     *
     * @param onIcon the icon name/alias
     * @return this field
     */
    public Toggle onIcon(String onIcon) {
        this.onIcon = java.util.Objects.requireNonNull(onIcon, "onIcon");
        return this;
    }

    /**
     * @return the on-state icon name/alias, or {@code null}
     */
    public @Nullable String onIcon() {
        return onIcon;
    }

    /**
     * Sets the icon shown when the toggle is off (the filament {@code offIcon}).
     *
     * @param offIcon the icon name/alias
     * @return this field
     */
    public Toggle offIcon(String offIcon) {
        this.offIcon = java.util.Objects.requireNonNull(offIcon, "offIcon");
        return this;
    }

    /**
     * @return the off-state icon name/alias, or {@code null}
     */
    public @Nullable String offIcon() {
        return offIcon;
    }

    /**
     * Sets the color of the toggle when on (the filament {@code onColor}).
     *
     * @param onColor the semantic color
     * @return this field
     */
    public Toggle onColor(Color onColor) {
        this.onColor = java.util.Objects.requireNonNull(onColor, "onColor");
        return this;
    }

    /**
     * @return the on-state color, or {@code null} for the default
     */
    public @Nullable Color onColor() {
        return onColor;
    }

    /**
     * Sets the color of the toggle when off (the filament {@code offColor}).
     *
     * @param offColor the semantic color
     * @return this field
     */
    public Toggle offColor(Color offColor) {
        this.offColor = java.util.Objects.requireNonNull(offColor, "offColor");
        return this;
    }

    /**
     * @return the off-state color, or {@code null} for the default
     */
    public @Nullable Color offColor() {
        return offColor;
    }

    /**
     * Lays the toggle inline with its label (the filament {@code inline}), rather than stacked.
     *
     * @return this field
     */
    public Toggle inline() {
        this.inline = true;
        return this;
    }

    /**
     * @return {@code true} if the toggle lays out inline with its label
     */
    public boolean isInline() {
        return inline;
    }

    /**
     * Requires the toggle to be on to pass validation (the filament {@code accepted}): the consent
     * gate, a "you must accept" switch.
     *
     * @return this field
     */
    public Toggle accepted() {
        rule(Rules.accepted());
        return this;
    }

    /**
     * Requires the toggle to be off to pass validation (the filament {@code declined}).
     *
     * @return this field
     */
    public Toggle declined() {
        rule(Rules.declined());
        return this;
    }
}
