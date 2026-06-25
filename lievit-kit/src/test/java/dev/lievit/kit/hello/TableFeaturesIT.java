/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.hello;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import dev.lievit.spring.LievitWireService;

/**
 * The Filament-Tables completeness tracer-bullet: the worked {@link ListingResource} list is driven
 * through the REAL lievit runtime (codec + registry + dispatcher + JTE adapter) and the rendered DOM
 * is asserted for the table capabilities this work moved from partial/missing to full, so each
 * capability is proven by its BEHAVIOUR in the rendered markup, not by a builder flag alone (the
 * silent-slot lesson: assert the DOM, not the structure).
 *
 * <p>Capabilities under test (audit "Filament Tables" rows): {@code Custom columns (ViewColumn)},
 * {@code Column groups (ColumnGroup)}, {@code TernaryFilter}, and {@code Filter layout & persistence}.
 *
 * <p>It boots a Spring context, so it is an {@code *IT} (the failsafe loop of ADR-0007).
 */
@SpringBootTest(classes = HelloAdminTestApp.class)
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class TableFeaturesIT {

    @Autowired LievitWireService wireService;

    private static final String LIST = ListingListComponent.class.getName();

    /**
     * @spec.given the worked ListingResource whose table wraps City + Zone in a "Location"
     *     {@link dev.lievit.kit.ColumnGroup} (a spanning super-header over two columns)
     * @spec.when  its list component is mounted and rendered by JTE through the real runtime
     * @spec.then  a spanning super-header ROW renders above the column headers: the "Location" cell
     *     carries {@code colspan="2"} over City + Zone, the ungrouped leading column sits under an
     *     empty spacer cell, and the per-column headers still render underneath, proving the two
     *     header rows align (Filament {@code ColumnGroup::make})
     */
    @Test
    void renders_a_column_group_spanning_super_header_through_jte() {
        String html = wireService.mount(LIST).html();

        assertThat(html)
                .contains("data-admin-header-groups")
                // The group cell spans its two member columns (City + Zone).
                .contains("data-admin-header-group=\"Location\"")
                .contains("colspan=\"2\"")
                // The ungrouped leading column (Ref) sits under an empty spacer so the rows align.
                .contains("data-admin-header-group-spacer")
                // The per-column headers still render below the super-header.
                .contains("<th>City</th>")
                .contains("<th>Zone</th>");

        // The super-header row precedes the column-header row in source order.
        int superRow = html.indexOf("data-admin-header-groups");
        int cityHeader = html.indexOf("<th>City</th>");
        assertThat(superRow).isLessThan(cityHeader);
    }

    /**
     * @spec.given the worked ListingResource declaring a {@link dev.lievit.kit.ViewColumn} ("Score")
     *     whose render mapper produces a trusted {@code <div data-score-bar>} fragment per row
     * @spec.when  its list component is mounted and rendered by JTE through the real runtime
     * @spec.then  the custom-view cell stamps the adopter's fragment RAW (not HTML-escaped): the real
     *     {@code <div data-score-bar ...>} survives into the {@code <td data-admin-view-cell>}, proving
     *     the {@code ViewColumn} escape hatch reaches the rendered DOM (Filament {@code ViewColumn})
     */
    @Test
    void renders_a_view_column_fragment_raw_through_jte() {
        String html = wireService.mount(LIST).html();

        assertThat(html)
                .contains("data-admin-view-cell")
                // The fragment is stamped RAW: the real div survives, it is NOT escaped to &lt;div&gt;.
                .contains("<div data-score-bar")
                .doesNotContain("&lt;div data-score-bar");
        // Parma (5 chars) -> value 50, width 50%; "Reggio Emilia" (13 chars) -> value 130, width
        // capped at min(100, 13*10)=100%, the value itself uncapped (proves the row drives the cell).
        assertThat(html)
                .contains("style=\"width:50%\">50</div>")
                .contains("style=\"width:100%\">130</div>");
    }

    /**
     * @spec.given the worked ListingResource whose filters declare the layout
     *     {@code FiltersLayout.ABOVE_CONTENT} and {@code persistFiltersInSession()}
     * @spec.when  its list component is mounted and rendered by JTE through the real runtime
     * @spec.then  the filter PANEL renders carrying the chosen layout token and the persistence flag
     *     as data hooks, so the host stamps the panel in the right surface (Filament
     *     {@code filtersLayout} + {@code persistFiltersInSession})
     */
    @Test
    void renders_the_filter_panel_with_its_layout_and_persistence_through_jte() {
        String html = wireService.mount(LIST).html();

        assertThat(html)
                .contains("data-admin-filters")
                .contains("data-filters-layout=\"above-content\"")
                .contains("data-filters-persist=\"true\"");
    }

    /**
     * @spec.given the worked ListingResource declaring a fully-configured
     *     {@link dev.lievit.kit.TernaryFilter} ("big": trueLabel "Big cities", falseLabel
     *     "Small cities", placeholder "Any size") with a default-active value of true
     * @spec.when  its list component is mounted and rendered by JTE through the real runtime
     * @spec.then  the ternary control renders its three options with the CUSTOM per-state labels and
     *     the leading placeholder, the default value is marked selected, and the filter reports active,
     *     proving the per-state-label + default surface reaches the DOM (Filament {@code TernaryFilter})
     */
    @Test
    void renders_a_ternary_filter_with_custom_labels_and_default_active_through_jte() {
        String html = wireService.mount(LIST).html();

        assertThat(html)
                .contains("data-admin-filter=\"big\"")
                .contains("data-filter-kind=\"TERNARY\"")
                // The custom per-state labels + placeholder, not the "Yes"/"No"/"All" defaults.
                .contains(">Big cities</option>")
                .contains(">Small cities</option>")
                .contains(">Any size</option>")
                // The table's defaultFilters seeds "big"=true, so the true option is pre-selected and
                // the filter reports active on first load.
                .contains("data-filter-active=\"true\"")
                .contains("value=\"true\" selected>Big cities</option>");
    }

    /**
     * @spec.given the worked ListingResource declaring a {@link dev.lievit.kit.SelectFilter} over the
     *     city with two options
     * @spec.when  its list component is mounted and rendered by JTE through the real runtime
     * @spec.then  the select control renders its options as a real {@code <select>} with the declared
     *     option labels, and the active-filter INDICATOR reflects the one default-active filter,
     *     proving the filter panel projects each registered filter (Filament {@code HasFilters})
     */
    @Test
    void renders_the_select_filter_options_and_the_active_indicator_through_jte() {
        String html = wireService.mount(LIST).html();

        assertThat(html)
                .contains("data-admin-filter=\"city\"")
                .contains("data-filter-kind=\"SELECT\"")
                .contains(">Parma</option>")
                .contains(">Reggio Emilia</option>");
        // Exactly one filter (the ternary "big" default) is active on first load.
        assertThat(html).contains("<span data-admin-filters-indicator>1</span>");
    }
}
