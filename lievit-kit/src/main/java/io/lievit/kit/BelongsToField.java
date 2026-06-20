/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;

/**
 * A belongs-to relation field. In its v0.1 minimum it renders a {@code <select>} whose options are
 * loaded at render time from a related {@link RecordRepository} (a many-to-one relation). Roadmap K5
 * grows it into a server-first searchable <strong>Combobox</strong> (the lievit-ui rich-select, L1),
 * for the cases a plain {@code <select>} cannot serve: a relation over a large table.
 *
 * <p>Three rendering modes, chosen by the builder, all back-compatible (the default stays the plain
 * {@code <select>} so existing resources are untouched):
 *
 * <ul>
 *   <li><b>plain</b> (default): a {@code <select>} listing every option, loaded eagerly via
 *       {@link #options()}. Right for a fixed, small relation. This is the v0.1 behaviour.
 *   <li><b>searchable + preload</b> ({@link #searchable()} + {@link #preload()}): the Combobox UI
 *       seeded eagerly with the full catalog ({@link #options()} again, but rendered as a searchable
 *       listbox with the query narrowing it). The EAGER path for SMALL sets.
 *   <li><b>searchable + lazy</b> ({@link #searchable()} without {@link #preload()}): the Combobox UI
 *       whose options are fetched server-side per keystroke through {@link RecordRepository#search}
 *       with a {@code LIMIT}. The LAZY path for LARGE sets ({@code persone} / {@code immobili}); the
 *       catalog never loads all rows every render. {@link #searchLimit(int)} caps the page.
 * </ul>
 *
 * <p><b>multiple</b> ({@link #multiple()}) is orthogonal to the search mode: it turns the relation
 * into a multi-relationship whose Combobox submits the chosen ids as repeated values (the form binds
 * a list). It has no effect on the plain {@code <select>} mode (that stays single-valued).
 *
 * <p>The adopter supplies a {@link RecordRepository} for the related entity type {@code R}, an
 * extractor for the option's submitted value (usually the id) and one for its label; optionally a
 * {@code subtext} / {@code avatar} / {@code icon} extractor so an option carries the record's rich
 * label (the Combobox renders {@code [avatar] label / subtext}).
 *
 * <p>The field never references the Combobox component class: it exposes the option data
 * ({@link #preloadOptions()} / {@link #searchOptions(String)}) as kit-local {@link ComboOption}
 * records, and the form page wires whichever rich-select component the adopter copied in (seeding its
 * {@code name} / {@code multiple} / {@code preload} props + its option catalog). This keeps the kit a
 * library: it does not depend on a copied-in registry component.
 *
 * @param <R> the related entity type
 */
public final class BelongsToField<R> extends Field {

    /** The default lazy-search page size: how many rows {@link RecordRepository#search} returns. */
    public static final int DEFAULT_SEARCH_LIMIT = 50;

    private final RecordRepository<R> relatedRepo;
    private final Function<R, String> optionValue;
    private final Function<R, String> optionLabel;

    private boolean searchable;
    private boolean preload;
    private boolean multiple;
    private int searchLimit = DEFAULT_SEARCH_LIMIT;
    private Function<R, String> optionSubtext = r -> "";
    private Function<R, String> optionAvatar = r -> "";
    private Function<R, String> optionIcon = r -> "";

    /**
     * Creates a belongs-to field with an explicit label.
     *
     * @param name         the bound field name (holds the selected id)
     * @param label        the display label
     * @param relatedRepo  the repository that supplies the related records
     * @param optionValue  extracts the submitted option value (e.g. the id) from a related record
     * @param optionLabel  extracts the displayed option label from a related record
     * @param <R>          the related entity type
     * @return a new belongs-to field
     */
    public static <R> BelongsToField<R> make(
            String name,
            String label,
            RecordRepository<R> relatedRepo,
            Function<R, String> optionValue,
            Function<R, String> optionLabel) {
        return new BelongsToField<>(name, label, relatedRepo, optionValue, optionLabel);
    }

