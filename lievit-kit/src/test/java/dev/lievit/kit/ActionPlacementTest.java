/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Specifies the action host registry: a table/page declares header, row, and bulk actions and looks
 * one up by placement + name (the Filament {@code HasActions} host + {@code BelongsToTable}
 * placement). The dispatch seam {@link ActionRegistry#find} resolves an action so the host can run
 * it scoped to its placement.
 */
class ActionPlacementTest {

    record Listing(String id) {}

    /**
     * @spec.given a registry with a header, a row, and a bulk action
     * @spec.when  each is looked up by placement and name
     * @spec.then  the right action is resolved for each placement
     */
    @Test
    void resolves_actions_by_placement_and_name() {
        ActionRegistry<Listing> registry =
                ActionRegistry.<Listing>create()
                        .header(new ReplicateAction<>())
                        .row(new DeleteAction<>())
                        .bulk(new DeleteBulkAction<>());

        assertThat(registry.find(ActionPlacement.HEADER, "replicate")).isPresent();
        assertThat(registry.find(ActionPlacement.ROW, "delete")).isPresent();
        assertThat(registry.find(ActionPlacement.BULK, "delete-selected")).isPresent();
    }

    /**
     * @spec.given a registry
     * @spec.when  an unknown name is looked up
     * @spec.then  no action is resolved
     */
    @Test
    void an_unknown_action_name_resolves_to_empty() {
        ActionRegistry<Listing> registry = ActionRegistry.<Listing>create().row(new DeleteAction<>());

        assertThat(registry.find(ActionPlacement.ROW, "missing")).isEmpty();
        assertThat(registry.find(ActionPlacement.HEADER, "delete")).isEmpty();
    }

    /**
     * @spec.given a registry with several header actions
     * @spec.when  the header actions are listed
     * @spec.then  they come back in declaration order
     */
    @Test
    void lists_header_actions_in_declaration_order() {
        ActionRegistry<Listing> registry =
                ActionRegistry.<Listing>create().header(new ReplicateAction<>(), new ViewAction<>());

        assertThat(registry.headerActions())
                .extracting(AdminAction::name)
                .containsExactly("replicate", "view");
    }
}
