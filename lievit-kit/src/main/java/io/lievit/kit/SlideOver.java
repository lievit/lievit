/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.schema.infolist.Infolist;

/**
 * A right-anchored slide-over panel hosting an {@link Infolist} over one record (the Filament
 * slide-over parity, roadmap K2): the "view in panel" outcome, the in-context detail surface the
 * calendar / table opens beside the list instead of navigating away to the full
 * {@link AdminViewView} page.
 *
 * <p>Distinct from {@link ConfirmationModal} (a centred yes/no modal): a SlideOver is an
 * edge-anchored sheet that carries arbitrary read content, here the resolved infolist. It is built
 * <strong>on the existing {@code drawer} wire</strong> (right side): this value object is the
 * resolved CONTENT the drawer's owned body region renders, the open/close/focus-trap mechanics stay
 * the drawer's. {@link #over} resolves the infolist once under
 * {@link io.lievit.kit.support.EvaluationContext.Operation#VIEW VIEW} (the silent-slot lesson: the
 * panel paints already-projected values, never re-runs a closure).
 *
 * @param heading the panel title (wired to the drawer's {@code aria-labelledby})
 * @param entries the resolved label-to-display map of the hosted infolist (placeholder applied)
 * @param columns the column count the entries lay out in (at least 1)
 */
public record SlideOver(String heading, Map<String, String> entries, int columns) {

    /** Compact constructor: defends the heading + the entry map and the column floor. */
    public SlideOver {
        Objects.requireNonNull(heading, "heading");
        entries = new LinkedHashMap<>(entries);
        if (columns < 1) {
            throw new IllegalArgumentException("columns must be at least 1");
        }
    }

    /**
     * Opens a slide-over showing a record's infolist: resolves the infolist against the record's
     * attributes under VIEW and captures the resolved entries + the infolist's column layout (the
     * kit "view in panel" API).
     *
     * @param heading the panel title
     * @param infolist the infolist to host
     * @param attributes the record's attributes keyed by path (the flattened record)
     * @return the resolved slide-over content
     */
    public static SlideOver over(
            String heading, Infolist infolist, Map<String, @Nullable Object> attributes) {
        Objects.requireNonNull(heading, "heading");
        Objects.requireNonNull(infolist, "infolist");
        Objects.requireNonNull(attributes, "attributes");
        return new SlideOver(heading, infolist.resolve(attributes), infolist.columns());
    }

    /** @return an unmodifiable view of the resolved entries (insertion order preserved) */
    public Map<String, String> entries() {
        return java.util.Collections.unmodifiableMap(entries);
    }

    /** @return whether the hosted infolist resolved to any entry */
    public boolean hasEntries() {
        return !entries.isEmpty();
    }
}