    /**
     * Creates a belongs-to field with a humanized label.
     *
     * @param name         the bound field name
     * @param relatedRepo  the repository that supplies the related records
     * @param optionValue  extracts the submitted option value from a related record
     * @param optionLabel  extracts the displayed option label from a related record
     * @param <R>          the related entity type
     * @return a new belongs-to field
     */
    public static <R> BelongsToField<R> make(
            String name,
            RecordRepository<R> relatedRepo,
            Function<R, String> optionValue,
            Function<R, String> optionLabel) {
        return new BelongsToField<>(name, Field.humanize(name), relatedRepo, optionValue, optionLabel);
    }

    private BelongsToField(
            String name,
            String label,
            RecordRepository<R> relatedRepo,
            Function<R, String> optionValue,
            Function<R, String> optionLabel) {
        super(name, label);
        this.relatedRepo = Objects.requireNonNull(relatedRepo, "relatedRepo");
        this.optionValue = Objects.requireNonNull(optionValue, "optionValue");
        this.optionLabel = Objects.requireNonNull(optionLabel, "optionLabel");
    }

    // ── builder ───────────────────────────────────────────────────────────────

    /**
     * Renders the relation as the server-first searchable Combobox instead of a plain
     * {@code <select>}. Without {@link #preload()} the options are fetched lazily per keystroke
     * through {@link RecordRepository#search} (the LARGE-set path).
     *
     * @return this field
     */
    public BelongsToField<R> searchable() {
        this.searchable = true;
        return this;
    }

    /**
     * Eagerly seeds the Combobox with the full catalog on mount (the SMALL-set path), instead of the
     * lazy per-keystroke search. Implies {@link #searchable()} (preload is a Combobox mode).
     *
     * @return this field
     */
    public BelongsToField<R> preload() {
        this.searchable = true;
        this.preload = true;
        return this;
    }

    /**
     * Turns the relation into a multi-relationship: the Combobox toggles membership and submits the
     * chosen ids as repeated values (the form binds a list). No effect on the plain {@code <select>}.
     *
     * @return this field
     */
    public BelongsToField<R> multiple() {
        this.multiple = true;
        return this;
    }

    /**
     * Caps the lazy-search page size: how many rows {@link RecordRepository#search} returns per query
     * (default {@link #DEFAULT_SEARCH_LIMIT}). Only meaningful in the lazy (non-preload) mode.
     *
     * @param limit the maximum option rows per search (clamped to {@code >= 1})
     * @return this field
     */
    public BelongsToField<R> searchLimit(int limit) {
        this.searchLimit = limit < 1 ? 1 : limit;
        return this;
    }

    /**
     * Sets a secondary line shown under each option label (the Combobox rich {@code subtext}).
     *
     * @param subtext extracts the subtext from a related record
     * @return this field
     */
    public BelongsToField<R> subtext(Function<R, String> subtext) {
        this.optionSubtext = Objects.requireNonNull(subtext, "subtext");
        return this;
    }

    /**
     * Sets a leading avatar image URL for each option (the Combobox rich {@code avatar}).
     *
     * @param avatar extracts the avatar image URL from a related record
     * @return this field
     */
    public BelongsToField<R> avatar(Function<R, String> avatar) {
        this.optionAvatar = Objects.requireNonNull(avatar, "avatar");
        return this;
    }

    /**
     * Sets a leading Lucide icon name for each option (the Combobox rich {@code icon}; ignored when
     * {@link #avatar(Function)} is also set, as the Combobox prefers the avatar).
     *
     * @param icon extracts the Lucide icon name from a related record
     * @return this field
     */
    public BelongsToField<R> icon(Function<R, String> icon) {
        this.optionIcon = Objects.requireNonNull(icon, "icon");
        return this;
    }

    // ── mode queries (read by the form page to wire the Combobox) ───────────────

    /** @return whether this field renders as the searchable Combobox (vs the plain {@code <select>}) */
    public boolean isSearchable() {
        return searchable;
    }

