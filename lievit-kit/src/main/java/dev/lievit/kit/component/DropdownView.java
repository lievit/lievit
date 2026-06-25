/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.component;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * The dropdown view-model (the Filament {@code DropdownComponent} + dropdown item/header carried
 * over): a trigger that reveals an ordered list of {@link Item items}, with an optional header label.
 * Used by the user menu, action groups, and column dropdowns.
 */
public final class DropdownView {

    /** A dropdown item: a label, a target href, and whether it is the active item. */
    public record Item(String label, String href, boolean active) {

        /** Compact constructor: defends the fields. */
        public Item {
            Objects.requireNonNull(label, "label");
            Objects.requireNonNull(href, "href");
        }

        /**
         * @param label the item label
         * @param href the item target
         * @return a non-active item
         */
        public static Item of(String label, String href) {
            return new Item(label, href, false);
        }

        /**
         * @return a copy of this item marked active
         */
        public Item asActive() {
            return new Item(label, href, true);
        }
    }

    private @Nullable String header;
    private final List<Item> items = new ArrayList<>();

    private DropdownView() {}

    /**
     * @return a dropdown view
     */
    public static DropdownView make() {
        return new DropdownView();
    }

    /**
     * Sets the dropdown header label (the Filament dropdown header).
     *
     * @param label the header label
     * @return this view
     */
    public DropdownView header(String label) {
        this.header = Objects.requireNonNull(label, "label");
        return this;
    }

    /**
     * Adds an item.
     *
     * @param item the item
     * @return this view
     */
    public DropdownView item(Item item) {
        items.add(Objects.requireNonNull(item, "item"));
        return this;
    }

    /** @return the header label, or {@code null} if none */
    public @Nullable String header() {
        return header;
    }

    /** @return the items, in insertion order */
    public List<Item> items() {
        return List.copyOf(items);
    }
}
