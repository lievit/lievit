/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

/**
 * Specifies record grouping (the Filament {@code Grouping/Group} + {@code CanGroupRecords}):
 * {@link Table#groups} registers user-selectable groupings, the first becomes the default unless
 * {@link Table#defaultGroup} overrides it, and {@link Group#partition} folds the in-scope rows into
 * ordered, counted sections that preserve the incoming (sorted) order. Grouping composes with
 * per-group summaries through {@link Column#summaries}.
 */
class RecordGroupingTest {

    record Lead(String id, String status, int value) {}

    private static final List<Lead> LEADS =
            List.of(
                    new Lead("1", "open", 100),
                    new Lead("2", "won", 300),
                    new Lead("3", "open", 50),
                    new Lead("4", "won", 200));

    /**
     * @spec.given a table with a status group registered
     * @spec.when  the groups are read back
     * @spec.then  the group is registered and the first one is the default
     */
    @Test
    void registering_groups_sets_the_first_as_default() {
        Table<Lead> table = Table.<Lead>create().groups(Group.make("status", Lead::status));

        assertThat(table.isGroupable()).isTrue();
        assertThat(table.defaultGroup()).isEqualTo("status");
        assertThat(table.group("status")).isNotNull();
    }

    /**
     * @spec.given a table with two groupings
     * @spec.when  a non-first default group is declared
     * @spec.then  the declared default wins over the first-registered
     */
    @Test
    void an_explicit_default_group_overrides_the_first() {
        Table<Lead> table =
                Table.<Lead>create()
                        .groups(Group.make("status", Lead::status), Group.make("value", Lead::value))
                        .defaultGroup("value");

        assertThat(table.defaultGroup()).isEqualTo("value");
    }

    /**
     * @spec.given a status grouping over the leads
     * @spec.when  the rows are partitioned
     * @spec.then  collapsible sections render in first-seen-key order with a per-section count
     */
    @Test
    void partition_folds_rows_into_counted_sections_in_order() {
        Group<Lead> byStatus = Group.make("status", Lead::status);

        List<Group.Section<Lead>> sections = byStatus.partition(LEADS);

        assertThat(byStatus.isCollapsible()).isTrue();
        assertThat(sections).extracting(Group.Section::key).containsExactly("open", "won");
        assertThat(sections.get(0).count()).isEqualTo(2);
        assertThat(sections.get(1).count()).isEqualTo(2);
        assertThat(sections.get(0).rows()).extracting(Lead::id).containsExactly("1", "3");
    }

    /**
     * @spec.given a grouped table and a value column with a Sum summary
     * @spec.when  each group section is summarized
     * @spec.then  per-group footers carry the section's own total
     */
    @Test
    void per_group_summaries_render_in_group_footers() {
        Group<Lead> byStatus = Group.make("status", Lead::status);
        Column<Lead> value = new Column<Lead>("Value", Lead::value).summarize(Summarizer.sum());

        List<Group.Section<Lead>> sections = byStatus.partition(LEADS);

        assertThat(value.summaries(sections.get(0).rows()).get(0).value()).isEqualTo("150"); // open
        assertThat(value.summaries(sections.get(1).rows()).get(0).value()).isEqualTo("500"); // won
    }

    /**
     * @spec.given a group with a null-keyed row
     * @spec.when  it is partitioned
     * @spec.then  the null key folds into a placeholder section
     */
    @Test
    void a_null_key_folds_into_a_placeholder_section() {
        Group<Lead> byStatus = Group.make("status", l -> null);

        List<Group.Section<Lead>> sections = byStatus.partition(LEADS);

        assertThat(sections).hasSize(1);
        assertThat(sections.get(0).key()).isEqualTo("—");
    }
}
