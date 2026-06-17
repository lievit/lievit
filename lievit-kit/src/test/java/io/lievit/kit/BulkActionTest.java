/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

/**
 * Specifies bulk actions over a selection (the Filament {@code BulkAction} +
 * {@code InteractsWithSelectedRecords}): the selection→authorize→process→report loop, per-record
 * authorization filtering counted as failures, the {@code DeleteBulkAction} built-in, and chunked
 * iteration over a large selection.
 */
class BulkActionTest {

    record Item(String id) {}

    /**
     * @spec.given a delete-bulk action and a permit-all authorizer
     * @spec.when  it runs over a selection of two ids
     * @spec.then  both records are deleted and the result reports two successes
     */
    @Test
    void delete_bulk_deletes_the_selected_records() {
        MutableRepo repo = new MutableRepo(List.of("1", "2", "3"));
        ActionTester<Item> tester =
                ActionTester.of(resource(repo), "admin", AdminAuthorizer.permitAll());

        BulkActionResult result =
                tester.callBulkAction(new DeleteBulkAction<>(), List.of("1", "2"));

        assertThat(result.successful()).isEqualTo(2);
        assertThat(result.failed()).isZero();
        assertThat(repo.ids).containsExactly("3");
    }

    /**
     * @spec.given a selection where one record is denied by the authorizer
     * @spec.when  a bulk action runs
     * @spec.then  the denied record is skipped and counted as a failure
     */
    @Test
    void per_record_authorization_filters_the_selection() {
        MutableRepo repo = new MutableRepo(List.of("1", "2"));
        AdminAuthorizer denyOne =
                (operation, res, record) -> !(record instanceof Item it && it.id().equals("2"));
        ActionTester<Item> tester = ActionTester.of(resource(repo), "admin", denyOne);

        BulkActionResult result =
                tester.callBulkAction(new DeleteBulkAction<>(), List.of("1", "2"));

        assertThat(result.successful()).isEqualTo(1);
        assertThat(result.failed()).isEqualTo(1);
        assertThat(repo.ids).containsExactly("2");
    }

    /**
     * @spec.given a custom bulk action over a large selection with a small chunk size
     * @spec.when  it runs
     * @spec.then  the body is invoked once per chunk, processing every authorized record
     */
    @Test
    void large_selections_iterate_in_chunks() {
        MutableRepo repo = new MutableRepo(List.of("1", "2", "3", "4", "5"));
        List<Integer> chunkSizes = new ArrayList<>();
        BulkAction<Item> action =
                BulkAction.<Item>make(
                                "noop",
                                "No-op",
                                AdminOperation.UPDATE,
                                (records, ctx) -> chunkSizes.add(records.size()))
                        .chunkSelectedRecords(2);
        ActionTester<Item> tester =
                ActionTester.of(resource(repo), "admin", AdminAuthorizer.permitAll());

        BulkActionResult result =
                tester.callBulkAction(action, List.of("1", "2", "3", "4", "5"));

        assertThat(result.successful()).isEqualTo(5);
        assertThat(chunkSizes).containsExactly(2, 2, 1);
    }

    /**
     * @spec.given a delete-bulk action
     * @spec.when  its flags are read
     * @spec.then  it requires confirmation, is destructive, and deselects after completion
     */
    @Test
    void delete_bulk_is_destructive_and_deselects_after() {
        DeleteBulkAction<Item> action = new DeleteBulkAction<>();

        assertThat(action.requiresConfirmation()).isTrue();
        assertThat(action.isDestructive()).isTrue();
        assertThat(action.deselectsAfterCompletion()).isTrue();
    }

    static final class MutableRepo implements RecordRepository<Item> {
        final List<String> ids;

        MutableRepo(List<String> initial) {
            this.ids = new ArrayList<>(initial);
        }

        @Override
        public Page<Item> page(Query query) {
            List<Item> rows = ids.stream().map(Item::new).toList();
            return Page.of(rows, rows.size());
        }

        @Override
        public Optional<Item> findById(String id) {
            return ids.contains(id) ? Optional.of(new Item(id)) : Optional.empty();
        }

        @Override
        public Item create(Item record) {
            ids.add(record.id());
            return record;
        }

        @Override
        public Item update(String id, Item record) {
            return record;
        }

        @Override
        public void delete(String id) {
            ids.remove(id);
        }
    }

    static Resource<Item> resource(RecordRepository<Item> repo) {
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
                return Table.<Item>create().id(Item::id).column("Id", Item::id);
            }
        };
    }
}
