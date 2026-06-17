/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Specifies the layout components (Section, Grid, Fieldset, Flex): each holds a child schema and a
 * column layout, and carries its own presentation flags. State participation is via the shared
 * {@link SchemaComponent} base (a layout holds no state of its own).
 */
class LayoutComponentsTest {

    static final class Probe extends SchemaComponent<String, Probe> {
        static Probe at(String path) {
            return new Probe().statePath(path);
        }
    }

    /**
     * @spec.given a Section with heading, description and a two-column child schema
     * @spec.when  its accessors are read
     * @spec.then  heading/description/columns and the children are exposed in order
     */
    @Test
    void section_carries_heading_description_columns_and_children() {
        Section section =
                Section.make("Address")
                        .description("Where to ship")
                        .columns(2)
                        .schema(Probe.at("street"), Probe.at("city"));

        assertThat(section.heading()).isEqualTo("Address");
        assertThat(section.description()).isEqualTo("Where to ship");
        assertThat(section.columns()).isEqualTo(2);
        assertThat(section.children()).extracting(SchemaComponent::statePath)
                .containsExactly("street", "city");
        assertThat(section.statePath()).isNull();
    }

    /**
     * @spec.given a Section
     * @spec.when  collapsed() and aside() and compact() are set
     * @spec.then  the presentation flags reflect it (collapsed implies collapsible)
     */
    @Test
    void section_presentation_flags() {
        Section section = Section.make("Meta").collapsed().aside().compact();

        assertThat(section.isCollapsible()).isTrue();
        assertThat(section.isCollapsed()).isTrue();
        assertThat(section.isAside()).isTrue();
        assertThat(section.isCompact()).isTrue();
    }

    /**
     * @spec.given a Grid with a default column count and per-breakpoint counts
     * @spec.when  the columns and breakpointColumns are read
     * @spec.then  both the default and the responsive counts are exposed
     */
    @Test
    void grid_supports_default_and_per_breakpoint_columns() {
        Grid grid = Grid.make(2).columns("lg", 4).columns("sm", 1);

        assertThat(grid.columns()).isEqualTo(2);
        assertThat(grid.breakpointColumns()).containsEntry("lg", 4).containsEntry("sm", 1);
    }

    /**
     * @spec.given any layout child
     * @spec.when  columnSpan and columnSpanFull are set
     * @spec.then  span control is exposed, with full mutually exclusive of an explicit span
     */
    @Test
    void any_component_supports_column_span() {
        Section spanning = Section.make("S").columnSpan(3);
        Section full = Section.make("F").columnSpanFull();

        assertThat(spanning.columnSpan()).isEqualTo(3);
        assertThat(spanning.isColumnSpanFull()).isFalse();
        assertThat(full.isColumnSpanFull()).isTrue();
        assertThat(full.columnSpan()).isNull();
    }

    /**
     * @spec.given a Fieldset with a label and a child
     * @spec.when  label and children are read
     * @spec.then  the bordered group exposes its legend and child schema
     */
    @Test
    void fieldset_carries_a_legend_label_and_children() {
        Fieldset fieldset = Fieldset.make("Contact").schema(Probe.at("email"));

        assertThat(fieldset.label()).isEqualTo("Contact");
        assertThat(fieldset.children()).hasSize(1);
    }

    /**
     * @spec.given a Flex row with children
     * @spec.when  the children are read
     * @spec.then  the flex container holds them in order
     */
    @Test
    void flex_holds_children_in_order() {
        Flex flex = Flex.make().schema(Probe.at("a"), Probe.at("b"));

        assertThat(flex.children()).extracting(SchemaComponent::statePath).containsExactly("a", "b");
    }
}
