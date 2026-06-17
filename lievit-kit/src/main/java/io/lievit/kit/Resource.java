/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Optional;

import org.jspecify.annotations.Nullable;

/**
 * The unit of work of the admin layer: one resource per domain entity, exposing a table view (the
 * list) and a form view (create / edit) over the row type {@code <T>} (the filament-internals.md
 * "Resource as the unit of work" carried over).
 *
 * <p>Two deliberate departures from Filament (filament-internals.md "What NOT to carry over"):
 *
 * <ol>
 *   <li><strong>Instance-based, not static.</strong> A resource is a Spring bean: it receives its
 *       {@link RecordRepository} by constructor injection and its {@code table()} /
 *       {@code form()} are instance methods. Statics are hard to test and do not compose with DI.
 *   <li><strong>Persistence-agnostic.</strong> The resource reads rows only through the injected
 *       {@link RecordRepository} port, never a {@code JdbcClient} or {@code JpaRepository}.
 * </ol>
 *
 * <p>A concrete resource overrides {@link #table()} and {@link #form()} to build its two views with
 * the fluent {@link Table} / {@link Form} DSL, and {@link #slug()} / {@link #label()} for
 * its navigation and routes.
 *
 * @param <T> the row type this resource manages
 */
public abstract class Resource<T> {

    private final RecordRepository<T> repository;

    /**
     * @param repository the persistence-agnostic data port, provided by the adopter
     */
    protected Resource(RecordRepository<T> repository) {
        this.repository = repository;
    }

    /**
     * @return the data port for this resource's rows
     */
    public final RecordRepository<T> repository() {
        return repository;
    }

    /**
     * The url slug and route base for this resource (for example {@code "listings"} -&gt;
     * {@code /admin/listings}).
     *
     * @return the slug
     */
    public abstract String slug();

    /**
     * The human label shown in navigation and headings.
     *
     * @return the label
     */
    public abstract String label();

    /**
     * Builds the table (list) view.
     *
     * @return the configured table builder
     */
    public abstract Table<T> table();

    /**
     * Builds the form (create / edit) view. Defaults to an empty form so a read-only,
     * list-only resource (the hello-admin skeleton) need not declare one.
     *
     * @return the configured form builder
     */
    public Form<T> form() {
        return Form.create();
    }

    /**
     * Declares the concrete {@code @LievitComponent} page classes that render this resource's
     * full-page CRUD pages, so the panel can mount each at its {@link AdminRoutes} URL ("declaring a
     * Resource yields the four pages"). Defaults to none: a resource that does not declare its pages
     * is configuration-only (its {@link #table()} / {@link #form()} can still be exercised
     * head-less, as the builder tests do).
     *
     * @return the page-class triple, or empty if this resource does not declare CRUD pages
     */
    public Optional<ResourcePages> pages() {
        return Optional.empty();
    }

    // ── Navigation derivation (the Filament HasNavigation seam) ──────────────────────────────────

    /**
     * Whether this resource contributes an entry to the panel navigation. Override to return
     * {@code false} for a resource reachable only by direct link (Filament's
     * {@code shouldRegisterNavigation}).
     *
     * @return {@code true} to register a navigation item (the default)
     */
    public boolean shouldRegisterNavigation() {
        return true;
    }

    /**
     * The navigation group label this resource's item belongs under, or {@code null} for a
     * top-level item.
     *
     * @return the group label, or {@code null}
     */
    public @Nullable String navigationGroup() {
        return null;
    }

    /**
     * The navigation icon for this resource's item, or {@code null} for none. Defaults to the
     * semantic {@code nav.resource} alias so the registry can theme it.
     *
     * @return the icon, or {@code null}
     */
    public @Nullable Icon navigationIcon() {
        return Icon.of("nav.resource");
    }

    /**
     * The sort key of this resource's navigation item (ascending). Defaults to last.
     *
     * @return the sort key
     */
    public int navigationSort() {
        return Integer.MAX_VALUE;
    }

    /**
     * The navigation badge text (for example a pending count), or {@code null} for none.
     *
     * @return the badge, or {@code null}
     */
    public @Nullable String navigationBadge() {
        return null;
    }

    /**
     * The navigation badge color (used only when {@link #navigationBadge()} is set).
     *
     * @return the badge color
     */
    public Color navigationBadgeColor() {
        return Color.PRIMARY;
    }

    /**
     * Derives this resource's {@link NavigationItem}, applying the overridable group / icon / sort /
     * badge slots above. The item's url is the resource's list route under the given panel path.
     *
     * @param panelPath the panel's route prefix (for example {@code "admin"})
     * @return the derived navigation item, or empty if {@link #shouldRegisterNavigation()} is false
     */
    public Optional<NavigationItem> navigationItem(String panelPath) {
        if (!shouldRegisterNavigation()) {
            return Optional.empty();
        }
        String url = "/" + panelPath + "/" + slug();
        NavigationItem item = NavigationItem.make(label(), url).sort(navigationSort());
        Icon icon = navigationIcon();
        if (icon != null) {
            item.icon(icon);
        }
        String group = navigationGroup();
        if (group != null) {
            item.group(group);
        }
        String badge = navigationBadge();
        if (badge != null) {
            item.badge(badge, navigationBadgeColor());
        }
        return Optional.of(item);
    }
}
