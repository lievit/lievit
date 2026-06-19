/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.wire;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import io.lievit.LievitComponent;
import io.lievit.LievitProperty;
import io.lievit.LievitRender;
import io.lievit.Wire;

/**
 * {@code rich-select}: the server-first WIRE replacement for the {@code <lv-rich-select>} Lit island
 * (ADR-0012). A searchable single-select whose options are filtered SERVER-SIDE: the query binds
 * {@code l:model.debounce} so a few hundred ms after the last keystroke the server re-filters the
 * option list and re-renders the listbox. There is no client-side filtering, no shipped options
 * array in the browser: this is the canonical htmx/wire typeahead (blueprint §1.b + ADR-0012's wire
 * optimization toolkit).
 *
 * <p>WHY server-state: the island held {@code options}, {@code value}, {@code query} and the open
 * state in Lit reactive properties and filtered in the browser; the selection rode a hidden mirror
 * input that the gest bug note records was NOT reliably form-associated. Here the selected value is
 * a {@code @Wire} string round-tripped in the signed snapshot, the query is a {@code @Wire} string
 * the debounced model binds, and the rendered options are a {@code serialize = false} view rebuilt
 * from {@link #allOptions} on every render: the selection cannot be lost and the filter cannot fail
 * silently in client code.
 *
 * <p>The full option catalog ({@link #allOptions}) is server-held authoritative data (a real adopter
 * seeds it from a repository in the constructor / a {@code @LievitRender} hook); it is
 * {@code serialize = false} so it never rides the snapshot. {@link #visibleOptions} is the
 * server-filtered subset the template renders, also derived (never serialized).
 *
 * <p>Selection uses the {@code $set} magic action ({@code l:click="$set('selected', '<value>')"}),
 * the same idiom the kit list page uses to arm a row: a regular {@code @LievitAction} cannot receive
 * the clicked value as an argument (regular-action args are not forwarded over the wire, runtime
 * note), so {@code $set} on the {@code selected} field is the canonical single-value select. Multi
 * select (a server-held value set toggled per option) needs a dedicated per-value action and is left
 * to the adopter; this component ships the single-select typeahead.
 *
 * <p>Copied in by {@code lievit add rich-select}: the adopter OWNS this class (seed {@link
 * #allOptions} from real data, add server-side authz on selection) AND the {@code rich-select.jte}
 * template.
 */
@LievitComponent(template = "lievit/rich-select")
public class RichSelectComponent {

    /** One selectable option. A plain record: server-side data, never serialized to the client. */
    public record Option(String value, String label, String description, boolean disabled) {
        /**
         * @param value the submit value
         * @param label the human label
         * @return an enabled option with no description
         */
        public static Option of(String value, String label) {
            return new Option(value, label, "", false);
        }
    }

    /** Form field name the selected value submits under (server-owned, locked). */
    @Wire
    @LievitProperty(locked = true)
    public String name = "";

    /** The live search query. Bound by {@code l:model.debounce} so typing re-filters server-side. */
    @Wire
    public String query = "";

    /** The selected option value, held server-side. Set via {@code $set('selected', '...')}. */
    @Wire
    public String selected = "";

    /** Placeholder shown on the trigger when nothing is selected. */
    @Wire
    public String placeholder = "Select...";

    /** Placeholder inside the search input. */
    @Wire
    public String searchPlaceholder = "Search...";

    /** Accessible label for the combobox + listbox. */
    @Wire
    public String label = "";

    /** Disables the control: no selection, dimmed. */
    @Wire
    @LievitProperty(locked = true)
    public boolean disabled = false;

    /**
     * The full, authoritative option catalog. Server-held, NOT serialized: a real adopter replaces
     * this seed with a repository read (constructor or {@code @LievitRender}). It never rides the
     * snapshot, so the browser never holds the catalog and cannot filter client-side.
     */
    @Wire
    @LievitProperty(serialize = false)
    public List<Option> allOptions =
            new ArrayList<>(
                    List.of(
                            Option.of("apple", "Apple"),
                            Option.of("banana", "Banana"),
                            Option.of("cherry", "Cherry")));

    /**
     * The server-filtered options the template renders. Derived from {@link #allOptions} + {@link
     * #query} on every render; NOT serialized (a complex record list cannot round-trip the generic
     * snapshot codec, and it is pure derived state anyway).
     */
    @Wire
    @LievitProperty(serialize = false)
    List<Option> visibleOptions = List.of();

    /**
     * Re-filters the visible options from the query on mount and before every re-render (the hook
     * the dispatcher invokes at mount and before each call's render). A {@code @LievitRender} (not
     * {@code @LievitMount}) because {@code visibleOptions} is {@code serialize = false} and so resets
     * on every stateless re-hydration: it must be rebuilt each render, exactly as the kit list page
     * rebuilds its view.
     */
    @LievitRender
    void render() {
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        if (q.isEmpty()) {
            this.visibleOptions = List.copyOf(allOptions);
            return;
        }
        List<Option> matched = new ArrayList<>();
        for (Option o : allOptions) {
            if (o.label().toLowerCase(Locale.ROOT).contains(q)
                    || o.description().toLowerCase(Locale.ROOT).contains(q)) {
                matched.add(o);
            }
        }
        this.visibleOptions = List.copyOf(matched);
    }

    /**
     * The label of the currently selected option, or an empty string when nothing is selected. Read
     * by the template off the live instance to render the trigger text.
     *
     * @return the selected option's label, or empty when none is selected
     */
    public String selectedLabel() {
        for (Option o : allOptions) {
            if (o.value().equals(selected)) {
                return o.label();
            }
        }
        return "";
    }

    /**
     * The server-filtered options to render. Read by the template off the live instance ({@code
     * _instance}) because a complex record list is not serialized into the snapshot.
     *
     * @return the options matching the current query
     */
    public List<Option> visibleOptions() {
        return visibleOptions;
    }
}
