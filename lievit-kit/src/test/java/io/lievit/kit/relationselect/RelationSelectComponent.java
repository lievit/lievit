/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.relationselect;

import java.util.ArrayList;
import java.util.List;

import io.lievit.LievitComponent;
import io.lievit.LievitProperty;
import io.lievit.LievitRender;
import io.lievit.Wire;
import io.lievit.kit.BelongsToField;

/**
 * The K5 wiring made concrete: the lievit-ui rich-select Combobox (L1) <strong>sourced from a kit
 * {@link BelongsToField}</strong>, the adopter pattern the rich-select's own docs prescribe ("seed
 * {@code allOptions} in a {@code @LievitRender} hook; narrow server-side per keystroke for large
 * sets"). It does not modify the published combobox: it is the owned copy wired to the kit's
 * searchable relation field.
 *
 * <p>Same server-first wire idiom as the published rich-select (single {@link #selected}, multiple
 * {@link #selectedValues} toggled via the armed {@code $set('toggleValue', ...)}, the search
 * {@link #query} bound by {@code l:model.debounce}, repeated hidden inputs for the multi-relation),
 * but the option catalog is NOT a hardcoded seed: {@link #sourceOptions()} reads the field on
 * <em>every render</em>, so the catalog survives the debounced query round-trips:
 *
 * <ul>
 *   <li><b>preload</b> ({@link #preload} true): the full catalog via
 *       {@link BelongsToField#preloadOptions()} (the eager SMALL-set path);
 *   <li><b>lazy</b> ({@link #preload} false): {@link BelongsToField#searchOptions(String)} per
 *       keystroke, querying {@link io.lievit.kit.RecordRepository#search} with a {@code LIMIT} (the
 *       LARGE-set path: typing narrows through the backend, never loading all rows).
 * </ul>
 *
 * <p>The mode flags {@link #preload} / {@link #multiple} are locked {@code @Wire} props seeded at
 * mount (the parent / route is server-side; locked stops the client, not the owning server). The
 * field is set on the prototype bean by the test app (server-owned data source), so it is a plain
 * transient reference, never a {@code @Wire} field.
 */
@LievitComponent(template = "relationselect/relation-select")
public class RelationSelectComponent {

    /** The kit relation field this combobox is wired to (server-owned; set on the prototype bean). */
    private BelongsToField<?> field;

    /** Form field name the selected value(s) submit under (server-owned, locked). */
    @Wire
    @LievitProperty(locked = true)
    public String name = "";

    /** The live search query, bound by {@code l:model.debounce}: typing re-sources server-side. */
    @Wire
    public String query = "";

    /** The selected option value in SINGLE mode. */
    @Wire
    public String selected = "";

    /** The selected option values in MULTIPLE mode. */
    @Wire
    public List<String> selectedValues = new ArrayList<>();

    /** Multiple-selection mode (locked: server policy, seeded at mount). */
    @Wire
    @LievitProperty(locked = true)
    public boolean multiple = false;

    /** Preload mode: full catalog on mount (small set) vs lazy per-query search (locked, seeded). */
    @Wire
    @LievitProperty(locked = true)
    public boolean preload = false;

    /** The value a click armed, consumed + cleared each render (the {@code $set} magic idiom). */
    @Wire
    public String toggleValue = "";

    /** The options rendered this render: derived from the field, never serialized. */
    @Wire
    @LievitProperty(serialize = false)
    List<BelongsToField.ComboOption> visibleOptions = List.of();

    /**
     * Wires the kit relation field that supplies the options. The component's own {@link #preload}
     * flag (a locked prop) drives preload-vs-lazy at render, so one bean serves both modes.
     *
     * @param relationField the kit relation field
     */
    public void wire(BelongsToField<?> relationField) {
        this.field = relationField;
        this.name = relationField.name();
    }

    /**
     * Sources the options from the field on every render (preload = full catalog; lazy = the
     * per-query repository search) and applies the armed toggle, then re-derives the rendered set. A
     * {@code @LievitRender} so the catalog is re-sourced after the debounced query round-trip.
     */
    @LievitRender
    void applyWire() {
        applyToggle();
        this.visibleOptions = sourceOptions();
    }

    /** Reads the field: the full catalog under preload, else the lazy per-query search. */
    private List<BelongsToField.ComboOption> sourceOptions() {
        if (field == null) {
            return List.of();
        }
        return preload
                ? field.preloadOptions()
                : field.searchOptions(query == null ? "" : query);
    }

    /** Flips the armed toggle value in the selection (multiple) or sets it (single), then clears. */
    private void applyToggle() {
        String armed = toggleValue == null ? "" : toggleValue;
        if (!armed.isEmpty()) {
            if (multiple) {
                if (selectedValues.contains(armed)) {
                    selectedValues.remove(armed);
                } else {
                    selectedValues.add(armed);
                }
            } else {
                this.selected = armed;
            }
        }
        toggleValue = "";
    }

    /**
     * @param value an option value
     * @return whether it is the current single selection or a member of the multiple set
     */
    public boolean isChosen(String value) {
        return multiple ? selectedValues.contains(value) : selected.equals(value);
    }

    /**
     * @return the options to render (read off the live instance: a record list is not serialized)
     */
    public List<BelongsToField.ComboOption> visibleOptions() {
        return visibleOptions;
    }
}
