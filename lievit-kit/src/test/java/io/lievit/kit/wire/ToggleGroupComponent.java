/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.wire;

import java.util.ArrayList;
import java.util.List;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.LievitProperty;
import io.lievit.LievitRender;
import io.lievit.Wire;

/**
 * In-repo proof copy of the shipped {@code registry:wire} toggle-group component (ADR-0012, Wave 2).
 *
 * <p>This is the same source {@code lievit add toggle-group} copies from
 * {@code lievit-ui/registry/wire/toggle-group/ToggleGroupComponent.java}, vendored into the kit test
 * tree (package adjusted to {@code io.lievit.kit.wire}) so {@link ToggleGroupComponentIT} can drive
 * it through the REAL lievit runtime (codec + registry + dispatcher + JTE adapter) and assert both
 * the server-side selection transition and the rendered HTML.
 *
 * <p>Convention (blueprint 1.b): state in {@code @Wire public} fields, the toggle a
 * {@code @LievitAction} (the clicked value armed into {@link #toggleValue} via {@code $set}, since a
 * regular action takes no forwarded args), the Radix ToggleGroup a11y in the template.
 */
@LievitComponent(template = "lievit/toggle-group")
public class ToggleGroupComponent {

    /** Item values in render order. Locked: the item set is server config. Paired with {@link #labels}. */
    @Wire
    @LievitProperty(locked = true)
    public List<String> values = new ArrayList<>();

    /** Item labels, index-aligned with {@link #values}. Locked alongside the values. */
    @Wire
    @LievitProperty(locked = true)
    public List<String> labels = new ArrayList<>();

    /** Optional icon names, index-aligned with {@link #values} ('' = none). Locked. */
    @Wire
    @LievitProperty(locked = true)
    public List<String> icons = new ArrayList<>();

    /** Disabled item values: never toggle (server-enforced). Locked. */
    @Wire
    @LievitProperty(locked = true)
    public List<String> disabledValues = new ArrayList<>();

    /** The selected value(s): the selection state, held server-side, round-tripped as a JSON list. */
    @Wire
    public List<String> selected = new ArrayList<>();

    /** {@code "single"} (radiogroup/aria-checked) or {@code "multiple"} (group/aria-pressed). Locked. */
    @Wire
    @LievitProperty(locked = true)
    public String mode = "single";

    /** Disables the whole group. Locked: server policy. */
    @Wire
    @LievitProperty(locked = true)
    public boolean disabled = false;

    /** The value a click armed (via {@code $set}); consumed + cleared on render. Never persists. */
    @Wire
    public String toggleValue = "";

    /** Flips the armed value in the selected set on every pre-render, then clears the arm (idempotent). */
    @LievitRender
    void applyToggle() {
        if (canToggle(toggleValue)) {
            flip(toggleValue);
        }
        toggleValue = "";
    }

    /** Explicit toggle of the armed value over the {@code @LievitAction} dispatch; clears the arm. */
    @LievitAction
    public void toggle() {
        if (canToggle(toggleValue)) {
            flip(toggleValue);
        }
        toggleValue = "";
    }

    private boolean canToggle(String value) {
        return !disabled
                && !value.isEmpty()
                && values.contains(value)
                && !disabledValues.contains(value);
    }

    private void flip(String value) {
        if (selected.contains(value)) {
            selected.remove(value);
            return;
        }
        if ("single".equals(mode)) {
            selected.clear();
        }
        selected.add(value);
    }

    /**
     * @param value the item value
     * @return true when the value is in the selected set
     */
    public boolean isSelected(String value) {
        return selected.contains(value);
    }

    /**
     * @param value the item value
     * @return true when the item must not toggle (own flag or whole group disabled)
     */
    public boolean isDisabled(String value) {
        return disabled || disabledValues.contains(value);
    }

    /**
     * @return true for {@code single} mode (radiogroup / aria-checked)
     */
    public boolean isSingle() {
        return "single".equals(mode);
    }
}
