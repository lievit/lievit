/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

/**
 * A boolean toggle field: renders as a toggle switch (or {@code <input type="checkbox">})
 * for a {@code true}/{@code false} bound property.
 *
 * <p>The visible labels for the on/off states are optional; they default to empty strings,
 * leaving the rendering template free to substitute its own affordances (icons, colours).
 */
public final class ToggleField extends Field {

    private String onLabel = "";
    private String offLabel = "";

    /**
     * Creates a toggle field with an explicit label.
     *
     * @param name  the bound field name
     * @param label the display label
     * @return a new toggle field
     */
    public static ToggleField make(String name, String label) {
        return new ToggleField(name, label);
    }

    /**
     * Creates a toggle field with a humanized label.
     *
     * @param name the bound field name
     * @return a new toggle field
     */
    public static ToggleField make(String name) {
        return new ToggleField(name, Field.humanize(name));
    }

    private ToggleField(String name, String label) {
        super(name, label);
    }

    /**
     * Sets the label shown when the toggle is in the {@code true} (on) state.
     *
     * @param onLabel the on-state label text
     * @return this field
     */
    public ToggleField onLabel(String onLabel) {
        this.onLabel = java.util.Objects.requireNonNull(onLabel, "onLabel");
        return this;
    }

    /**
     * Sets the label shown when the toggle is in the {@code false} (off) state.
     *
     * @param offLabel the off-state label text
     * @return this field
     */
    public ToggleField offLabel(String offLabel) {
        this.offLabel = java.util.Objects.requireNonNull(offLabel, "offLabel");
        return this;
    }

    /**
     * @return the on-state label, empty string if none was set
     */
    public String onLabel() {
        return onLabel;
    }

    /**
     * @return the off-state label, empty string if none was set
     */
    public String offLabel() {
        return offLabel;
    }
}
