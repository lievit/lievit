/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * Specifies the Filament-Tables completeness this work closes (fast, boots nothing): the
 * {@link ViewColumn} escape hatch and its {@link Cell.View} cell, the {@link ColumnGroup} spanning
 * super-header model on {@link Table}, the {@link TernaryFilter} configuration surface (per-state
 * labels, attribute, nullable, query closure), the {@link FiltersLayout} token, and the
 * {@link AdminListView.FilterControl} projection. The end-to-end render of each lives in
 * {@code TableFeaturesIT}; this pins the pure logic.
 */
class TableFeaturesTest {

    record Row(int n, String name) {}

    /**
     * @spec.given a view column whose render mapper produces a trusted HTML fragment from the row
     * @spec.when  its cell is projected for a row
     * @spec.then  it yields a {@link Cell.View} carrying the produced fragment verbatim (the escape
     *     hatch out of the sealed cell hierarchy)
     */
    @Test
    void view_column_projects_its_fragment_as_a_view_cell() {
        ViewColumn<Row> col =
                ViewColumn.make("Score", r -> "<b data-x>" + r.n() + "</b>");

        Cell cell = col.cellFor(new Row(7, "a"));

        assertThat(cell).isInstanceOf(Cell.View.class);
        assertThat(((Cell.View) cell).html()).isEqualTo("<b data-x>7</b>");
        assertThat(cell.text()).isEqualTo("<b data-x>7</b>");
    }

    /**
     * @spec.given a view column carrying a url mapper
     * @spec.when  its cell is projected for a row
     * @spec.then  the view cell is wrapped as a {@link Cell.Link} so a custom-view cell can deep-link
     */
    @Test
    void view_column_links_when_a_url_mapper_is_declared() {
        ViewColumn<Row> col =
                ViewColumn.<Row>make("Score", r -> "<b>" + r.n() + "</b>").url(r -> "/r/" + r.n());

        Cell cell = col.cellFor(new Row(3, "a"));

        assertThat(cell).isInstanceOf(Cell.Link.class);
        assertThat(((Cell.Link) cell).href()).isEqualTo("/r/3");
    }

    /**
     * @spec.given a table wrapping two of its three columns in a "Location" column group
     * @spec.when  the spanning super-header row is computed
     * @spec.then  it is one empty spacer span over the ungrouped leading column plus one labelled span
     *     of width 2 over the group, the spans summing to the column count (the two header rows align)
     */
    @Test
    void column_group_yields_a_spanning_super_header_aligned_with_the_columns() {
        Table<Row> table =
                Table.<Row>create()
                        .column(TextColumn.make("Ref", Row::n))
                        .columnGroup(
                                ColumnGroup.make(
                                        "Location",
                                        TextColumn.<Row>make("City", Row::name),
                                        TextColumn.<Row>make("Zone", Row::name)));

        assertThat(table.columns()).extracting(Column::label).containsExactly("Ref", "City", "Zone");
        assertThat(table.hasColumnGroups()).isTrue();

        var groups = table.headerGroups();
        assertThat(groups).hasSize(2);
        assertThat(groups.get(0).isGroup()).isFalse();
        assertThat(groups.get(0).span()).isEqualTo(1);
        assertThat(groups.get(1).label()).isEqualTo("Location");
        assertThat(groups.get(1).span()).isEqualTo(2);
        assertThat(groups.stream().mapToInt(Table.HeaderGroup::span).sum())
                .isEqualTo(table.columns().size());
    }

    /**
     * @spec.given a table with no column group
     * @spec.when  the super-header row is computed
     * @spec.then  it is empty (no spanning row renders)
     */
    @Test
    void no_column_group_yields_no_super_header() {
        Table<Row> table = Table.<Row>create().column(TextColumn.make("Ref", Row::n));

        assertThat(table.hasColumnGroups()).isFalse();
        assertThat(table.headerGroups()).isEmpty();
    }

    /**
     * @spec.given a ternary filter with custom per-state labels, a placeholder, and a mapped attribute
     * @spec.when  its configuration is read
     * @spec.then  it reports the custom labels and the attribute decoupled from the filter name
     */
    @Test
    void ternary_filter_carries_custom_labels_and_a_mapped_attribute() {
        TernaryFilter filter =
                TernaryFilter.make("big")
                        .trueLabel("Big cities")
                        .falseLabel("Small cities")
                        .placeholder("Any size")
                        .attribute("city_is_big");

        assertThat(filter.trueLabel()).isEqualTo("Big cities");
        assertThat(filter.falseLabel()).isEqualTo("Small cities");
        assertThat(filter.placeholder()).isEqualTo("Any size");
        assertThat(filter.attribute()).isEqualTo("city_is_big");
        assertThat(filter.name()).isEqualTo("big");
    }

    /**
     * @spec.given a nullable ternary filter
     * @spec.when  its default labels are read
     * @spec.then  the present/absent semantics relabel the options to Filled / Empty
     */
    @Test
    void nullable_ternary_filter_relabels_to_filled_and_empty() {
        TernaryFilter filter = TernaryFilter.make("avatar").nullable();

        assertThat(filter.isNullable()).isTrue();
        assertThat(filter.trueLabel()).isEqualTo("Filled");
        assertThat(filter.falseLabel()).isEqualTo("Empty");
    }

