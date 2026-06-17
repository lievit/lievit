/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Optional;

import org.junit.jupiter.api.Test;

/**
 * Specifies the navigation model (issue #278): {@link NavigationItem}, {@link NavigationGroup},
 * {@link NavigationBuilder}, and the {@link Resource} navigation derivation. The load-bearing
 * behaviours are sort ordering, badge rendering, visibility-as-authorization filtering, and active
 * state. Pure tests — no Spring context.
 */
class NavigationTest {

    /**
     * @spec.given a navigation item with label, url, icon, badge, and sort
     * @spec.when  its slots are read
     * @spec.then  each returns the declared value
     */
    @Test
    void navigation_item_carries_label_url_icon_badge_and_sort() {
        NavigationItem item =
                NavigationItem.make("Listings", "/admin/listings")
                        .icon(Icon.of("nav.resource"))
                        .badge("3", Color.DANGER)
                        .sort(10);

        assertThat(item.label()).isEqualTo("Listings");
        assertThat(item.url()).isEqualTo("/admin/listings");
        assertThat(item.icon()).contains(Icon.of("nav.resource"));
        assertThat(item.badge()).contains("3");
        assertThat(item.badgeColor()).contains(Color.DANGER);
        assertThat(item.sortKey()).isEqualTo(10);
    }

    /**
     * @spec.given an item with an active icon
     * @spec.when  resolvedIcon is asked for the active and inactive states
     * @spec.then  the active icon is used only when active
     */
    @Test
    void navigation_item_uses_active_icon_only_when_active() {
        NavigationItem item =
                NavigationItem.make("Dashboard", "/admin")
                        .icon(Icon.of("nav.dashboard"))
                        .activeIcon(Icon.of("nav.dashboard.active"));

        assertThat(item.resolvedIcon(true)).contains(Icon.of("nav.dashboard.active"));
        assertThat(item.resolvedIcon(false)).contains(Icon.of("nav.dashboard"));
    }

    /**
     * @spec.given an item with the default active rule
     * @spec.when  isActive is checked against a matching and a non-matching path
     * @spec.then  it matches only on the exact url
     */
    @Test
    void navigation_item_active_state_defaults_to_exact_url_match() {
        NavigationItem item = NavigationItem.make("Listings", "/admin/listings");

        assertThat(item.isActive("/admin/listings")).isTrue();
        assertThat(item.isActive("/admin/agents")).isFalse();
    }

    /**
     * @spec.given an item with a custom isActiveWhen predicate over the request path
     * @spec.when  isActive is checked against a sub-path
     * @spec.then  the predicate decides (prefix match)
     */
    @Test
    void navigation_item_honours_a_custom_active_predicate() {
        NavigationItem item =
                NavigationItem.make("Listings", "/admin/listings")
                        .isActiveWhen(path -> path.startsWith("/admin/listings"));

        assertThat(item.isActive("/admin/listings/42/edit")).isTrue();
    }

    /**
     * @spec.given a group with three items declared out of sort order, one hidden
     * @spec.when  visibleItems is read
     * @spec.then  the hidden item is filtered and the rest are sorted ascending by sort key
     */
    @Test
    void navigation_group_sorts_visible_items_and_filters_hidden() {
        NavigationGroup group =
                NavigationGroup.make("Catalog")
                        .item(NavigationItem.make("C", "/c").sort(30))
                        .item(NavigationItem.make("A", "/a").sort(10))
                        .item(NavigationItem.make("Hidden", "/h").sort(5).hidden(true))
                        .item(NavigationItem.make("B", "/b").sort(20));

        assertThat(group.visibleItems()).extracting(NavigationItem::label)
                .containsExactly("A", "B", "C");
    }

    /**
     * @spec.given an item added to a group
     * @spec.when  the item's group label is read
     * @spec.then  it is set to the group's label (round-trips)
     */
    @Test
    void navigation_group_stamps_its_label_onto_added_items() {
        NavigationItem item = NavigationItem.make("A", "/a");
        NavigationGroup.make("Catalog").item(item);

        assertThat(item.groupLabel()).contains("Catalog");
    }

