/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * RENDER gate for the lievit-kit canonical TABLE chrome (kit/table.jte + sub-parts).
 *
 * The precompile smoke (the jte-maven-plugin `generate` goal in this module's pom) proves the
 * template COMPILES against io.lievit.kit + the lievit-ui partials; it cannot prove the 14 Filament
 * chrome pieces actually RENDER. This does: it builds a real AdminListView fixture from the kit
 * builders, wraps it in a KitTableView (URL patterns + bulk selection + filter chips + summaries),
 * source-renders kit/table.jte on the fly (the same gg.jte 3.2.4 compiler, ContentType.Html,
 * DirectoryCodeResolver over the staged target/jte-src tree), and asserts the chrome lands.
 */
package io.lievit.kit.jtecompile;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import gg.jte.ContentType;
import gg.jte.TemplateEngine;
import gg.jte.output.StringOutput;
import gg.jte.resolve.DirectoryCodeResolver;
import io.lievit.kit.AdminListView;
import io.lievit.kit.BadgeColumn;
import io.lievit.kit.ColumnSummary;
import io.lievit.kit.ListRequest;
import io.lievit.kit.RecordRepository;
import io.lievit.kit.Resource;
import io.lievit.kit.Sort;
import io.lievit.kit.SortDirection;
import io.lievit.kit.Table;
import io.lievit.kit.TextColumn;
import io.lievit.kit.UrlAction;
import io.lievit.kit.AdminAction;
import io.lievit.kit.FilterState;
import io.lievit.kit.page.KitTableView;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;

class KitTableChromeRenderTest {

    /** The staged template tree: kit/table.jte + the lievit/* partials, under target/jte-src. */
    private static final Path JTE_DIR = Path.of("target", "jte-src");

    private static final TemplateEngine ENGINE =
            TemplateEngine.create(new DirectoryCodeResolver(JTE_DIR), ContentType.Html);

    record City(int id, String name, String status) {}

    /** A resource over `count` cities: a sortable+searchable Name column, a Status badge column. */
    private static Resource<City> resource(int count) {
        List<City> all = new ArrayList<>();
        for (int i = 1; i <= count; i++) {
            all.add(new City(i, "City " + i, i % 2 == 0 ? "active" : "archived"));
        }
        RecordRepository<City> repo =
                new RecordRepository<>() {
                    @Override
                    public Page<City> page(Query query) {
                        int from = Math.min(query.offset(), all.size());
                        int to = Math.min(from + query.limit(), all.size());
                        return Page.of(all.subList(from, to), all.size());
                    }

                    @Override
                    public Optional<City> findById(String id) {
                        return all.stream().filter(c -> String.valueOf(c.id()).equals(id)).findFirst();
                    }

                    @Override
                    public City create(City record) {
                        return record;
                    }

                    @Override
                    public City update(String id, City record) {
                        return record;
                    }

                    @Override
                    public void delete(String id) {}
                };
        return new Resource<>(repo) {
            @Override
            public String slug() {
                return "cities";
            }

            @Override
            public String label() {
                return "Cities";
            }

            @Override
            public List<AdminAction<City>> headerActions() {
                return List.of(UrlAction.make("export", "Export", "/admin/cities/export"));
            }

            @Override
            public Table<City> table() {
                return Table.<City>create()
                        .id(c -> String.valueOf(c.id()))
                        .column(TextColumn.make("Name", City::name).makeSortable().searchable())
                        .column(BadgeColumn.make("Status", City::status)
                                .color(s -> "active".equals(s) ? "success" : "danger"))
                        .defaultSort("name")
                        .emptyState("No cities yet", "Create the first city to get started.");
            }
        };
    }

    /** Renders the staged kit/table.jte with the given model. */
    private String render(Map<String, Object> model) {
        StringOutput out = new StringOutput();
        ENGINE.render("kit/table.jte", model, out);
        return out.toString();
    }

    /** Builds the populated-table model: 7 cities, page 1 of 3 (size 3), with full render facts. */
    private Map<String, Object> populatedModel() {
        Resource<City> resource = resource(7);
        ListRequest request = new ListRequest(1, 3, Sort.asc("name"), "Cit", FilterState.EMPTY);
        AdminListView view = AdminListView.of(resource, request);

        KitTableView table = KitTableView.of(view)
                .withPageHref("/admin/cities?page=%d")
                .withSortHref("/admin/cities?sort=%s")
                .withSizeHref("/admin/cities?size=%d")
                .withFilterIndicators(
                        "/admin/cities",
                        List.of(new KitTableView.FilterChip(
                                "Status: active", "/admin/cities?clear=status")))
                .withSelection(KitTableView.Selection.of(Set.of("1"), view.rows().size(), 7))
                .withSummaries(List.of(new ColumnSummary("Total", "7")));

        Map<String, Object> model = new HashMap<>();
        model.put("table", table);
        model.put("createUrl", "/admin/cities/create");
        return model;
    }

    @Test
    void renders_the_header_actions_bar_search_and_create() {
        String html = render(populatedModel());

        // 1. Header heading + the resource header action (Export, a real <a href>) + create button.
        assertTrue(html.contains("Cities"), "heading missing:\n" + html);
        assertTrue(html.contains("/admin/cities/export"), "header action href missing:\n" + html);
        assertTrue(html.contains("data-admin-header-action=\"export\""), "header action marker missing");
        assertTrue(html.contains("/admin/cities/create"), "create href missing");
        // 2. Global search field, echoing the active term.
        assertTrue(html.contains("name=\"q\""), "search input name missing");
        assertTrue(html.contains("type=\"search\""), "search input type missing");
        assertTrue(html.contains("Cit"), "active search term not echoed");
    }

    @Test
    void renders_sortable_header_cells_with_aria_sort_and_a_sort_link() {
        String html = render(populatedModel());

        // 7. The sortable Name column: a real sort <a href> + aria-sort=ascending (the default sort).
        assertTrue(html.contains("/admin/cities?sort=name"), "sort link missing:\n" + html);
        assertTrue(html.contains("aria-sort=\"ascending\""), "aria-sort missing on the sorted column");
        assertTrue(html.contains("data-sort-key=\"name\""), "sort key marker missing");
    }

    @Test
    void renders_the_bulk_selection_checkboxes_and_the_n_of_m_bar() {
        String html = render(populatedModel());

        // 4. Bulk select-all header box + per-row boxes + the "N of M row(s) selected" bar.
        assertTrue(html.contains("name=\"selectAll\""), "select-all checkbox missing:\n" + html);
        assertTrue(html.contains("name=\"selected\""), "per-row checkbox missing");
        assertTrue(html.contains("row(s) selected"), "bulk selection bar count line missing");
        // One row is selected, so the bulk-action cluster shows.
        assertTrue(html.contains("Delete selected"), "bulk action button missing");
    }

    @Test
    void renders_the_per_page_selector_pagination_and_the_results_count() {
        String html = render(populatedModel());

        // 9. Per-page selector links.
        assertTrue(html.contains("data-admin-per-page"), "per-page selector missing:\n" + html);
        assertTrue(html.contains("/admin/cities?size=25"), "a page-size link missing");
        // 10. Numbered pagination (real page links) + the "Showing X to Y of Z results" line.
        assertTrue(html.contains("/admin/cities?page=2"), "numbered page link missing");
        assertTrue(html.contains("Showing 1 to 3 of 7 results"), "results-count line wrong:\n" + html);
    }

    @Test
    void renders_filter_indicator_chips_and_a_summary_row() {
        String html = render(populatedModel());

        // 3. Active-filter indicator chip (removable) + reset-all.
        assertTrue(html.contains("Status: active"), "filter chip label missing:\n" + html);
        assertTrue(html.contains("/admin/cities?clear=status"), "chip remove href missing");
        assertTrue(html.contains("Reset all"), "reset-all link missing");
        // 12. Summary / footer row.
        assertTrue(html.contains("data-admin-summary"), "summary row missing");
        assertTrue(html.contains("Total"), "summary label missing");
    }

    @Test
    void renders_rich_badge_cells_through_the_kit_rich_cell_partial() {
        String html = render(populatedModel());

        // 14. The Status badge column renders through the badge partial (lv-badge), not bare text.
        assertTrue(html.contains("lv-badge"), "badge cell not rendered through the badge partial:\n" + html);
    }

    @Test
    void renders_the_full_empty_state_panel_when_no_row_matches() {
        Resource<City> resource = resource(0);
        AdminListView view = AdminListView.of(resource, 1, 10);
        KitTableView table = KitTableView.of(view).withPageHref("/admin/cities?page=%d");

        Map<String, Object> model = new HashMap<>();
        model.put("table", table);
        model.put("createUrl", "/admin/cities/create");
        String html = render(model);

        // 13. The empty state: the kit's emptyState heading + description through the empty partial.
        assertTrue(html.contains("data-admin-empty"), "empty-state row missing:\n" + html);
        assertTrue(html.contains("No cities yet"), "empty-state heading missing");
        assertTrue(html.contains("Create the first city"), "empty-state description missing");
        // No rows => no results.
        assertTrue(html.contains("No results"), "empty results count line missing");
    }

    @Test
    void a_table_without_render_facts_falls_back_to_wire_controls_not_a_crash() {
        // The minimal bundle (no URL patterns, no selection): the table still renders, with the
        // wire-driven pager fallback and no checkbox column / per-page selector. Proves the template
        // degrades cleanly when a host supplies only the AdminListView.
        Resource<City> resource = resource(5);
        AdminListView view = AdminListView.of(resource, 1, 2);
        KitTableView table = KitTableView.of(view);

        Map<String, Object> model = new HashMap<>();
        model.put("table", table);
        model.put("createUrl", "");
        String html = render(model);

        assertTrue(html.contains("Cities"), "heading missing in minimal render:\n" + html);
        assertFalse(html.contains("name=\"selectAll\""), "no selection => no select-all box");
        assertFalse(html.contains("data-admin-per-page"), "no size href => no per-page selector");
        // The wire-pager fallback (no page href) renders the Previous/Next + "Page X of Y".
        assertTrue(html.contains("Page 1 of 3"), "wire-pager fallback missing");
    }
}
