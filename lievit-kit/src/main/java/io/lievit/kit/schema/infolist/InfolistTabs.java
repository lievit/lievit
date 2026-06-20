/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema.infolist;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.support.EvaluationContext;

/**
 * A tabbed infolist container (the filament-infolists {@code Tabs} layout carried over): an ordered
 * set of {@link InfolistTab}s with a configurable initially-active tab, query-string persistence,
 * horizontal-or-vertical orientation, and a contained (bordered card) flag. The View-page mirror of
 * the form {@link io.lievit.kit.schema.Tabs}.
 *
 * <p>Resolving the tabs resolves each tab's visible children, producing a
 * {@link ResolvedNode.TabsNode}. The active tab defaults to the first; {@link #activeTab(String)}
 * pins another by label (matched on its slug). {@link #persistTabInQueryString()} marks that the
 * active tab survives a reload in the URL (the rendered host wires the query param).
 */
public final class InfolistTabs implements InfolistComponent {

    private final List<InfolistTab> tabs = new ArrayList<>();
    private @Nullable String activeTabLabel;
    private boolean persistInQueryString;
    private boolean vertical;
    private boolean contained;

    private InfolistTabs() {}

    /**
     * @param toAdd the tabs in display order (at least one)
     * @return a new tabs container
     */
    public static InfolistTabs make(InfolistTab... toAdd) {
        InfolistTabs t = new InfolistTabs();
        for (InfolistTab tab : toAdd) {
            t.tabs.add(Objects.requireNonNull(tab, "tab"));
        }
        return t;
    }

    /**
     * Adds tabs in display order.
     *
     * @param toAdd the tabs
     * @return this tabs container
     */
    public InfolistTabs schema(InfolistTab... toAdd) {
        for (InfolistTab tab : toAdd) {
            tabs.add(Objects.requireNonNull(tab, "tab"));
        }
        return this;
    }

    /**
     * Pins the initially-active tab by label (the filament {@code activeTab()}); matched on the
     * tab's slug. An unknown label leaves the first tab active.
     *
     * @param label the label of the tab to open first
     * @return this tabs container
     */
    public InfolistTabs activeTab(String label) {
        this.activeTabLabel = Objects.requireNonNull(label, "label");
        return this;
    }

    /**
     * Marks the active tab to persist in the URL query string across reloads (the filament
     * {@code persistTabInQueryString()}).
     *
     * @return this tabs container
     */
    public InfolistTabs persistTabInQueryString() {
        this.persistInQueryString = true;
        return this;
    }

    /**
     * Renders the tab strip vertically (a sidebar) rather than horizontally (the filament
     * {@code vertical()}).
     *
     * @return this tabs container
     */
    public InfolistTabs vertical() {
        this.vertical = true;
        return this;
    }

    /**
     * Renders the tabs inside a bordered card (the filament {@code contained()}).
     *
     * @return this tabs container
     */
    public InfolistTabs contained() {
        this.contained = true;
        return this;
    }

    /** @return the tabs in display order (unmodifiable) */
    public List<InfolistTab> tabs() {
        return List.copyOf(tabs);
    }

    /** @return whether the active tab persists in the query string */
    public boolean persistsInQueryString() {
        return persistInQueryString;
    }

    /** @return whether the tab strip is vertical */
    public boolean isVertical() {
        return vertical;
    }

    /** @return whether the tabs render in a bordered card */
    public boolean isContained() {
        return contained;
    }

    /**
     * The id of the initially-active tab: the {@link #activeTab(String) pinned} tab's slug when it
     * matches a tab, otherwise the first tab's id.
     *
     * @return the active tab id
     */
    public String activeTabId() {
        if (activeTabLabel != null) {
            String wanted = InfolistTab.slug(activeTabLabel);
            for (InfolistTab tab : tabs) {
                if (tab.id().equals(wanted)) {
                    return tab.id();
                }
            }
        }
        return tabs.isEmpty() ? "" : tabs.get(0).id();
    }

    @Override
    public ResolvedNode resolveNode(EvaluationContext context) {
        if (tabs.isEmpty()) {
            throw new IllegalStateException("an InfolistTabs needs at least one tab");
        }
        List<ResolvedNode.TabNode> resolved = new ArrayList<>();
        for (InfolistTab tab : tabs) {
            resolved.add(tab.resolveTab(context));
        }
        return new ResolvedNode.TabsNode(
                resolved, activeTabId(), persistInQueryString, vertical, contained);
    }
}
