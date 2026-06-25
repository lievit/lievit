/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.cluster;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Predicate;

import org.jspecify.annotations.Nullable;

import dev.lievit.kit.Icon;
import dev.lievit.kit.NavigationItem;
import dev.lievit.kit.Resource;
import dev.lievit.kit.WidgetPage;

/**
 * A cluster (the Filament {@code Cluster}): a labelled group of child resources/pages under one url
 * prefix, with a shared sub-navigation. It tidies a large admin ("Settings" → Users / Roles /
 * Permissions live at {@code /admin/settings/users}, ...) and surfaces a breadcrumb prefix + an
 * in-cluster nav.
 *
 * <p>It owns the three Filament cluster concerns: {@code prependClusterSlug} (a child's route is
 * prefixed with the cluster slug), {@code getSubNavigation} (the nav shown while inside the cluster),
 * and {@code canAccessClusteredComponents} (a cluster-level access gate that short-circuits before
 * any child authorization).
 */
public final class Cluster {

    private final String slug;
    private final String label;
    private final List<Resource<?>> resources = new ArrayList<>();
    private final List<WidgetPage> pages = new ArrayList<>();

    private @Nullable Icon icon;
    private int navigationSort = Integer.MAX_VALUE;
    private Predicate<@Nullable Object> accessGate = principal -> true;

    private Cluster(String slug, String label) {
        this.slug = Objects.requireNonNull(slug, "slug");
        this.label = Objects.requireNonNull(label, "label");
    }

    /**
     * Builds a cluster.
     *
     * @param slug the url prefix segment (for example {@code "settings"})
     * @param label the human label (the nav group + breadcrumb prefix)
     * @return the cluster
     */
    public static Cluster create(String slug, String label) {
        return new Cluster(slug, label);
    }

    /**
     * Adds a child resource to the cluster (its routes are prefixed with the cluster slug).
     *
     * @param resource the child resource
     * @return this cluster
     */
    public Cluster resource(Resource<?> resource) {
        resources.add(Objects.requireNonNull(resource, "resource"));
        return this;
    }

    /**
     * Adds a child page to the cluster.
     *
     * @param page the child page
     * @return this cluster
     */
    public Cluster page(WidgetPage page) {
        pages.add(Objects.requireNonNull(page, "page"));
        return this;
    }

    /**
     * Sets the cluster's navigation icon.
     *
     * @param icon the icon
     * @return this cluster
     */
    public Cluster icon(Icon icon) {
        this.icon = Objects.requireNonNull(icon, "icon");
        return this;
    }

    /**
     * Sets the cluster's navigation sort key.
     *
     * @param sort the sort key
     * @return this cluster
     */
    public Cluster navigationSort(int sort) {
        this.navigationSort = sort;
        return this;
    }

    /**
     * Sets the cluster-level access gate (the Filament {@code canAccessClusteredComponents}): a
     * principal the gate rejects cannot reach any child, regardless of per-resource authorization.
     *
     * @param gate holds when the principal may access the cluster
     * @return this cluster
     */
    public Cluster accessGate(Predicate<@Nullable Object> gate) {
        this.accessGate = Objects.requireNonNull(gate, "gate");
        return this;
    }

    /** @return the url prefix segment */
    public String slug() {
        return slug;
    }

    /** @return the human label */
    public String label() {
        return label;
    }

    /** @return the cluster's navigation icon, or {@code null} */
    public @Nullable Icon icon() {
        return icon;
    }

    /** @return the cluster's navigation sort key */
    public int navigationSort() {
        return navigationSort;
    }

    /** @return the child resources, in registration order */
    public List<Resource<?>> resources() {
        return List.copyOf(resources);
    }

    /** @return the child pages, in registration order */
    public List<WidgetPage> pages() {
        return List.copyOf(pages);
    }

    /**
     * Whether a principal may access this cluster's components (the cluster-level gate).
     *
     * @param principal the authenticated principal, or {@code null}
     * @return {@code true} if the cluster is accessible
     */
    public boolean canAccessClusteredComponents(@Nullable Object principal) {
        return accessGate.test(principal);
    }

    /**
     * Prefixes a child slug with the cluster slug under a panel path (the Filament {@code
     * prependClusterSlug}): {@code /{panelPath}/{clusterSlug}/{childSlug}}.
     *
     * @param panelPath the panel route prefix
     * @param childSlug the child resource/page slug
     * @return the clustered route
     */
    public String prependClusterSlug(String panelPath, String childSlug) {
        return "/" + panelPath + "/" + slug + "/" + childSlug;
    }

    /**
     * Builds the in-cluster sub-navigation (the Filament {@code getSubNavigation}): one item per
     * child resource and page, each at its clustered route, under the panel path.
     *
     * @param panelPath the panel route prefix
     * @return the sub-navigation items, resources first then pages, in registration order
     */
    public List<NavigationItem> subNavigation(String panelPath) {
        List<NavigationItem> items = new ArrayList<>();
        for (Resource<?> resource : resources) {
            items.add(
                    NavigationItem.make(
                            resource.label(), prependClusterSlug(panelPath, resource.slug())));
        }
        for (WidgetPage page : pages) {
            items.add(NavigationItem.make(page.label(), prependClusterSlug(panelPath, page.slug())));
        }
        return items;
    }
}
