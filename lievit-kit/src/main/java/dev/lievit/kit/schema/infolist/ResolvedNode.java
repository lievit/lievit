/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema.infolist;

import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * The resolved render tree of an {@link Infolist} (the structured read a renderer paints). Resolving
 * an {@link InfolistComponent} against a record produces a {@code ResolvedNode} subtree where every
 * value is already projected (the silent-slot lesson: the template iterates already-resolved
 * strings, never re-runs a closure). The sealed permit set is the closed kinds a JTE template must
 * handle.
 *
 * <ul>
 *   <li>{@link Field} — a single label-to-display pair (a {@link TextEntry} / {@link IconEntry} /
 *       {@link ImageEntry} / {@link ColorEntry} leaf).
 *   <li>{@link KeyValue} — a {@link KeyValueEntry} resolved as an ordered key-value map (this is the
 *       path that finally reaches {@link KeyValueEntry#resolveMap}).
 *   <li>{@link SectionNode} — a titled {@link InfolistSection} carrying its child nodes + its layout
 *       flags (heading / description / icon / aside / collapsible / columns).
 *   <li>{@link TabsNode} — an {@link InfolistTabs} carrying its tabs + the active tab + persistence
 *       + orientation + contained flags.
 *   <li>{@link FieldsetNode} — an {@link InfolistFieldset} (a bordered, labelled group).
 *   <li>{@link GridNode} — an {@link InfolistGrid} (a bare columns container).
 * </ul>
 */
public sealed interface ResolvedNode
        permits ResolvedNode.Field,
                ResolvedNode.KeyValue,
                ResolvedNode.SectionNode,
                ResolvedNode.TabsNode,
                ResolvedNode.FieldsetNode,
                ResolvedNode.GridNode {

    /**
     * A single resolved entry: its label, its already-projected display string, the entry kind
     * ({@code "text"} / {@code "icon"} / {@code "image"} / {@code "color"}), and how many parent grid
     * columns it spans.
     *
     * @param label the display label
     * @param display the projected display string (placeholder already applied)
     * @param kind the entry kind tag the template branches on
     * @param columnSpan the number of parent columns the field spans (at least 1)
     */
    record Field(String label, String display, String kind, int columnSpan) implements ResolvedNode {

        /** Compact constructor: defends the fields and the span floor. */
        public Field {
            Objects.requireNonNull(label, "label");
            Objects.requireNonNull(display, "display");
            Objects.requireNonNull(kind, "kind");
            if (columnSpan < 1) {
                throw new IllegalArgumentException("columnSpan must be at least 1");
            }
        }
    }

    /**
     * A resolved key-value entry: its label, the ordered key-value map (the
     * {@link KeyValueEntry#resolveMap} output), and the two column headers.
     *
     * @param label the entry label
     * @param pairs the ordered resolved key-value pairs
     * @param keyLabel the key column header
     * @param valueLabel the value column header
     */
    record KeyValue(String label, Map<String, String> pairs, String keyLabel, String valueLabel)
            implements ResolvedNode {

        /** Compact constructor: copies the map (insertion order kept) and defends the headers. */
        public KeyValue {
            pairs = new java.util.LinkedHashMap<>(pairs);
            Objects.requireNonNull(label, "label");
            Objects.requireNonNull(keyLabel, "keyLabel");
            Objects.requireNonNull(valueLabel, "valueLabel");
        }

        /** @return an unmodifiable view of the resolved pairs (insertion order preserved) */
        public Map<String, String> pairs() {
            return java.util.Collections.unmodifiableMap(pairs);
        }

        /** @return whether the map resolved to any pair */
        public boolean hasPairs() {
            return !pairs.isEmpty();
        }
    }

    /**
     * A resolved section: its heading / description / icon, the layout flags, the column count its
     * children lay out in, and the resolved child nodes.
     *
     * @param heading the section heading, or {@code null} for an unnamed section
     * @param description the section description, or {@code null}
     * @param icon the section heading icon name, or {@code null}
     * @param aside whether the heading sits in a side column
     * @param collapsible whether the body can collapse client-side
     * @param collapsed whether the body starts collapsed
     * @param columns the column count the children lay out in (at least 1)
     * @param columnSpan the number of parent columns this section spans (at least 1)
     * @param children the resolved child nodes in declaration order
     */
    record SectionNode(
            @Nullable String heading,
            @Nullable String description,
            @Nullable String icon,
            boolean aside,
            boolean collapsible,
            boolean collapsed,
            int columns,
            int columnSpan,
            List<ResolvedNode> children)
            implements ResolvedNode {

        /** Compact constructor: defends the column floors and copies the child list. */
        public SectionNode {
            if (columns < 1) {
                throw new IllegalArgumentException("columns must be at least 1");
            }
            if (columnSpan < 1) {
                throw new IllegalArgumentException("columnSpan must be at least 1");
            }
            children = List.copyOf(children);
        }

        /** @return whether the section renders a heading */
        public boolean hasHeading() {
            return heading != null && !heading.isBlank();
        }
    }

    /**
     * A resolved tabs container: the resolved tabs, the active tab id, and the orientation /
     * persistence / contained flags.
     *
     * @param tabs the resolved tabs in declaration order (never empty)
     * @param activeTabId the id of the initially-active tab (the first, or the configured one)
     * @param persistInQueryString whether the active tab persists in the URL query string
     * @param vertical whether the tab strip is vertical (sidebar) rather than horizontal
     * @param contained whether the tabs render inside a bordered card
     */
    record TabsNode(
            List<TabNode> tabs,
            String activeTabId,
            boolean persistInQueryString,
            boolean vertical,
            boolean contained)
            implements ResolvedNode {

        /** Compact constructor: defends the (non-empty) tab list + the active id. */
        public TabsNode {
            tabs = List.copyOf(tabs);
            if (tabs.isEmpty()) {
                throw new IllegalArgumentException("a tabs node needs at least one tab");
            }
            Objects.requireNonNull(activeTabId, "activeTabId");
        }
    }

    /**
     * A resolved single tab: a stable id, its label, an optional icon, and its resolved child nodes.
     *
     * @param id the stable tab id (slug of the label) the active-tab state references
     * @param label the tab label
     * @param icon the tab icon name, or {@code null}
     * @param columns the column count the tab's children lay out in (at least 1)
     * @param children the resolved child nodes in declaration order
     */
    record TabNode(
            String id, String label, @Nullable String icon, int columns, List<ResolvedNode> children) {

        /** Compact constructor: defends the id + label and copies the child list. */
        public TabNode {
            Objects.requireNonNull(id, "id");
            Objects.requireNonNull(label, "label");
            if (columns < 1) {
                throw new IllegalArgumentException("columns must be at least 1");
            }
            children = List.copyOf(children);
        }
    }

    /**
     * A resolved fieldset: a labelled, bordered group of fields (the filament {@code Fieldset}).
     *
     * @param label the fieldset legend
     * @param columns the column count the children lay out in (at least 1)
     * @param columnSpan the number of parent columns this fieldset spans (at least 1)
     * @param children the resolved child nodes in declaration order
     */
    record FieldsetNode(String label, int columns, int columnSpan, List<ResolvedNode> children)
            implements ResolvedNode {

        /** Compact constructor: defends the label + column floors and copies the child list. */
        public FieldsetNode {
            Objects.requireNonNull(label, "label");
            if (columns < 1) {
                throw new IllegalArgumentException("columns must be at least 1");
            }
            if (columnSpan < 1) {
                throw new IllegalArgumentException("columnSpan must be at least 1");
            }
            children = List.copyOf(children);
        }
    }

    /**
     * A resolved grid: a bare columns container with no chrome (the filament {@code Grid}).
     *
     * @param columns the column count the children lay out in (at least 1)
     * @param columnSpan the number of parent columns this grid spans (at least 1)
     * @param children the resolved child nodes in declaration order
     */
    record GridNode(int columns, int columnSpan, List<ResolvedNode> children) implements ResolvedNode {

        /** Compact constructor: defends the column floors and copies the child list. */
        public GridNode {
            if (columns < 1) {
                throw new IllegalArgumentException("columns must be at least 1");
            }
            if (columnSpan < 1) {
                throw new IllegalArgumentException("columnSpan must be at least 1");
            }
            children = List.copyOf(children);
        }
    }
}
