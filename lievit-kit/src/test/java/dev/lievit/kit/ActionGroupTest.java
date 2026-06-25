/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Specifies action groups (the Filament {@code ActionGroup} + {@code HasDropdown}): several actions
 * under one dropdown trigger, child dispatch by name through a flat map, a configurable trigger
 * variant, and the group hiding itself when every child is hidden.
 */
class ActionGroupTest {

    record Listing(String id) {}

    /**
     * @spec.given a group of two actions
     * @spec.when  the children are listed and one is looked up by name
     * @spec.then  both render in order and the named child resolves
     */
    @Test
    void groups_children_and_dispatches_by_name() {
        ActionGroup<Listing> group =
                ActionGroup.make(new ViewAction<>(), new DeleteAction<>());

        assertThat(group.actions()).extracting(AdminAction::name).containsExactly("view", "delete");
        assertThat(group.action("delete")).isPresent();
        assertThat(group.action("missing")).isEmpty();
    }

    /**
     * @spec.given a group with a configured trigger variant
     * @spec.when  the trigger is read
     * @spec.then  it reflects the configured variant
     */
    @Test
    void the_trigger_variant_is_configurable() {
        ActionGroup<Listing> group =
                ActionGroup.<Listing>make(new ViewAction<>())
                        .trigger(ActionVariant.BUTTON)
                        .label("Actions");

        assertThat(group.triggerVariant()).isEqualTo(ActionVariant.BUTTON);
        assertThat(group.label()).isEqualTo("Actions");
    }

    /**
     * @spec.given a group whose every child is hidden for a record
     * @spec.when  the group's visibility is tested for that record
     * @spec.then  the group is hidden
     */
    @Test
    void a_group_hides_when_all_children_are_hidden() {
        ActionGroup<Listing> group =
                ActionGroup.make(
                        new DeleteAction<Listing>().hidden(r -> true),
                        new ViewAction<Listing>().hidden(r -> true));

        assertThat(group.isHiddenFor(new Listing("1"))).isTrue();
    }

    /**
     * @spec.given a group with one visible child
     * @spec.when  the group's visibility is tested
     * @spec.then  the group stays visible
     */
    @Test
    void a_group_stays_visible_when_one_child_is_visible() {
        ActionGroup<Listing> group =
                ActionGroup.make(
                        new DeleteAction<Listing>().hidden(r -> true), new ViewAction<Listing>());

        assertThat(group.isHiddenFor(new Listing("1"))).isFalse();
    }
}
