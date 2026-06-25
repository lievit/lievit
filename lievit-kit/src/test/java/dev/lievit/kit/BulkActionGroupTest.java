/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

/**
 * Specifies the {@link BulkActionGroup} (the Filament {@code BulkActionGroup}, AC#4 of issue 251):
 * several bulk actions collapse under one trigger, exposing a flat name→action dispatch map and
 * declaration order, mirroring the single-action {@link ActionGroup}.
 */
class BulkActionGroupTest {

    record Item(String id) {}

    /**
     * @spec.given a bulk action group of two bulk actions
     * @spec.when  its actions are read
     * @spec.then  it returns them in declaration order
     */
    @Test
    void groups_bulk_actions_in_declaration_order() {
        BulkAction<Item> delete = new DeleteBulkAction<>();
        BulkAction<Item> export =
                BulkAction.make("export", "Export", AdminOperation.VIEW_LIST, (records, ctx) -> {});
        BulkActionGroup<Item> group = BulkActionGroup.make(delete, export);

        assertThat(group.actions()).extracting(AdminAction::name).containsExactly("delete-selected", "export");
    }

    /**
     * @spec.given a bulk action group
     * @spec.when  a child is looked up by name
     * @spec.then  the flat dispatch map resolves it (and an unknown name is empty)
     */
    @Test
    void resolves_a_child_bulk_action_by_name() {
        BulkAction<Item> export =
                BulkAction.make("export", "Export", AdminOperation.VIEW_LIST, (records, ctx) -> {});
        BulkActionGroup<Item> group = BulkActionGroup.make(export);

        assertThat(group.action("export")).containsSame(export);
        assertThat(group.action("nope")).isEmpty();
    }

    /**
     * @spec.given a bulk action group with a custom label and icon
     * @spec.when  the trigger metadata is read
     * @spec.then  the label and icon are exposed for the dropdown trigger
     */
    @Test
    void exposes_a_trigger_label_and_icon() {
        BulkActionGroup<Item> group =
                BulkActionGroup.<Item>make(new DeleteBulkAction<>())
                        .label("More")
                        .icon("heroicon-m-ellipsis-horizontal");

        assertThat(group.label()).isEqualTo("More");
        assertThat(group.icon()).isEqualTo("heroicon-m-ellipsis-horizontal");
    }

    /**
     * @spec.given an empty bulk action group
     * @spec.when  its emptiness is read
     * @spec.then  it reports empty (so the host renders no trigger)
     */
    @Test
    void an_empty_group_is_reported_empty() {
        assertThat(BulkActionGroup.<Item>make().isEmpty()).isTrue();
        assertThat(BulkActionGroup.<Item>make(new DeleteBulkAction<>()).isEmpty()).isFalse();
    }

    /**
     * @spec.given a list of bulk actions including a group
     * @spec.when  the flattened actions are requested
     * @spec.then  the group's children are flattened alongside the top-level actions
     */
    @Test
    void flattens_grouped_and_top_level_actions() {
        BulkAction<Item> top = new DeleteBulkAction<>();
        BulkAction<Item> a =
                BulkAction.make("a", "A", AdminOperation.VIEW_LIST, (records, ctx) -> {});
        BulkAction<Item> b =
                BulkAction.make("b", "B", AdminOperation.VIEW_LIST, (records, ctx) -> {});
        BulkActionGroup<Item> group = BulkActionGroup.make(a, b);

        List<BulkAction<Item>> flat = BulkActionGroup.flatten(List.of(top), List.of(group));

        assertThat(flat).extracting(AdminAction::name).containsExactly("delete-selected", "a", "b");
    }
}
