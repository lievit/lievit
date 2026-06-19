/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.wire;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import io.lievit.LievitComponent;
import io.lievit.LievitProperty;
import io.lievit.LievitRender;
import io.lievit.Wire;

/**
 * {@code command}: the server-first WIRE replacement for the {@code <lv-command>} Lit island
 * (ADR-0012). A searchable command palette whose items are filtered SERVER-SIDE: the query binds
 * {@code l:model.debounce} so typing re-queries the server (no per-keystroke round-trip and no
 * client filtering), and the server re-renders the grouped, filtered list. The chosen value is held
 * server-side in a {@code @Wire} field set via the {@code $set} magic action; an adopter reads it in
 * a {@code @LievitRender} hook (or a dedicated action) to act on the selection (navigate, run a
 * command, close the host dialog).
 *
 * <p>WHY server-state: the island held {@code items} + {@code query} + the active index in Lit
 * reactive state and filtered in the browser. Here the catalog ({@link #allItems}) is server-held,
 * {@code serialize = false} (never ships to the client), the query is a {@code @Wire} string the
 * debounced model binds, and the filtered, grouped view ({@link #groups}) is derived on every
 * render. The selection cannot be lost and the filter cannot fail silently in client code.
 *
 * <p>Composition with a dialog: the palette is commonly opened inside a modal (a command-dialog).
 * Compose it by rendering this component inside a dialog wire component's owned body region (the
 * dialog owns the open state, this owns the query + selection); if no dialog wire is present yet,
 * render the palette inline. Either way the body is OWNED server-rendered markup, never a slot.
 *
 * <p>Selection uses {@code l:click="$set('selected', '<value>')"} (regular-action args are not
 * forwarded over the wire, so {@code $set} is the canonical value-carrying click; same idiom as the
 * kit list page row-arm). Enter on the search box selects the active item; here the active item is
 * the first match, so {@code l:keydown.enter} can {@code $set} it (the adopter wires the exact key
 * behaviour to taste once copied).
 *
 * <p>Copied in by {@code lievit add command}: the adopter OWNS this class (seed {@link #allItems}
 * from real commands, react to {@link #selected} in a render hook) AND the {@code command.jte}
 * template.
 */
@LievitComponent(template = "lievit/command")
public class CommandComponent {

    /** A selectable command-palette item. Server-side data, never serialized to the client. */
    public record Item(
            String value, String label, String group, String icon, String shortcut, String keywords) {
        /**
         * @param value the command value
         * @param label the human label
         * @param group the group heading
         * @return an item with no icon/shortcut/keywords
         */
        public static Item of(String value, String label, String group) {
            return new Item(value, label, group, "", "", "");
        }
    }

    /** A group heading + its filtered items, for the template to render in first-seen order. */
    public record Group(String name, List<Item> items) {}

    /** The live search query. Bound by {@code l:model.debounce} so typing re-filters server-side. */
    @Wire
    public String query = "";

    /** The chosen command value, held server-side. Set via {@code $set('selected', '...')}. */
    @Wire
    public String selected = "";

    /** Placeholder for the search box. */
    @Wire
    public String placeholder = "Type a command or search...";

    /** Text shown when nothing matches the query. */
    @Wire
    public String emptyText = "No results found.";

    /** Accessible label for the palette. */
    @Wire
    public String label = "Command palette";

    /**
     * The full, authoritative command catalog. Server-held, NOT serialized: a real adopter seeds it
     * from the available commands. It never rides the snapshot, so the browser never holds it and
     * cannot filter client-side.
     */
    @Wire
    @LievitProperty(serialize = false)
    public List<Item> allItems =
            new ArrayList<>(
                    List.of(
                            Item.of("new", "New file", "File"),
                            Item.of("open", "Open folder", "File"),
                            Item.of("settings", "Settings", "Preferences")));

    /**
     * The server-filtered items grouped in first-seen group order. Derived from {@link #allItems} +
     * {@link #query} on every render; NOT serialized (complex records + pure derived state).
     */
    @Wire
    @LievitProperty(serialize = false)
    List<Group> groups = List.of();

    /**
     * Re-filters + re-groups the items from the query on mount and before every re-render (the
     * dispatcher hook at mount and before each call's render). A {@code @LievitRender} (not
     * {@code @LievitMount}) because the derived {@code groups} field is {@code serialize = false} and
     * resets on every stateless re-hydration, so it must be rebuilt each render.
     */
    @LievitRender
    void render() {
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        Map<String, List<Item>> byGroup = new LinkedHashMap<>();
        for (Item it : allItems) {
            if (!q.isEmpty()) {
                String haystack =
                        (it.label() + " " + it.keywords() + " " + it.group()).toLowerCase(Locale.ROOT);
                if (!haystack.contains(q)) {
                    continue;
                }
            }
            byGroup.computeIfAbsent(it.group(), g -> new ArrayList<>()).add(it);
        }
        List<Group> built = new ArrayList<>();
        for (Map.Entry<String, List<Item>> e : byGroup.entrySet()) {
            built.add(new Group(e.getKey(), List.copyOf(e.getValue())));
        }
        this.groups = List.copyOf(built);
    }

    /**
     * The server-filtered, grouped items to render. Read by the template off the live instance
     * ({@code _instance}) because complex records are not serialized into the snapshot.
     *
     * @return the groups matching the current query
     */
    public List<Group> groups() {
        return groups;
    }

    /**
     * Whether the current query matched no items (drives the empty-state render).
     *
     * @return true when no group has any item
     */
    public boolean isEmpty() {
        return groups.isEmpty();
    }
}
