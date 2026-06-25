/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * RENDER gate for the lievit-kit canonical TABLE chrome (kit/table.jte + sub-parts).
 *
 * The precompile smoke (the jte-maven-plugin `generate` goal in this module's pom) proves the
 * template COMPILES against dev.lievit.kit + the lievit-ui partials; it cannot prove the 14 Filament
 * chrome pieces actually RENDER. This does: it builds a real AdminListView fixture from the kit
 * builders, wraps it in a KitTableView (URL patterns + bulk selection + filter chips + summaries),
 * source-renders kit/table.jte on the fly (the same gg.jte 3.2.4 compiler, ContentType.Html,
 * DirectoryCodeResolver over the staged target/jte-src tree), and asserts the chrome lands.
 */
package dev.lievit.kit.jtecompile;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import gg.jte.ContentType;
import gg.jte.TemplateEngine;
import gg.jte.output.StringOutput;
import gg.jte.resolve.DirectoryCodeResolver;
import dev.lievit.kit.AdminListView;
import dev.lievit.kit.BadgeColumn;
import dev.lievit.kit.ColumnSummary;
import dev.lievit.kit.ListRequest;
import dev.lievit.kit.RecordRepository;
import dev.lievit.kit.Resource;
import dev.lievit.kit.Sort;
import dev.lievit.kit.SortDirection;
import dev.lievit.kit.Table;
import dev.lievit.kit.TextColumn;
import dev.lievit.kit.UrlAction;
import dev.lievit.kit.AdminAction;
import dev.lievit.kit.DeleteAction;
import dev.lievit.kit.FilterState;
import dev.lievit.kit.TernaryFilter;
import dev.lievit.kit.page.KitTableLabels;
import dev.lievit.kit.page.KitTableView;
import dev.lievit.kit.page.SavedViewsView;
import dev.lievit.kit.page.SortTokenSigner;
import dev.lievit.kit.page.SortTokenException;
import gg.jte.Content;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.OptionalLong;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertThrows;

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

        // 7. The sortable Name column: aria-sort=ascending (the default sort) + a real sort <a href>.
        // The active-sorted-ascending column carries the toggle direction token ("-name" = desc next),
        // so the link is ?sort=-name (not plain ?sort=name) — the toggle-direction behaviour (#491).
        assertTrue(html.contains("/admin/cities?sort=-name") || html.contains("/admin/cities?sort=name"),
                "sort link missing:\n" + html);
        assertTrue(html.contains("aria-sort=\"ascending\""), "aria-sort missing on the sorted column");
        assertTrue(html.contains("data-sort-key=\"name\""), "sort key marker missing");
    }

    @Test
    void renders_the_filament_fidelity_header_tint_padding_and_a_loading_spinner() {
        String html = render(populatedModel());

        // Filament fidelity (fi-ta-header-cell): the data-column header cells (sortable-head) ride a
        // SUBTLE 35% surface band (the bottom divider does the head/body split), comfortable px-3
        // padding, and a STRONGER near-fg semibold label at text-sm (Filament's text-gray-950 text-sm
        // font-semibold), not the prior faint muted-fg text-xs label. The sortable Name header carries
        // the band + the stronger label.
        int nameHeadStart = html.indexOf("data-sort-key=\"name\"");
        assertTrue(nameHeadStart >= 0, "sortable Name header not found:\n" + html);
        String nameHead = html.substring(nameHeadStart, html.indexOf("</th>", nameHeadStart));
        assertTrue(
                nameHead.contains("color-mix(in srgb, var(--lv-color-surface) 35%, var(--lv-color-bg))"),
                "data-column header did not lighten to the subtle 35% tint:\n" + nameHead);
        assertFalse(
                nameHead.contains("color-mix(in srgb, var(--lv-color-surface) 70%, var(--lv-color-bg))"),
                "the heavy 70% band is still on the data-column header");
        assertTrue(nameHead.contains("px-[var(--lv-space-3)]"), "data-column header px-3 padding missing");
        // The label is now the stronger near-fg, text-sm token (was faint muted-fg, text-xs).
        assertTrue(nameHead.contains("var(--lv-color-fg)"), "header label did not strengthen to fg:\n" + nameHead);
        assertTrue(nameHead.contains("text-[length:var(--lv-text-sm)]"),
                "header label did not grow to text-sm:\n" + nameHead);
        assertFalse(nameHead.contains("text-[length:var(--lv-text-xs)]"),
                "header label is still the smaller text-xs:\n" + nameHead);
        // Filament fidelity (fi-ta async indicator): a l:loading.delay spinner on the results row.
        assertTrue(html.contains("data-admin-loading"), "loading spinner region missing:\n" + html);
        assertTrue(html.contains("l:loading.delay"), "l:loading.delay wire directive missing on the spinner");
        assertTrue(html.contains("data-lucide=\"loader-circle\""), "loader-circle spinner glyph missing");
    }

    @Test
    void wraps_the_whole_chrome_in_one_elevated_card_frame() {
        String html = render(populatedModel());

        // Filament fidelity (fi-ta-ctn): the WHOLE chrome (heading -> toolbar -> bars -> table ->
        // pagination) sits in ONE elevated card: rounded-xl, a hairline border/ring, and a soft
        // shadow, with the inner sections divided by border-b. The kit-table root carries the card.
        int rootIdx = html.indexOf("data-slot=\"kit-table\"");
        assertTrue(rootIdx >= 0, "kit-table root missing:\n" + html);
        String rootTag = html.substring(rootIdx, html.indexOf('>', rootIdx));
        assertTrue(rootTag.contains("rounded-[var(--lv-radius-xl)]"),
                "card frame is not rounded-xl:\n" + rootTag);
        assertTrue(rootTag.contains("--lv-shadow-sm"), "card frame has no soft shadow token:\n" + rootTag);
        assertTrue(rootTag.contains("border-[var(--lv-color-border)]"),
                "card frame has no hairline ring/border:\n" + rootTag);

        // The inner <table> wrapper no longer carries its OWN box (no double frame): the card is the
        // single elevated surface now, the scroll wrapper only scrolls + divides.
        int scrollIdx = html.indexOf("data-slot=\"kit-table-scroll\"");
        assertTrue(scrollIdx >= 0, "kit-table-scroll missing:\n" + html);
        String scrollTag = html.substring(scrollIdx, html.indexOf('>', scrollIdx));
        assertFalse(scrollTag.contains("rounded-[var(--lv-radius-md)]"),
                "inner table wrapper still rounds its own box (double frame):\n" + scrollTag);
        assertFalse(scrollTag.contains("border border-[var(--lv-color-border)]"),
                "inner table wrapper still carries its own border (double frame):\n" + scrollTag);
    }

    @Test
    void unifies_the_header_band_for_select_all_and_sortable_cells() {
        String html = render(populatedModel());

        // Defect fix (#3): the whole thead reads as ONE uniform band. The select-all checkbox header
        // cell must resolve to the SAME background token as the sortable column cells (it used to be a
        // darker 70% band while the sortable cells were 35%, so the checkbox column read darker).
        String band = "color-mix(in srgb, var(--lv-color-surface) 35%, var(--lv-color-bg))";

        int selIdx = html.indexOf("data-slot=\"data-table-selection-head\"");
        assertTrue(selIdx >= 0, "select-all header cell missing:\n" + html);
        String selTh = html.substring(selIdx, html.indexOf("</th>", selIdx));
        assertTrue(selTh.contains(band), "select-all header is not on the unified 35% band:\n" + selTh);
        assertFalse(selTh.contains("color-mix(in srgb, var(--lv-color-surface) 70%, var(--lv-color-bg))"),
                "select-all header is still on the heavy 70% band:\n" + selTh);

        int nameIdx = html.indexOf("data-sort-key=\"name\"");
        assertTrue(nameIdx >= 0, "sortable header cell missing:\n" + html);
        String nameTh = html.substring(nameIdx, html.indexOf("</th>", nameIdx));
        assertTrue(nameTh.contains(band), "sortable header is not on the unified 35% band:\n" + nameTh);
    }

    /** A resource over 5 cities whose table registers a filter, so the "Filtri" affordance renders. */
    private static Resource<City> resourceWithFilter() {
        Resource<City> base = resource(5);
        return new Resource<>(base.repository()) {
            @Override
            public String slug() {
                return "cities";
            }

            @Override
            public String label() {
                return "Cities";
            }

            @Override
            public Table<City> table() {
                return Table.<City>create()
                        .id(c -> String.valueOf(c.id()))
                        .column(TextColumn.make("Name", City::name).makeSortable().searchable())
                        .filters(TernaryFilter.make("active"));
            }
        };
    }

    @Test
    void renders_the_filters_affordance_as_a_real_button() {
        Resource<City> resource = resourceWithFilter();
        AdminListView view = AdminListView.of(resource, ListRequest.firstPage(10), null);
        KitTableView table = KitTableView.of(view).withPageHref("/admin/cities?page=%d");
        Map<String, Object> model = new HashMap<>();
        model.put("table", table);
        model.put("createUrl", "");
        String html = render(model);

        // Filament fidelity (#5): the "Filtri" affordance is a real <button> trigger (sitting in the
        // toolbar's right cluster beside search), not a static, unclickable <div> indicator. It
        // references the always-open inline filter panel (server-first JS-off fallback) via aria-controls.
        int trigIdx = html.indexOf("data-admin-filters-trigger");
        assertTrue(trigIdx >= 0, "filters trigger missing:\n" + html);
        // Walk back to the opening tag of the element carrying the marker.
        int tagOpen = html.lastIndexOf('<', trigIdx);
        String trigTag = html.substring(tagOpen, html.indexOf('>', tagOpen));
        assertTrue(trigTag.startsWith("<button"), "filters affordance is not a real <button>:\n" + trigTag);
        assertTrue(trigTag.contains("aria-controls=\"kit-table-filters\""),
                "filters button does not reference the inline filter panel:\n" + trigTag);
        assertTrue(html.contains("id=\"kit-table-filters\""),
                "the inline filter panel target id is missing:\n" + html);
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
    void renders_the_saved_views_switcher_with_tabs_count_badge_and_default_star() {
        Resource<City> resource = resource(7);
        AdminListView view = AdminListView.of(resource, 1, 3);

        SavedViewsView switcher = new SavedViewsView(
                List.of(
                        new SavedViewsView.Tab("overdue", "Overdue", false, false, OptionalLong.of(4)),
                        new SavedViewsView.Tab("mine", "My view", true, true, OptionalLong.empty())),
                "overdue",
                true);
        KitTableView table = KitTableView.of(view)
                .withPageHref("/admin/cities?page=%d")
                .withSavedViews(switcher, "/admin/cities?view=%s");

        Map<String, Object> model = new HashMap<>();
        model.put("table", table);
        model.put("createUrl", "");
        String html = render(model);

        // 15. The switcher renders: a real GET <a href> per view, the active marker, the count badge,
        // the default star, and the manage wire actions the host arms.
        assertTrue(html.contains("data-admin-view-tabs"), "switcher missing:\n" + html);
        assertTrue(html.contains("/admin/cities?view=overdue"), "view switch link missing");
        assertTrue(html.contains("aria-current=\"true\""), "active view marker missing");
        assertTrue(html.contains("Overdue"), "view name missing");
        assertTrue(html.contains("lv-badge"), "per-view count badge missing");
        assertTrue(html.contains("data-admin-view-default"), "default star missing");
        assertTrue(html.contains("data-lucide=\"star\""), "default star glyph missing");
        assertTrue(html.contains("l:click=\"saveView\""), "save-view wire action missing");
        assertTrue(html.contains("l:click=\"deleteView\""), "delete-view wire action missing");
        assertTrue(html.contains("Unsaved changes"), "dirty indicator missing");
        // CSP: no inline script / on*-handlers leaked into the switcher.
        assertFalse(html.contains("<script"), "inline script leaked");
    }

    @Test
    void hides_the_saved_views_switcher_when_no_view_exists() {
        // The default populated model carries no saved views, so the switcher must not render.
        String html = render(populatedModel());
        assertFalse(html.contains("data-admin-view-tabs"), "switcher rendered without any view:\n" + html);
    }

    /** A resource over 5 cities whose table carries per-row actions + toggleable columns. */
    private static Resource<City> resourceWithActionsAndToggles() {
        List<City> all = new ArrayList<>();
        for (int i = 1; i <= 5; i++) {
            all.add(new City(i, "City " + i, i % 2 == 0 ? "active" : "archived"));
        }
        RecordRepository<City> repo =
                new RecordRepository<>() {
                    @Override
                    public Page<City> page(Query query) {
                        return Page.of(all, all.size());
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
            public Table<City> table() {
                return Table.<City>create()
                        .id(c -> String.valueOf(c.id()))
                        .column(TextColumn.make("Name", City::name).makeSortable())
                        .column(TextColumn.make("Status", City::status).toggleable())
                        .column(TextColumn.<City>make("Notes", c -> "").toggleable(true))
                        .actions(
                                UrlAction.make("edit", "Edit",
                                        r -> "/admin/cities/" + ((City) r).id() + "/edit"),
                                new DeleteAction<>());
            }
        };
    }

    /** A static-HTML content slot fixture (CSP-clean, no script). */
    private static Content slot(String html) {
        return new Content() {
            @Override
            public void writeTo(gg.jte.TemplateOutput output) {
                output.writeContent(html);
            }
        };
    }

    @Test
    void renders_the_per_row_action_buttons_link_and_destructive_with_confirm() {
        Resource<City> resource = resourceWithActionsAndToggles();
        AdminListView view = AdminListView.of(resource, ListRequest.firstPage(10), null);
        KitTableView table = KitTableView.of(view).withPageHref("/admin/cities?page=%d");

        Map<String, Object> model = new HashMap<>();
        model.put("table", table);
        model.put("createUrl", "");
        String html = render(model);

        // A. The trailing actions cell holds the resolved row actions: the Edit link (a real <a href>)
        // and the destructive Delete wire action with its confirm prompt carried as escaped data-*.
        assertTrue(html.contains("data-admin-row-actions=\"1\""), "row actions cell missing:\n" + html);
        assertTrue(html.contains("/admin/cities/1/edit"), "edit link action href missing");
        assertTrue(html.contains("data-variant=\"destructive\""), "destructive delete button missing");
        assertTrue(html.contains("data-confirm="), "confirm prompt not carried on the delete action");
        // The legacy single Edit fallback link must NOT appear (the action model unified it away).
        assertFalse(html.contains(">Edit</a>") && html.contains("data-admin-row-action=\"1\" class"),
                "legacy edit fallback leaked alongside the action buttons");
    }

    @Test
    void renders_the_columns_toggle_dropdown_from_the_view_model() {
        Resource<City> resource = resourceWithActionsAndToggles();
        AdminListView view = AdminListView.of(resource, ListRequest.firstPage(10), null);
        KitTableView table = KitTableView.of(view)
                .withPageHref("/admin/cities?page=%d")
                .withColumnToggleHref("/admin/cities?toggle=%s");

        Map<String, Object> model = new HashMap<>();
        model.put("table", table);
        model.put("createUrl", "");
        String html = render(model);

        // B. The auto-rendered "Columns" dropdown: one checkbox item per toggleable column, each a
        // real GET <a href> toggle (the column-toggle href pattern), Status checked + Notes unchecked.
        assertTrue(html.contains("data-table-column-visibility"), "columns dropdown missing:\n" + html);
        assertTrue(html.contains("/admin/cities?toggle=status"), "status toggle href missing");
        assertTrue(html.contains("/admin/cities?toggle=notes"), "notes toggle href missing");
        // Notes is hidden-by-default so it is NOT a rendered column header, but IS in the dropdown.
        assertFalse(html.contains("data-sort-key=\"notes\""), "hidden-by-default column leaked as a header");
    }

    @Test
    void renders_the_optional_chrome_slots_when_supplied() {
        Resource<City> resource = resource(5);
        AdminListView view = AdminListView.of(resource, ListRequest.firstPage(10), null);
        KitTableView table = KitTableView.of(view).withPageHref("/admin/cities?page=%d");

        Map<String, Object> model = new HashMap<>();
        model.put("table", table);
        model.put("createUrl", "");
        model.put("headerExtra", slot("<span data-test-header-extra>HX</span>"));
        model.put("toolbarEnd", slot("<span data-test-toolbar-end>TE</span>"));
        model.put("aboveTable", slot("<span data-test-above-table>AT</span>"));
        String html = render(model);

        // C. The three optional chrome slots land in their regions.
        assertTrue(html.contains("data-admin-header-extra"), "headerExtra region missing:\n" + html);
        assertTrue(html.contains("data-test-header-extra"), "headerExtra content missing");
        assertTrue(html.contains("data-admin-toolbar-end"), "toolbarEnd region missing");
        assertTrue(html.contains("data-test-toolbar-end"), "toolbarEnd content missing");
        assertTrue(html.contains("data-admin-above-table"), "aboveTable region missing");
        assertTrue(html.contains("data-test-above-table"), "aboveTable content missing");
    }

    @Test
    void substitutes_the_i18n_labels_when_a_host_supplies_them() {
        Resource<City> resource = resource(7);
        ListRequest request = new ListRequest(1, 3, Sort.NONE, "", FilterState.EMPTY);
        AdminListView view = AdminListView.of(resource, request);

        KitTableLabels it =
                new KitTableLabels(
                        "Cerca...", "Cerca", "Pulisci", "Filtri", "Colonne", "Azzera tutto",
                        "Azioni", "Modifica", "Nessun risultato", "Risultati %3$s, da %1$s a %2$s",
                        "Per pagina", "Precedente", "Successivo", "Pagina %s di %s",
                        "Elimina selezionati", "Nuovo", "Salva come nuova vista", "Aggiorna questa vista",
                        "Imposta predefinita", "Elimina vista", "Salva vista", "Modifiche non salvate",
                        "Altro");
        KitTableView table = KitTableView.of(view)
                .withPageHref("/admin/cities?page=%d")
                .withSizeHref("/admin/cities?size=%d")
                .withLabels(it);

        Map<String, Object> model = new HashMap<>();
        model.put("table", table);
        model.put("createUrl", "/admin/cities/create");
        String html = render(model);

        // D. The Italian copy replaces the hardcoded English: heading row, search, per-page, actions
        // header, create button, and the reordered results-count line.
        assertTrue(html.contains("Azioni"), "actions header not localised:\n" + html);
        assertTrue(html.contains("Per pagina"), "per-page label not localised");
        assertTrue(html.contains(">Nuovo<"), "create button label not localised");
        assertTrue(html.contains("placeholder=\"Cerca...\""), "search placeholder not localised");
        assertTrue(html.contains("Risultati 7, da 1 a 3"), "localised+reordered count line missing");
        // English copy must be gone for the substituted strings.
        assertFalse(html.contains(">Actions<"), "English 'Actions' leaked");
        assertFalse(html.contains("Per page"), "English 'Per page' leaked");
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

    // ---- #489 toolbar-slot render tests (scopeBar, headerActionsExtra, bulkActions,
    //      favoriteTabs, viewsManager, rowActionsSlot) — ADR sw-architecture-008 ----

    @Test
    void renders_scope_bar_slot_above_the_toolbar_when_supplied() {
        Resource<City> resource = resource(5);
        AdminListView view = AdminListView.of(resource, ListRequest.firstPage(10), null);
        KitTableView table = KitTableView.of(view).withPageHref("/admin/cities?page=%d");

        Map<String, Object> model = new HashMap<>();
        model.put("table", table);
        model.put("createUrl", "");
        model.put("scopeBar", slot("<div data-test-scope-bar>SB</div>"));
        String html = render(model);

        assertTrue(html.contains("data-admin-scope-bar"), "scopeBar wrapper missing:\n" + html);
        assertTrue(html.contains("data-test-scope-bar"), "scopeBar content missing");
        // Verify it appears BEFORE the table scroll wrapper (above the table).
        assertTrue(html.indexOf("data-admin-scope-bar") < html.indexOf("data-slot=\"kit-table-scroll\""),
                "scopeBar rendered after the table, not above it");
    }

    @Test
    void scope_bar_slot_is_absent_when_null() {
        String html = render(populatedModel());
        assertFalse(html.contains("data-admin-scope-bar"), "scopeBar rendered without content:\n" + html);
    }

    @Test
    void renders_header_actions_extra_slot_beside_the_create_button_when_supplied() {
        Resource<City> resource = resource(5);
        AdminListView view = AdminListView.of(resource, ListRequest.firstPage(10), null);
        KitTableView table = KitTableView.of(view).withPageHref("/admin/cities?page=%d");

        Map<String, Object> model = new HashMap<>();
        model.put("table", table);
        model.put("createUrl", "/admin/cities/create");
        model.put("headerActionsExtra", slot("<button data-test-header-extra-action>Export</button>"));
        String html = render(model);

        assertTrue(html.contains("data-admin-header-actions-extra"), "headerActionsExtra wrapper missing:\n" + html);
        assertTrue(html.contains("data-test-header-extra-action"), "headerActionsExtra content missing");
    }

    @Test
    void header_actions_extra_slot_is_absent_when_null() {
        String html = render(populatedModel());
        assertFalse(html.contains("data-admin-header-actions-extra"), "headerActionsExtra rendered without content");
    }

    @Test
    void bulk_actions_slot_replaces_the_default_delete_button_when_supplied() {
        // Set up a table with at least one selected row so the bulk bar shows.
        Resource<City> resource = resource(5);
        AdminListView view = AdminListView.of(resource, ListRequest.firstPage(10), null);
        KitTableView table = KitTableView.of(view)
                .withPageHref("/admin/cities?page=%d")
                .withSelection(KitTableView.Selection.of(Set.of("1"), view.rows().size(), 5));

        Map<String, Object> model = new HashMap<>();
        model.put("table", table);
        model.put("createUrl", "");
        model.put("bulkActions", slot("<button data-test-bulk-export>Export CSV</button>"));
        String html = render(model);

        // The custom bulk action renders.
        assertTrue(html.contains("data-test-bulk-export"), "custom bulkActions content missing:\n" + html);
        // The default "Delete selected" button must NOT appear.
        assertFalse(html.contains("Delete selected"), "default delete-selected leaked alongside bulkActions slot");
    }

    @Test
    void bulk_actions_falls_back_to_default_delete_when_slot_is_null() {
        Resource<City> resource = resource(5);
        AdminListView view = AdminListView.of(resource, ListRequest.firstPage(10), null);
        KitTableView table = KitTableView.of(view)
                .withPageHref("/admin/cities?page=%d")
                .withSelection(KitTableView.Selection.of(Set.of("1"), view.rows().size(), 5));

        Map<String, Object> model = new HashMap<>();
        model.put("table", table);
        model.put("createUrl", "");
        String html = render(model);

        // Default "Delete selected" renders when no slot is supplied.
        assertTrue(html.contains("Delete selected"), "default bulk-actions button missing:\n" + html);
    }

    @Test
    void favorite_tabs_slot_appended_inside_the_views_nav_when_supplied() {
        Resource<City> resource = resource(3);
        AdminListView view = AdminListView.of(resource, 1, 3);

        SavedViewsView switcher = new SavedViewsView(
                List.of(new SavedViewsView.Tab("mine", "Mine", false, false, OptionalLong.empty())),
                "mine",
                false);
        KitTableView table = KitTableView.of(view)
                .withPageHref("/admin/cities?page=%d")
                .withSavedViews(switcher, "/admin/cities?view=%s");

        Map<String, Object> model = new HashMap<>();
        model.put("table", table);
        model.put("createUrl", "");
        model.put("favoriteTabs", slot("<a href=\"/admin/cities?view=starred\" data-test-fav-tab>★ Starred</a>"));
        String html = render(model);

        // The saved-views nav renders...
        assertTrue(html.contains("data-admin-view-tabs"), "views nav missing:\n" + html);
        // ...and the favorite-tabs slot content is inside it.
        assertTrue(html.contains("data-test-fav-tab"), "favoriteTabs content missing");
        // The slot content appears after the preset tabs, inside the nav.
        int navStart = html.indexOf("data-admin-view-tabs");
        int navEnd = html.indexOf("data-admin-view-manage");
        int favPos = html.indexOf("data-test-fav-tab");
        assertTrue(favPos > navStart && favPos < navEnd,
                "favoriteTabs slot rendered outside the views nav");
    }

    @Test
    void views_manager_slot_replaces_the_manage_dropdown_when_supplied() {
        Resource<City> resource = resource(3);
        AdminListView view = AdminListView.of(resource, 1, 3);

        SavedViewsView switcher = new SavedViewsView(
                List.of(new SavedViewsView.Tab("mine", "Mine", false, false, OptionalLong.empty())),
                "mine",
                false);
        KitTableView table = KitTableView.of(view)
                .withPageHref("/admin/cities?page=%d")
                .withSavedViews(switcher, "/admin/cities?view=%s");

        Map<String, Object> model = new HashMap<>();
        model.put("table", table);
        model.put("createUrl", "");
        model.put("viewsManager", slot("<button data-test-custom-views-manager>Save view…</button>"));
        String html = render(model);

        // The custom views manager renders.
        assertTrue(html.contains("data-test-custom-views-manager"), "viewsManager content missing:\n" + html);
        // The default kit manage dropdown (wire actions) must NOT appear.
        assertFalse(html.contains("l:click=\"saveView\""),
                "default manage-dropdown wire action leaked when viewsManager slot is supplied");
    }

    // ---- #490 rowActionsSlot render tests — ADR sw-architecture-008 ----

    @Test
    void row_actions_slot_renders_in_trailing_cell_when_no_kit_actions_are_declared() {
        // A resource with NO table actions: the rowActionsSlot fallback should fire.
        Resource<City> resource = resource(3);
        AdminListView view = AdminListView.of(resource, ListRequest.firstPage(10), null);
        KitTableView table = KitTableView.of(view).withPageHref("/admin/cities?page=%d");

        Map<String, Object> model = new HashMap<>();
        model.put("table", table);
        model.put("createUrl", "");
        model.put("rowActionsSlot", slot("<button data-test-row-slot>Custom</button>"));
        String html = render(model);

        assertTrue(html.contains("data-admin-row-actions-slot"), "rowActionsSlot wrapper missing:\n" + html);
        assertTrue(html.contains("data-test-row-slot"), "rowActionsSlot content missing");
    }

    @Test
    void row_actions_slot_is_suppressed_when_kit_row_actions_are_declared() {
        // A resource with kit-declared Row.actions(): the slot must NOT render (kit actions take priority).
        Resource<City> resource = resourceWithActionsAndToggles();
        AdminListView view = AdminListView.of(resource, ListRequest.firstPage(10), null);
        KitTableView table = KitTableView.of(view).withPageHref("/admin/cities?page=%d");

        Map<String, Object> model = new HashMap<>();
        model.put("table", table);
        model.put("createUrl", "");
        model.put("rowActionsSlot", slot("<button data-test-should-not-render>Slot</button>"));
        String html = render(model);

        // The kit row actions render.
        assertTrue(html.contains("data-admin-row-actions=\"1\""), "kit row actions missing:\n" + html);
        // The slot must NOT render alongside kit actions.
        assertFalse(html.contains("data-test-should-not-render"),
                "rowActionsSlot rendered alongside kit Row.actions()");
    }

    // ---- #491 signed sort-token render tests — ADR sw-architecture-008 ----

    private static final byte[] SORT_KEY = "render-test-signing-key-01234567ab".getBytes(StandardCharsets.UTF_8);

    @Test
    void renders_signed_sort_links_when_a_signer_is_wired() {
        Resource<City> resource = resource(5);
        AdminListView view = AdminListView.of(resource, ListRequest.firstPage(10), null);
        SortTokenSigner signer = new SortTokenSigner(SORT_KEY);
        KitTableView table = KitTableView.of(view)
                .withSortHref("/admin/cities?sort=%s")
                .withSignedSort(signer);

        Map<String, Object> model = new HashMap<>();
        model.put("table", table);
        model.put("createUrl", "");
        String html = render(model);

        // A sort link exists for the "Name" column.
        assertTrue(html.contains("/admin/cities?sort="), "sort link missing:\n" + html);
        // The plain key "name" must NOT appear as the token; the link carries a signed token.
        assertFalse(html.contains("/admin/cities?sort=name"), "plain sort key leaked (should be signed):\n" + html);
        // The link contains a dot (base64key.base64sig format).
        int sortIdx = html.indexOf("/admin/cities?sort=");
        String linkFragment = html.substring(sortIdx, html.indexOf('"', sortIdx + 1));
        String token = linkFragment.substring(linkFragment.indexOf("sort=") + 5);
        assertTrue(token.contains("."), "signed token missing the dot separator:\n" + token);
        // The token verifies: the signer round-trips the sort key.
        String verified = signer.verify(token);
        assertTrue(verified.equals("name") || verified.equals("-name"),
                "verified key is neither 'name' nor '-name': " + verified);
    }

    @Test
    void renders_plain_sort_links_when_no_signer_is_wired() {
        Resource<City> resource = resource(5);
        AdminListView view = AdminListView.of(resource, ListRequest.firstPage(10), null);
        KitTableView table = KitTableView.of(view)
                .withSortHref("/admin/cities?sort=%s");

        Map<String, Object> model = new HashMap<>();
        model.put("table", table);
        model.put("createUrl", "");
        String html = render(model);

        // Without a signer the plain sort key substitution applies.
        assertTrue(html.contains("/admin/cities?sort=name") || html.contains("/admin/cities?sort=-name"),
                "plain sort link missing when no signer:\n" + html);
    }

    @Test
    void a_tampered_sort_token_from_the_render_is_rejected_by_the_signer() {
        SortTokenSigner signer = new SortTokenSigner(SORT_KEY);
        // Build a signed token for "name"...
        String goodToken = signer.sign("name");
        // ...and tamper with the last character of the signature part.
        String tampered = goodToken.substring(0, goodToken.length() - 1)
                + (goodToken.endsWith("A") ? "B" : "A");
        // The signer rejects the tampered token.
        assertThrows(SortTokenException.class, () -> signer.verify(tampered),
                "tampered token was not rejected");
    }
}