    /**
     * @spec.given a ternary filter with a query closure remapping the boolean to another column
     * @spec.when  the active "true" state is resolved to a filter state
     * @spec.then  the closure output is returned, so the repository applies the remapped constraint
     */
    @Test
    void ternary_filter_query_closure_remaps_the_boolean_to_a_filter_state() {
        TernaryFilter filter =
                TernaryFilter.make("big")
                        .query(big -> FilterState.EMPTY.with("city_is_big", big ? "true" : "false"));

        FilterState applied =
                filter.toFilterState(FilterState.EMPTY.with("big", TernaryFilter.TRUE));

        assertThat(applied.value("city_is_big")).contains("true");
        // The "all" state applies nothing.
        assertThat(filter.toFilterState(FilterState.EMPTY).isEmpty()).isTrue();
    }

    /**
     * @spec.given a ternary filter with no query closure but a mapped attribute
     * @spec.when  the active "false" state is resolved to a filter state
     * @spec.then  the boolean maps onto the attribute key (not the filter name), false -> "false"
     */
    @Test
    void ternary_filter_without_closure_maps_onto_its_attribute() {
        TernaryFilter filter = TernaryFilter.make("big").attribute("city_is_big");

        FilterState applied =
                filter.toFilterState(FilterState.EMPTY.with("big", TernaryFilter.FALSE));

        assertThat(applied.value("city_is_big")).contains(TernaryFilter.FALSE);
        assertThat(applied.isActive("big")).isFalse();
    }

    /**
     * @spec.given the five filter layouts
     * @spec.when  their tokens are read
     * @spec.then  each is the stable lower-kebab token the template stamps
     */
    @Test
    void filters_layout_tokens_are_stable_lower_kebab() {
        assertThat(FiltersLayout.DROPDOWN.token()).isEqualTo("dropdown");
        assertThat(FiltersLayout.ABOVE_CONTENT.token()).isEqualTo("above-content");
        assertThat(FiltersLayout.ABOVE_CONTENT_COLLAPSIBLE.token())
                .isEqualTo("above-content-collapsible");
        assertThat(FiltersLayout.BELOW_CONTENT.token()).isEqualTo("below-content");
        assertThat(FiltersLayout.MODAL.token()).isEqualTo("modal");
    }

    /**
     * @spec.given a table declaring a filter layout, session persistence, and default filters
     * @spec.when  its filter configuration is read
     * @spec.then  it reports the layout, the persistence flag, and the seeded default filter state
     */
    @Test
    void table_carries_filter_layout_persistence_and_defaults() {
        Table<Row> table =
                Table.<Row>create()
                        .filters(SelectFilter.make("city"), TernaryFilter.make("big"))
                        .filtersLayout(FiltersLayout.ABOVE_CONTENT)
                        .persistFiltersInSession()
                        .defaultFilters(FilterState.EMPTY.with("big", "true"));

        assertThat(table.hasFilters()).isTrue();
        assertThat(table.filtersLayout()).isEqualTo(FiltersLayout.ABOVE_CONTENT);
        assertThat(table.persistsFiltersInSession()).isTrue();
        assertThat(table.defaultFilters().value("big")).contains("true");
    }

    /**
     * @spec.given a select filter and a ternary filter, with the ternary currently active
     * @spec.when  each is projected to a render control against the active state
     * @spec.then  the select control carries its options and the ternary control carries its custom
     *     labels + placeholder and reports active, so the panel renders each filter without re-reading
     *     the filter type
     */
    @Test
    void filter_controls_project_each_filter_for_rendering() {
        Map<String, String> cityOpts = new LinkedHashMap<>();
        cityOpts.put("Parma", "Parma");
        cityOpts.put("Reggio", "Reggio");
        SelectFilter city = SelectFilter.make("city").options(cityOpts);
        TernaryFilter big =
                TernaryFilter.make("big").trueLabel("Big").falseLabel("Small").placeholder("Any");
        FilterState state = FilterState.EMPTY.with("big", TernaryFilter.TRUE);

        AdminListView.FilterControl cityControl = AdminListView.FilterControl.of(city, state);
        AdminListView.FilterControl bigControl = AdminListView.FilterControl.of(big, state);

        assertThat(cityControl.kind())
                .isEqualTo(AdminListView.FilterControl.Kind.SELECT);
        assertThat(cityControl.options()).containsKeys("Parma", "Reggio");
        assertThat(cityControl.active()).isFalse();

        assertThat(bigControl.kind())
                .isEqualTo(AdminListView.FilterControl.Kind.TERNARY);
        assertThat(bigControl.options().values()).contains("Big", "Small");
        assertThat(bigControl.placeholder()).isEqualTo("Any");
        assertThat(bigControl.active()).isTrue();
        assertThat(bigControl.isSelected(TernaryFilter.TRUE)).isTrue();
    }
}
