/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema.infolist;

import dev.lievit.kit.support.EvaluationContext;

/**
 * A member of an {@link Infolist} schema: either a concrete {@link Entry} (a leaf that shows one
 * record attribute) or a layout container ({@link InfolistSection}, {@link InfolistTabs},
 * {@link InfolistFieldset}, {@link InfolistGrid}). This is the View-page counterpart of the
 * filament-schemas {@code Component} sealed hierarchy: it lets an infolist nest layout the way a
 * form nests {@code Section} / {@code Tabs} / {@code Fieldset} / {@code Grid}, instead of accepting
 * a flat list of entries only.
 *
 * <p>The sealed permit set is the closed set of node kinds a renderer must paint; resolving a
 * component against a record yields a {@link ResolvedNode} subtree (the structured read the JTE
 * template iterates). A layout never holds state, never dehydrates, and is never validated, exactly
 * like its entries.
 */
public sealed interface InfolistComponent
        permits Entry, InfolistSection, InfolistTabs, InfolistFieldset, InfolistGrid {

    /**
     * Resolves this component (and its subtree) against a record's live context into the structured
     * {@link ResolvedNode} the renderer paints. A hidden component resolves to {@code null} (the
     * renderer skips it), so visibility is honoured uniformly across leaves and containers.
     *
     * @param context the live evaluation context (its {@code get} reads the record's attributes)
     * @return the resolved subtree, or {@code null} when this component is hidden
     */
    ResolvedNode resolveNode(EvaluationContext context);

    /**
     * @return {@code true} when this component renders (a layout is always visible; an {@link Entry}
     *     honours its {@code visible(..)} flag)
     */
    default boolean isVisibleComponent() {
        return true;
    }
}
