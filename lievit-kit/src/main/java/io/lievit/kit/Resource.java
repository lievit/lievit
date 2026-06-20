/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;

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
     * The table HEADER/toolbar actions (the Filament {@code getHeaderActions()}): resource-scoped
     * actions placed above the table rather than per-row or bulk, typically navigations ("New",
     * "Open calendar", "Export") declared as {@link UrlAction}s. Defaults to none.
     *
     * <p>These are the {@link ActionPlacement#HEADER} actions surfaced on the {@link AdminListView}
     * so the list template can stamp a toolbar; they take no record (the mapper sees {@code null}),
     * so a static-URL navigation or a query-scoped export is the natural shape.
     *
     * @return the header actions, in render order (empty by default)
     */
    public List<AdminAction<T>> headerActions() {
        return List.of();
    }

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

    // ── Detail (view) page derivation (the Filament HasInfolist / ViewRecord seam) ───────────────

    /**
     * Builds the read-only {@link io.lievit.kit.schema.infolist.Infolist Infolist} the resource's
     * View (detail) page renders over one record (the Filament {@code Resource::infolist}). Defaults
     * to none: a resource that does not declare an infolist has no detail page (its
     * {@link ResourcePages#view()} is {@code null}). Override to opt a resource into a detail view.
     *
     * @return the configured infolist, or empty if this resource has no detail page
     */
    public Optional<io.lievit.kit.schema.infolist.Infolist> infolist() {
        return Optional.empty();
    }

    /**
     * Flattens a record into the attribute map the {@link #infolist() infolist} resolves against (the
     * boundary where a domain object becomes the {@code Map<String, Object>} an entry reads by path,
     * mirroring Filament's Eloquent-attribute access). The default reflects a Java {@code record}'s
     * components (the common row type, e.g. the hello-admin {@code Listing}); a resource over a
     * non-record row, or one needing relation attributes, overrides this.
     *
     * @param record the loaded record
     * @return the record's attributes keyed by path, in component declaration order
     */
    public Map<String, @Nullable Object> recordAttributes(T record) {
        Objects.requireNonNull(record, "record");
        Map<String, @Nullable Object> attributes = new java.util.LinkedHashMap<>();
        Class<?> type = record.getClass();
        if (type.isRecord()) {
            for (java.lang.reflect.RecordComponent component : type.getRecordComponents()) {
                try {
                    java.lang.reflect.Method accessor = component.getAccessor();
                    // The accessor is public, but the declaring record may be a non-exported /
                    // nested type (e.g. a test fixture), so make it accessible before invoking.
                    accessor.setAccessible(true);
                    attributes.put(component.getName(), accessor.invoke(record));
                } catch (ReflectiveOperationException e) {
                    throw new IllegalStateException(
                            "cannot read record component " + component.getName(), e);
                }
            }
            return attributes;
        }
        throw new IllegalStateException(
                "Resource."
                        + slug()
                        + " declares an infolist over a non-record row ("
                        + type.getName()
                        + "); override recordAttributes(T) to flatten it");
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

    // ── Global search (the Filament HasGlobalSearch seam, issue #323) ────────────────────────────

    /**
     * Whether this resource participates in global search. A resource opts in by overriding this to
     * {@code true} and declaring {@link #globallySearchableAttributes()}.
     *
     * @return {@code true} to make this resource globally searchable (default {@code false})
     */
    public boolean isGloballySearchable() {
        return !globallySearchableAttributes().isEmpty();
    }

    /**
     * The attribute extractors a global-search query matches against (each maps a row to a
     * searchable string). Override to opt a resource into global search.
     *
     * @return the searchable attribute extractors (empty = not searchable)
     */
    public List<Function<? super T, String>> globallySearchableAttributes() {
        return List.of();
    }

    /**
     * Builds the global-search title for a matched row. Defaults to the row's {@code toString}.
     *
     * @param row the matched row
     * @return the result title
     */
    public String globalSearchResultTitle(T row) {
        return String.valueOf(row);
    }

    /**
     * Runs a global-search query against this resource: pages through the repository and returns a
     * result for every row whose searchable attributes contain the (case-insensitive) query. The url
     * of each result is the row's edit route under the panel path.
     *
     * @param query the search query
     * @param panelPath the panel route prefix
     * @return the matching results (empty if the resource is not searchable or nothing matches)
     */
    public List<GlobalSearchResult> globalSearch(String query, String panelPath) {
        List<Function<? super T, String>> attributes = globallySearchableAttributes();
        if (attributes.isEmpty() || query == null || query.isBlank()) {
            return List.of();
        }
        String needle = query.toLowerCase(Locale.ROOT);
        Table<T> table = table();
        List<GlobalSearchResult> results = new ArrayList<>();
        for (T row : repository.findAll()) {
            boolean matches =
                    attributes.stream()
                            .map(a -> a.apply(row))
                            .anyMatch(v -> v != null && v.toLowerCase(Locale.ROOT).contains(needle));
            if (matches) {
                String url = "/" + panelPath + "/" + slug() + "/" + table.idOf(row) + "/edit";
                results.add(GlobalSearchResult.of(globalSearchResultTitle(row), url));
            }
        }
        return results;
    }
}
