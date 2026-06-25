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
 * Specifies the custom single-record {@link Action} (the Filament {@code Action} on a table row, AC#3
 * of issue 249): {@code Action.make("approve").requiresConfirmation().action(record -> ...)} runs a
 * server-side closure over the resolved record, flashes a result, and authorizes per record. Unlike
 * {@link FormAction} it carries no form; unlike the CRUD built-ins it carries an arbitrary handler.
 */
class CustomActionTest {

    record Listing(String id, boolean approved) {}

    /**
     * @spec.given a custom action whose closure approves the resolved record
     * @spec.when  it runs against a row id under a permit-all authorizer
     * @spec.then  the closure receives the resolved record and the action completes
     */
    @Test
    void custom_action_runs_a_closure_over_the_resolved_record() {
        List<String> approved = new ArrayList<>();
        Action<Listing> action =
                Action.<Listing>make("approve", "Approve", AdminOperation.UPDATE)
                        .action((record, ctx) -> approved.add(record.id()));
        ActionTester<Listing> tester =
                ActionTester.of(resource(), "admin", AdminAuthorizer.permitAll());

        AdminActionResult result = tester.callAction(action, "7");

        assertThat(result.isCompleted()).isTrue();
        assertThat(approved).containsExactly("7");
    }

    /**
     * @spec.given a custom action with a record-only handler overload
     * @spec.when  it runs against a row id
     * @spec.then  the handler receives the record without needing the context
     */
    @Test
    void custom_action_supports_a_record_only_handler() {
        List<String> seen = new ArrayList<>();
        Action<Listing> action =
                Action.<Listing>make("touch", "Touch", AdminOperation.UPDATE).action(record -> seen.add(record.id()));
        ActionTester<Listing> tester =
                ActionTester.of(resource(), "admin", AdminAuthorizer.permitAll());

        tester.callAction(action, "3");

        assertThat(seen).containsExactly("3");
    }

    /**
     * @spec.given a custom action with requiresConfirmation set fluently
     * @spec.when  its confirmation flags are read
     * @spec.then  it requires confirmation and exposes the customized modal heading
     */
    @Test
    void custom_action_can_require_confirmation_with_a_custom_modal() {
        Action<Listing> action =
                Action.<Listing>make("approve", "Approve", AdminOperation.UPDATE)
                        .requiresConfirmation(true)
                        .confirmationHeading("Approve this listing?")
                        .action(record -> {});

        assertThat(action.requiresConfirmation()).isTrue();
        assertThat(action.confirmationModal().heading()).isEqualTo("Approve this listing?");
    }

    /**
     * @spec.given a custom action that flashes a success notification in its closure
     * @spec.when  it runs
     * @spec.then  the flash rides the context effects sink (the declared result seam)
     */
    @Test
    void custom_action_flashes_a_result_through_the_effects_sink() {
        Action<Listing> action =
                Action.<Listing>make("approve", "Approve", AdminOperation.UPDATE)
                        .action(
                                (record, ctx) ->
                                        AdminNotification.success("Approved.").flashOnto(ctx.effects()));
        ActionTester<Listing> tester =
                ActionTester.of(resource(), "admin", AdminAuthorizer.permitAll());

        AdminActionResult result = tester.callAction(action, "7");

        assertThat(result.isCompleted()).isTrue();
    }

    /**
     * @spec.given a custom action and an authorizer that denies the operation
     * @spec.when  it runs
     * @spec.then  the closure never runs and the result is forbidden
     */
    @Test
    void custom_action_is_gated_by_the_authorizer() {
        List<String> ran = new ArrayList<>();
        Action<Listing> action =
                Action.<Listing>make("approve", "Approve", AdminOperation.UPDATE)
                        .action(record -> ran.add(record.id()));
        ActionTester<Listing> tester =
                ActionTester.of(resource(), "admin", (operation, res, record) -> false);

        AdminActionResult result = tester.callAction(action, "7");

        assertThat(result.status()).isEqualTo(AdminActionResult.Status.FORBIDDEN);
        assertThat(ran).isEmpty();
    }

    static Resource<Listing> resource() {
        RecordRepository<Listing> repo =
                new RecordRepository<>() {
                    @Override
                    public Page<Listing> page(Query query) {
                        return Page.of(List.of(), 0);
                    }

                    @Override
                    public Optional<Listing> findById(String id) {
                        return Optional.of(new Listing(id, false));
                    }

                    @Override
                    public Listing create(Listing record) {
                        return record;
                    }

                    @Override
                    public Listing update(String id, Listing record) {
                        return record;
                    }

                    @Override
                    public void delete(String id) {}
                };
        return new Resource<>(repo) {
            @Override
            public String slug() {
                return "listings";
            }

            @Override
            public String label() {
                return "Listings";
            }

            @Override
            public Table<Listing> table() {
                return Table.<Listing>create().id(Listing::id).column("Id", Listing::id);
            }
        };
    }
}
