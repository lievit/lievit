/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.wire;

import java.util.ArrayList;
import java.util.List;

import dev.lievit.LievitAction;
import dev.lievit.LievitComponent;
import dev.lievit.LievitProperty;
import dev.lievit.LievitRender;
import dev.lievit.Wire;

/**
 * {@code toggle-group}: the server-first WIRE replacement for the {@code <lv-toggle-group>} Lit
 * island (ADR-0012, Wave 2). A set of toggle buttons with single- or multiple-selection; the
 * selected value(s) live here in typed Java, not in client memory, and the server re-renders on each
 * change (the client morphs the result). The island already rendered its own {@code <button>}s (it
 * never wrapped a {@code <lv-toggle>}), so this conversion drops no nested component, only the Lit
 * runtime.
 *
 * <p>WHY server-state: the island held the selected set in a Lit reactive {@code Set}. Here
 * {@link #selected} is a {@code @Wire} list round-tripped in the signed snapshot: the pressed state
 * of every button is decided server-side, so it cannot drift from a client that fails to re-render.
 *
 * <p>Convention (blueprint 1.b): state is {@code @Wire public} fields; the toggle is a
 * {@code @LievitAction}; the a11y (Radix ToggleGroup, the same source the island cited) lives in the
 * template. Because a regular {@code @LievitAction} takes no forwarded arguments (only the magic
 * {@code $set}/{@code $toggle} parse inline args, runtime parity gap), the clicked value is ARMED
 * into {@link #toggleValue} via {@code l:click="$set('toggleValue','<value>')"} (the canonical
 * {@code wire:click="$set(...)"} idiom this repo already uses in {@code listing-list.jte});
 * {@link #applyToggle()} then flips that value in the selected set on the pre-render hook and clears
 * the arm, so the whole interaction is one click, fully server-side, and idempotent under replay.
 * The same logic is reachable as the explicit {@link #toggle()} action driven by a render-asserting
 * IT.
 *
 * <p>A11y modes (Radix): {@code "single"} renders the group as {@code role="radiogroup"} and each
 * item as {@code role="radio"} with {@code aria-checked} (at most one selected, deselect-to-empty
 * allowed, Radix behaviour); {@code "multiple"} renders {@code role="group"} and each item as a
 * toggle button with {@code aria-pressed} (any number selected). Roving focus is handled by the
 * markup (native buttons, Tab-reachable); the server owns the pressed/checked set.
 *
 * <p>The item values + labels are server config ({@code @LievitProperty(locked = true)}). Copied in
 * by {@code lievit add toggle-group}: the adopter OWNS this class AND {@code toggle-group.jte}.
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

    /**
     * Optional icon names, index-aligned with {@link #values} (an empty string = no icon for that
     * item). Composed via {@code @template.icon} in the template, the Lucide map the island used.
     * Locked alongside the item set.
     */
    @Wire
    @LievitProperty(locked = true)
    public List<String> icons = new ArrayList<>();

    /** Disabled item values: never toggle (server-enforced). Locked alongside the item set. */
    @Wire
    @LievitProperty(locked = true)
    public List<String> disabledValues = new ArrayList<>();

    /**
     * The selected value(s): the selection state, held server-side and round-tripped as a plain JSON
     * list. For {@code single} mode it holds at most one value.
     */
    @Wire
    public List<String> selected = new ArrayList<>();

    /**
     * {@code "single"} (at most one, radiogroup/aria-checked) or {@code "multiple"} (any number,
     * group/aria-pressed). Locked: the selection mode is server policy.
     */
    @Wire
    @LievitProperty(locked = true)
    public String mode = "single";

    /** Disables the whole group: every item is dimmed + no value toggles. Locked: server policy. */
    @Wire
    @LievitProperty(locked = true)
    public boolean disabled = false;

    /**
     * The value a click just armed (via the {@code $set} magic). Consumed + cleared by
     * {@link #applyToggle()} on the next render, so a click reduces to one server round-trip. Empty
     * when no toggle is pending; it never persists across a render.
     */
    @Wire
    public String toggleValue = "";

    /**
     * Flips the armed {@link #toggleValue} in the selected set on every pre-render (mount + each
     * re-render), then clears the arm. Empty / disabled / unknown arm = no-op, so a bare re-render
     * (or a snapshot replay carrying a cleared arm) never double-toggles: idempotent.
     */
    @LievitRender
    void applyToggle() {
        if (canToggle(toggleValue)) {
            flip(toggleValue);
        }
        toggleValue = "";
    }

    /**
     * Toggles the armed {@link #toggleValue} explicitly over the {@code @LievitAction} dispatch (same
     * effect as the {@code $set}-armed render path); provided so a caller / a render-asserting test
     * can drive the transition through the action dispatch with the target supplied as a field update
     * in the same wire call (updates apply before actions, ADR-0001). Clears the arm after.
     */
    @LievitAction
    public void toggle() {
        if (canToggle(toggleValue)) {
            flip(toggleValue);
        }
        toggleValue = "";
    }

    /** Whether a value is a real, enabled, currently-toggleable item (group not disabled). */
    private boolean canToggle(String value) {
        return !disabled
                && !value.isEmpty()
                && values.contains(value)
                && !disabledValues.contains(value);
    }

    /**
     * Adds the value to the selected set, or removes it if already selected; single mode keeps at
     * most one and allows deselect-to-empty (Radix behaviour).
     */
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
     * Whether an item is currently selected (read by the template for aria-checked / aria-pressed).
     *
     * @param value the item value
     * @return true when the value is in the selected set
     */
    public boolean isSelected(String value) {
        return selected.contains(value);
    }

    /**
     * Whether an item is disabled (its own disabled flag or the whole group disabled).
     *
     * @param value the item value
     * @return true when the item must not toggle
     */
    public boolean isDisabled(String value) {
        return disabled || disabledValues.contains(value);
    }

    /**
     * Whether the group is single-selection (radiogroup / aria-checked) vs multiple (group /
     * aria-pressed), read by the template to choose the ARIA roles.
     *
     * @return true for {@code single} mode
     */
    public boolean isSingle() {
        return "single".equals(mode);
    }
}
