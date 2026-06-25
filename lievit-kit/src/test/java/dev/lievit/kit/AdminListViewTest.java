/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

/**
 * Specifies {@link AdminListView}: it derives the heading, column headers, and one row per record
 * <strong>on the requested page</strong> from a resource (reading a bounded
 * {@link RecordRepository.Page}, never the whole table), and computes the pagination state the
 * template renders.
 */
class AdminListViewTest {

    record City(int id, String name) {}

    static RecordRepository<City> repoOf(int count) {
        List<City> all = new ArrayList<>();
        for (int i = 1; i <= count; i++) {
            all.add(new City(i, "City " + i));
        }
        return new RecordRepository<>() {
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
    }

    static Resource<City> resourceOf(RecordRepository<City> repo) {
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
                        .column("Name", City::name);
            }
        };
    }

    /**
     * @spec.given a resource over 5 records and a page size of 2
     * @spec.when  the second page's view is built
     * @spec.then  it carries the two rows of that window and the headers from the columns
     * @spec.adr   ADR-0008
     */
    @Test
    void builds_one_bounded_page_of_rows_with_headers() {
        AdminListView view = AdminListView.of(resourceOf(repoOf(5)), 2, 2);

        assertThat(view.headers()).containsExactly("Name");
        assertThat(view.rows()).extracting(AdminListView.Row::id).containsExactly("3", "4");
        assertThat(view.rows().get(0).textCells()).containsExactly("City 3");
        assertThat(view.rows().get(0).cells()).containsExactly(new Cell.Text("City 3"));
    }

    /**
     * @spec.given 5 records and a page size of 2
     * @spec.when  the pagination is computed for page 2
     * @spec.then  it reports 3 total pages, has both a previous and a next page
     * @spec.adr   ADR-0008
     */
    @Test
    void computes_pagination_across_pages() {
        AdminListView view = AdminListView.of(resourceOf(repoOf(5)), 2, 2);

        AdminListView.Pagination pagination = view.pagination();
        assertThat(pagination.page()).isEqualTo(2);
        assertThat(pagination.totalPages()).isEqualTo(3);
        assertThat(pagination.hasPrevious()).isTrue();
        assertThat(pagination.hasNext()).isTrue();
        assertThat(pagination.nextPage()).isEqualTo(3);
        assertThat(pagination.previousPage()).isEqualTo(1);
    }

    /**
     * @spec.given an empty resource
     * @spec.when  the first page's view is built
     * @spec.then  it has no rows and reports exactly one (empty) page, never zero
     * @spec.adr   ADR-0008
     */
    @Test
    void an_empty_resource_still_reports_one_page() {
        AdminListView view = AdminListView.of(resourceOf(repoOf(0)), 1, 10);

        assertThat(view.rows()).isEmpty();
        assertThat(view.pagination().totalPages()).isEqualTo(1);
        assertThat(view.pagination().hasNext()).isFalse();
    }

    /**
     * @spec.given a resource and a page number past the end
     * @spec.when  the view is built for that page
     * @spec.then  the pagination clamps the page to the last real page
     * @spec.adr   ADR-0008
     */
    @Test
    void clamps_a_page_past_the_end_to_the_last_page() {
        AdminListView view = AdminListView.of(resourceOf(repoOf(3)), 99, 2);

        assertThat(view.pagination().page()).isEqualTo(2);
    }

    record Item(int id, String name, String status) {}

    static Resource<Item> richResource() {
        Item one = new Item(1, "Alpha", "active");
        Item two = new Item(2, "Beta", "archived");
        RecordRepository<Item> repo =
                new RecordRepository<>() {
                    final List<Item> all = List.of(one, two);

                    @Override
                    public Page<Item> page(Query query) {
                        return Page.of(all, all.size());
                    }

                    @Override
                    public Optional<Item> findById(String id) {
                        return all.stream().filter(i -> String.valueOf(i.id()).equals(id)).findFirst();
                    }

                    @Override
                    public Item create(Item record) {
                        return record;
                    }

                    @Override
                    public Item update(String id, Item record) {
                        return record;
                    }

                    @Override
                    public void delete(String id) {}
                };
        return new Resource<>(repo) {
            @Override
            public String slug() {
                return "items";
            }

            @Override
            public String label() {
                return "Items";
            }

            @Override
            public Table<Item> table() {
                return Table.<Item>create()
                        .id(i -> String.valueOf(i.id()))
                        .column(
                                TextColumn.make("Name", Item::name)
                                        .url(i -> "/items/" + i.id(), true))
                        .column(BadgeColumn.make("Status", Item::status).color(s -> "active".equals(s) ? "success" : "danger"))
                        .column(IconColumn.make("Flag", Item::status).icon(s -> "active".equals(s) ? "check" : "x").color(s -> "active".equals(s) ? "success" : "danger"))
                        .column("Plain", Item::status);
            }
        };
    }

    /**
     * @spec.given a column carrying a new-tab url mapper
     * @spec.when  the list view builds its cells
     * @spec.then  that column yields a Cell.Link with the row's href, text, and the new-tab flag
     */
    @Test
    void a_url_column_yields_a_link_cell() {
        AdminListView view = AdminListView.of(richResource(), 1, 10);

        Cell first = view.rows().get(0).cells().get(0);
        assertThat(first).isInstanceOf(Cell.Link.class);
        Cell.Link link = (Cell.Link) first;
        assertThat(link.text()).isEqualTo("Alpha");
        assertThat(link.href()).isEqualTo("/items/1");
        assertThat(link.newTab()).isTrue();
    }

    /**
     * @spec.given a badge column with a colour mapper
     * @spec.when  the list view builds its cells
     * @spec.then  that column yields a Cell.Badge carrying the text and the mapped variant per row
     */
    @Test
    void a_badge_column_yields_a_badge_cell_with_its_variant() {
        AdminListView view = AdminListView.of(richResource(), 1, 10);

        assertThat(view.rows().get(0).cells().get(1)).isEqualTo(new Cell.Badge("active", "success"));
        assertThat(view.rows().get(1).cells().get(1)).isEqualTo(new Cell.Badge("archived", "danger"));
    }

    /**
     * @spec.given an icon column with an icon mapper and a colour mapper
     * @spec.when  the list view builds its cells
     * @spec.then  that column yields a Cell.Icon with the resolved icon name, the text, and the colour
     */
    @Test
    void an_icon_column_yields_an_icon_cell() {
        AdminListView view = AdminListView.of(richResource(), 1, 10);

        assertThat(view.rows().get(0).cells().get(2)).isEqualTo(new Cell.Icon("check", "active", "success"));
        assertThat(view.rows().get(1).cells().get(2)).isEqualTo(new Cell.Icon("x", "archived", "danger"));
    }

    /**
     * @spec.given a plain (untyped, un-linked) column
     * @spec.when  the list view builds its cells
     * @spec.then  that column yields a Cell.Text with the escaped value
     */
    @Test
    void a_plain_column_yields_a_text_cell() {
        AdminListView view = AdminListView.of(richResource(), 1, 10);

        assertThat(view.rows().get(0).cells().get(3)).isEqualTo(new Cell.Text("active"));
    }

    /**
     * @spec.given a row carrying a mix of typed cells
     * @spec.when  the flat text projection is read
     * @spec.then  textCells returns each cell's display text in column order
     */
    @Test
    void text_cells_projects_every_cell_to_its_display_text() {
        AdminListView view = AdminListView.of(richResource(), 1, 10);

        assertThat(view.rows().get(0).textCells())
                .containsExactly("Alpha", "active", "active", "active");
    }
}
