/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.wire;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import dev.lievit.spring.LievitWireService;
import dev.lievit.spring.WireCallResult;

/**
 * The layout-bearing Infolist (filament-infolists Section / Tabs / Fieldset / Grid layout carried
 * over) end-to-end gate: a nested infolist schema resolved through the STRUCTURED resolve path
 * ({@code Infolist.resolveTree}) and rendered by JTE through the REAL lievit runtime. It proves the
 * audit's three layout rows render their defining sub-features, and that the
 * {@link dev.lievit.kit.schema.infolist.KeyValueEntry} map is finally reached (the audit's "unwired"
 * correctness fix: the structured resolve reaches {@code resolveMap}, not {@code String.valueOf}).
 *
 * <p>It boots a Spring context, so it is an {@code *IT} (the failsafe loop, ADR-0007).
 */
@SpringBootTest(classes = InfolistTreeWireTestApp.class)
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class InfolistLayoutComponentIT {

    @Autowired LievitWireService wireService;

    private static final String COMPONENT = InfolistViewComponent.class.getName();

    /**
     * @spec.given a layout-bearing infolist (Tabs containing a Section with a Grid + Fieldset +
     *     KeyValueEntry) over a record
     * @spec.when  the component is mounted and rendered by JTE through the real runtime
     * @spec.then  the TABS render contained + persisted with the configured active tab (Overview)
     *     selected, its tabpanel exposed and the other hidden, and an aria-orientation tablist:
     *     proving the infolist Tabs layout (activeTab / persistTab / contained / orientation) renders
     * @spec.us   US-infolist-tabs
     */
    @Test
    void renders_infolist_tabs_with_active_persisted_contained() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        assertThat(mounted.html())
                .contains("data-lv-infolist-tabs")
                .contains("data-lv-tabs-contained=\"true\"")
                .contains("data-lv-tabs-persist=\"true\"")
                .contains("data-lv-tabs-active=\"overview\"")
                .contains("data-lv-tabs-vertical=\"false\"")
                .contains("role=\"tablist\"")
                .contains("aria-orientation=\"horizontal\"")
                // Overview tab is the active one (aria-selected true + its panel exposed).
                .contains("data-lv-tab=\"overview\"")
                .containsPattern("data-lv-tab=\"overview\"[^>]*aria-selected=\"true\"")
                .containsPattern("data-lv-tabpanel=\"details\"[^>]*\\bhidden\\b");
    }

    /**
     * @spec.given the same layout-bearing infolist
     * @spec.when  it is rendered through the real runtime
     * @spec.then  the Section inside the Details tab carries its heading + description + icon and its
     *     collapsible / column-count attributes, proving the infolist Section layout (heading /
     *     description / icon / collapsible / columns) renders its defining sub-features
     * @spec.us   US-infolist-section
     */
    @Test
    void renders_infolist_section_with_heading_description_icon_collapsible() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        assertThat(mounted.html())
                .contains("data-lv-infolist-section")
                .contains("data-lv-section-collapsible=\"true\"")
                .contains("data-lv-section-columns=\"2\"")
                .contains("data-lv-section-heading")
                // The heading text + its icon partial both render inside the heading element.
                .containsPattern("data-lv-section-heading>[\\s\\S]*?Address")
                .containsPattern("data-lv-section-heading>[\\s\\S]*?<svg")
                .contains("data-lv-section-description>Where it is</p>");
    }

    /**
     * @spec.given the Section nests a Grid(2) and a Fieldset(columnSpan 2) with a full-span entry
     * @spec.when  it is rendered through the real runtime
     * @spec.then  the Grid renders its column count, the Fieldset renders its legend + its parent
     *     column-span, and the price entry carries its own columnSpan(2): proving the infolist
     *     Grid/Fieldset/Split layout (per-entry columnSpan + Fieldset for entries) renders
     * @spec.us   US-infolist-grid-fieldset
     */
    @Test
    void renders_infolist_grid_and_fieldset_with_column_spans() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        assertThat(mounted.html())
                .contains("data-lv-infolist-grid")
                .contains("data-lv-grid-columns=\"2\"")
                .contains("data-lv-infolist-fieldset")
                .contains("data-lv-fieldset-legend>Pricing</legend>")
                // The fieldset spans 2 parent columns.
                .containsPattern("data-lv-infolist-fieldset[^>]*grid-column: span 2")
                // The price entry declares its own columnSpan(2).
                .containsPattern("data-lv-infolist-entry=\"Price\"[^>]*grid-column: span 2");
    }

    /**
     * @spec.given a KeyValueEntry over a record whose "features" attribute is a real map
     * @spec.when  the infolist resolves through the STRUCTURED tree and renders
     * @spec.then  the key-value table renders one row per map entry with the configured column
     *     headers (Garden=Yes, Floor=3): proving resolveMap is FINALLY invoked end-to-end (the
     *     audit's unwired correctness fix), the map is NOT flattened to String.valueOf(map)
     * @spec.us   US-infolist-keyvalue-wired
     */
    @Test
    void renders_keyvalue_entry_map_through_the_structured_resolve() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        assertThat(mounted.html())
                .contains("data-lv-keyvalue")
                .contains("<th>Feature</th><th>Detail</th>")
                .contains("data-lv-keyvalue-row=\"Garden\"><td>Garden</td><td>Yes</td>")
                .contains("data-lv-keyvalue-row=\"Floor\"><td>Floor</td><td>3</td>")
                // The map is NOT flattened to its toString.
                .doesNotContain("{Garden=Yes")
                .doesNotContain("data-lv-keyvalue-empty");
    }
}