    /** @return whether the searchable Combobox preloads the full catalog (vs lazy server search) */
    public boolean isPreload() {
        return preload;
    }

    /** @return whether this is a multi-relationship (the Combobox submits repeated values) */
    public boolean isMultiple() {
        return multiple;
    }

    /** @return the lazy-search page size */
    public int searchLimitValue() {
        return searchLimit;
    }

    // ── option data ─────────────────────────────────────────────────────────────

    /**
     * Loads the current option list by calling {@code findAll()} on the related repository.
     *
     * <p>Called at render time, not at build time, so the options are always up to date. This is the
     * plain {@code <select>} and the preload-Combobox catalog.
     *
     * @return the related records in repository order
     */
    public List<R> options() {
        return relatedRepo.findAll();
    }

    /**
     * The full option catalog as Combobox options, for the EAGER (preload) mode: every related record
     * mapped to a {@link ComboOption}. Loaded via {@link #options()} at render time.
     *
     * @return all related records as Combobox options, in repository order
     */
    public List<ComboOption> preloadOptions() {
        List<ComboOption> out = new ArrayList<>();
        for (R related : options()) {
            out.add(toComboOption(related));
        }
        return List.copyOf(out);
    }

    /**
     * The Combobox options matching a search {@code term}, for the LAZY mode: queries
     * {@link RecordRepository#search} with this field's {@link #searchLimitValue() limit} and the
     * field's label extractor, then maps each row to a {@link ComboOption}. This is the
     * {@code getSearchResultsUsing} hook the K5 large-set path needs: typing narrows the catalog
     * server-side with a {@code LIMIT}, never loading all rows.
     *
     * @param term the search term typed into the Combobox (empty returns the bounded head)
     * @return up to {@link #searchLimitValue()} matching records as Combobox options
     */
    public List<ComboOption> searchOptions(String term) {
        List<ComboOption> out = new ArrayList<>();
        for (R related : relatedRepo.search(term, searchLimit, optionLabel)) {
            out.add(toComboOption(related));
        }
        return List.copyOf(out);
    }

    /**
     * Maps a related record to a Combobox option through this field's extractors.
     *
     * @param related a related record
     * @return its Combobox option (value + label + optional subtext / avatar / icon)
     */
    public ComboOption toComboOption(R related) {
        return new ComboOption(
                optionValue.apply(related),
                optionLabel.apply(related),
                optionSubtext.apply(related),
                optionAvatar.apply(related),
                optionIcon.apply(related));
    }

    /**
     * Extracts the submitted option value from a related record.
     *
     * @param related a record returned by {@link #options()}
     * @return the submitted value for that record (used as the {@code <option value="...">})
     */
    public String optionValueOf(R related) {
        return optionValue.apply(related);
    }

    /**
     * Extracts the displayed label from a related record.
     *
     * @param related a record returned by {@link #options()}
     * @return the label for that record (used as the {@code <option>} text content)
     */
    public String optionLabelOf(R related) {
        return optionLabel.apply(related);
    }

    /**
     * One relation option in the Combobox's shape, kit-local so the field does not depend on a
     * copied-in registry component: the form page maps this onto whichever rich-select component the
     * adopter wired in. {@code subtext} / {@code avatar} / {@code icon} are optional (empty string =
     * absent), mirroring the rich-select {@code Option}.
     *
     * @param value   the submitted option value (the related id)
     * @param label   the displayed option label
     * @param subtext the secondary line under the label (empty for none)
     * @param avatar  the leading avatar image URL (empty for none)
     * @param icon    the leading Lucide icon name (empty for none)
     */
    public record ComboOption(
            String value, String label, String subtext, String avatar, String icon) {
        /** Compact constructor: defends every field against null (empty = absent). */
        public ComboOption {
            value = value == null ? "" : value;
            label = label == null ? "" : label;
            subtext = subtext == null ? "" : subtext;
            avatar = avatar == null ? "" : avatar;
            icon = icon == null ? "" : icon;
        }
    }
}
