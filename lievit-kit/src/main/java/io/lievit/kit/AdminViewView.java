/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.schema.infolist.Infolist;

/**
 * The render view-model the kit derives from a {@link Resource}'s {@link Infolist} for the
 * <strong>View</strong> (detail) page (the Filament {@code ViewRecord}, full-page mode): the
 * heading, the record id, the resolved {@link Section}s (each an ordered label-to-display map plus
 * its column count), and the {@link HeaderAction}s the page renders in its toolbar. Pure data the
 * JTE detail template iterates; it carries no engine knowledge.
 *
 * <p>The resolution is bounded to a single record under {@link
 * io.lievit.kit.support.EvaluationContext.Operation#VIEW}: {@link #of} resolves the resource's
 * infolist against the loaded record's attributes once, so the template paints already-projected
 * strings and can never re-run a closure (the silent-slot lesson: the rendered values, not the
 * structure). A resource with a flat infolist (no {@code Section} schema, which the carried-over
 * {@link Infolist} does not model) yields a single unnamed section carrying every entry.
 *
 * @param heading the detail heading
 * @param recordId the id of the record being shown (drives the header-action URLs)
 * @param sections the resolved sections in display order (each: optional heading + label-to-display
 *     map + column count)
 * @param headerActions the toolbar actions (label + url + variant), in display order
 */
public record AdminViewView(
        String heading, String recordId, List<Section> sections, List<HeaderAction> headerActions) {

    /** Compact constructor: defends the lists. */
    public AdminViewView {
        Objects.requireNonNull(heading, "heading");
        Objects.requireNonNull(recordId, "recordId");
        sections = List.copyOf(sections);
        headerActions = List.copyOf(headerActions);
    }

    /**
     * One resolved section of the detail view: an optional heading and the ordered label-to-display
     * map of its entries, laid out in {@link #columns} columns. The carried-over {@link Infolist}
     * has no {@code Section} schema, so today every view is one unnamed section; the record is shaped
     * to carry a heading already so a sectioned infolist (when added) maps without a view-model
     * change.
     *
     * @param heading the section heading, or {@code null} for an unnamed (flat) section
     * @param entries the ordered label-to-display map (the placeholder already applied to empties)
     * @param columns the column count the entries lay out in (at least 1)
     */
    public record Section(@Nullable String heading, Map<String, String> entries, int columns) {

        /** Compact constructor: defends the entry map and the column floor. */
        public Section {
            entries = new LinkedHashMap<>(entries);
            if (columns < 1) {
                throw new IllegalArgumentException("columns must be at least 1");
            }
        }

        /** @return an unmodifiable view of the entries (insertion order preserved) */
        public Map<String, String> entries() {
            return java.util.Collections.unmodifiableMap(entries);
        }

        /** @return whether this section renders a heading */
        public boolean hasHeading() {
            return heading != null && !heading.isBlank();
        }
    }

    /**
     * One toolbar action of the detail view: a label, the URL it navigates to, and a variant tag so
     * the template styles a primary action apart from a secondary one. The View page's header
     * actions are navigations (Filament {@code ViewRecord} ships Edit + back by default); the richer
     * {@link AdminAction} placement work (K3) layers on top, this is the minimal data the template
     * needs to paint the toolbar.
     *
     * @param label the button label
     * @param url the URL the action navigates to
     * @param variant the visual variant ({@code "primary"} or {@code "secondary"})
     */
    public record HeaderAction(String label, String url, String variant) {

        /** Compact constructor: defends the required fields. */
        public HeaderAction {
            Objects.requireNonNull(label, "label");
            Objects.requireNonNull(url, "url");
            Objects.requireNonNull(variant, "variant");
        }

        /**
         * @param label the button label
         * @param url the URL the action navigates to
         * @return a primary navigation action
         */
        public static HeaderAction primary(String label, String url) {
            return new HeaderAction(label, url, "primary");
        }

        /**
         * @param label the button label
         * @param url the URL the action navigates to
         * @return a secondary navigation action
         */
        public static HeaderAction secondary(String label, String url) {
            return new HeaderAction(label, url, "secondary");
        }
    }

    /**
     * Builds the detail view-model by resolving the infolist against a single record's attributes.
     *
     * @param heading the detail heading
     * @param recordId the id of the record being shown
     * @param infolist the resource's infolist
     * @param attributes the record's attributes keyed by path (the flattened record)
     * @param headerActions the toolbar actions, in display order
     * @return the view-model
     */
    public static AdminViewView of(
            String heading,
            String recordId,
            Infolist infolist,
            Map<String, @Nullable Object> attributes,
            List<HeaderAction> headerActions) {
        Objects.requireNonNull(infolist, "infolist");
        Objects.requireNonNull(attributes, "attributes");
        Map<String, String> resolved = infolist.resolve(attributes);
        Section section = new Section(null, resolved, infolist.columns());
        return new AdminViewView(heading, recordId, List.of(section), headerActions);
    }

    /** @return the entries of the first section, the flat label-to-display map a simple template wants */
    public Map<String, String> entries() {
        Map<String, String> flat = new LinkedHashMap<>();
        for (Section section : sections) {
            flat.putAll(section.entries());
        }
        return java.util.Collections.unmodifiableMap(flat);
    }

    /** @return whether the view carries at least one toolbar action */
    public boolean hasHeaderActions() {
        return !headerActions.isEmpty();
    }
}