    /**
     * @spec.given a builder with two top-level items, one hidden
     * @spec.when  visibleItems is read
     * @spec.then  the hidden item is filtered and the rest sorted ascending
     */
    @Test
    void navigation_builder_filters_hidden_top_level_items_and_sorts() {
        NavigationBuilder nav =
                NavigationBuilder.create()
                        .item(NavigationItem.make("Second", "/2").sort(20))
                        .item(NavigationItem.make("Hidden", "/h").sort(5).visible(false))
                        .item(NavigationItem.make("First", "/1").sort(10));

        assertThat(nav.visibleItems()).extracting(NavigationItem::label)
                .containsExactly("First", "Second");
    }

    /**
     * @spec.given a builder with a group whose every item is hidden
     * @spec.when  visibleGroups is read
     * @spec.then  the empty group is dropped (does not render)
     */
    @Test
    void navigation_builder_drops_a_group_with_no_visible_items() {
        NavigationBuilder nav =
                NavigationBuilder.create()
                        .group(
                                NavigationGroup.make("Empty")
                                        .item(NavigationItem.make("X", "/x").hidden(true)))
                        .group(
                                NavigationGroup.make("Catalog")
                                        .item(NavigationItem.make("A", "/a")));

        assertThat(nav.visibleGroups()).extracting(NavigationGroup::label)
                .containsExactly("Catalog");
    }

    /**
     * @spec.given a lazy visibility supplier that flips
     * @spec.when  isVisible is evaluated before and after the flip
     * @spec.then  the supplier is consulted at evaluation time (authorization at render time)
     */
    @Test
    void navigation_item_visibility_is_evaluated_lazily() {
        boolean[] allowed = {false};
        NavigationItem item = NavigationItem.make("Admin", "/admin").visible(() -> allowed[0]);

        assertThat(item.isVisible()).isFalse();
        allowed[0] = true;
        assertThat(item.isVisible()).isTrue();
    }

    // ── Resource navigation derivation ──────────────────────────────────────────────────────────

    static final class CatalogResource extends Resource<String> {
        CatalogResource() {
            super(new InMemoryRepo());
        }

        @Override
        public String slug() {
            return "listings";
        }

        @Override
        public String label() {
            return "Listings";
        }

        @Override
        public Table<String> table() {
            return Table.create();
        }

        @Override
        public String navigationGroup() {
            return "Catalog";
        }

        @Override
        public int navigationSort() {
            return 5;
        }

        @Override
        public String navigationBadge() {
            return "12";
        }
    }

    static final class HiddenResource extends Resource<String> {
        HiddenResource() {
            super(new InMemoryRepo());
        }

        @Override
        public String slug() {
            return "secret";
        }

        @Override
        public String label() {
            return "Secret";
        }

        @Override
        public Table<String> table() {
            return Table.create();
        }

        @Override
        public boolean shouldRegisterNavigation() {
            return false;
        }
    }

    /**
     * @spec.given a resource overriding group, sort, and badge
     * @spec.when  its navigation item is derived for the admin panel path
     * @spec.then  the item carries the resource's url, group, sort, badge, and default icon
     */
    @Test
    void resource_derives_a_navigation_item_with_its_overrides() {
        NavigationItem item = new CatalogResource().navigationItem("admin").orElseThrow();

        assertThat(item.label()).isEqualTo("Listings");
        assertThat(item.url()).isEqualTo("/admin/listings");
        assertThat(item.groupLabel()).contains("Catalog");
        assertThat(item.sortKey()).isEqualTo(5);
        assertThat(item.badge()).contains("12");
        assertThat(item.icon()).contains(Icon.of("nav.resource"));
    }

    /**
     * @spec.given a resource that opts out of navigation
     * @spec.when  its navigation item is derived
     * @spec.then  no item is produced
     */
    @Test
    void resource_opting_out_of_navigation_yields_no_item() {
        assertThat(new HiddenResource().navigationItem("admin")).isEmpty();
    }

    /** A trivial in-memory repository so the resource can be constructed in tests. */
    private static final class InMemoryRepo implements RecordRepository<String> {
        @Override
        public Page<String> page(Query query) {
            return Page.of(java.util.List.of(), 0);
        }

        @Override
        public Optional<String> findById(String id) {
            return Optional.empty();
        }

        @Override
        public String create(String record) {
            return record;
        }

        @Override
        public String update(String id, String record) {
            return record;
        }

        @Override
        public void delete(String id) {}
    }
}
