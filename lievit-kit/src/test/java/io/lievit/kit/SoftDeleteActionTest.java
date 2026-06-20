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
 * Specifies the soft-delete action family (the Filament {@code RestoreAction}/{@code
 * ForceDeleteAction} + bulk variants): {@link RestoreAction} clears the trashed marker through a
 * {@link SoftDeleteRepository}, {@link ForceDeleteAction} removes the row permanently, both hide on
 * a live (non-trashed) record, and the bulk variants apply over a selection. {@code Delete} stays
 * the soft delete (sets the marker).
 */
class SoftDeleteActionTest {

    record Doc(String id) {}

    /**
     * @spec.given a soft-deleted record and a restore action
     * @spec.when  the restore runs against it
     * @spec.then  the record's trashed marker is cleared and the action completes
     */
    @Test
    void restore_clears_the_trashed_marker() {
        SoftRepo repo = new SoftRepo(List.of("1"), List.of("1"));
        ActionTester<Doc> tester = ActionTester.of(resource(repo), "admin", AdminAuthorizer.permitAll());

        AdminActionResult result = tester.callAction(new RestoreAction<>(repo), "1");

        tester.assertActionCompleted(result);
        assertThat(repo.trashed).isEmpty();
    }

    /**
     * @spec.given a soft-deleted record and a force-delete action
     * @spec.when  the force-delete runs against it
     * @spec.then  the row is removed permanently
     */
    @Test
    void force_delete_removes_the_row_permanently() {
        SoftRepo repo = new SoftRepo(List.of("1", "2"), List.of("1"));
        ActionTester<Doc> tester = ActionTester.of(resource(repo), "admin", AdminAuthorizer.permitAll());

        tester.callAction(new ForceDeleteAction<>(repo), "1");

        assertThat(repo.live).containsExactly("2");
        assertThat(repo.trashed).isEmpty();
    }

    /**
     * @spec.given restore and force-delete actions and a soft-delete repository
     * @spec.when  the visibility is checked for a live vs a trashed record
     * @spec.then  both are hidden on a live record and visible on a trashed one
     */
    @Test
    void restore_and_force_delete_hide_on_a_live_record() {
        SoftRepo repo = new SoftRepo(List.of("1", "2"), List.of("2"));
        RestoreAction<Doc> restore = new RestoreAction<>(repo);
        ForceDeleteAction<Doc> force = new ForceDeleteAction<>(repo);

        assertThat(restore.isHiddenFor(new Doc("1"))).isTrue(); // live -> hidden
        assertThat(restore.isHiddenFor(new Doc("2"))).isFalse(); // trashed -> visible
        assertThat(force.isHiddenFor(new Doc("1"))).isTrue();
        assertThat(force.isHiddenFor(new Doc("2"))).isFalse();
    }

    /**
     * @spec.given the soft-delete actions
     * @spec.when  their gating metadata is read
     * @spec.then  restore gates its own RESTORE verb and confirms; force-delete gates its own
     *     FORCE_DELETE verb, is destructive and confirms (the per-verb policy map: restore is not
     *     update and force-delete is not delete, so a policy can grant one without the other)
     */
    @Test
    void soft_delete_actions_gate_and_confirm_correctly() {
        SoftRepo repo = new SoftRepo(List.of(), List.of());
        RestoreAction<Doc> restore = new RestoreAction<>(repo);
        ForceDeleteAction<Doc> force = new ForceDeleteAction<>(repo);

        assertThat(restore.operation()).isEqualTo(AdminOperation.RESTORE);
        assertThat(restore.requiresConfirmation()).isTrue();
        assertThat(force.operation()).isEqualTo(AdminOperation.FORCE_DELETE);
        assertThat(force.isDestructive()).isTrue();
        assertThat(force.requiresConfirmation()).isTrue();
    }

    /**
     * @spec.given a selection of trashed records and the bulk restore/force-delete actions
     * @spec.when  each runs over the selection
     * @spec.then  restore clears all markers and force-delete removes all rows
     */
    @Test
    void bulk_restore_and_force_delete_apply_over_a_selection() {
        SoftRepo repo = new SoftRepo(List.of("1", "2", "3"), List.of("1", "2", "3"));
        ActionTester<Doc> tester = ActionTester.of(resource(repo), "admin", AdminAuthorizer.permitAll());

        BulkActionResult restored =
                tester.callBulkAction(new RestoreBulkAction<>(repo), List.of("1", "2"));
        assertThat(restored.successful()).isEqualTo(2);
        assertThat(repo.trashed).containsExactly("3");

        tester.callBulkAction(new ForceDeleteBulkAction<>(repo), List.of("3"));
        assertThat(repo.live).containsExactly("1", "2");
    }

    static Resource<Doc> resource(RecordRepository<Doc> repo) {
        return new Resource<>(repo) {
            @Override
            public String slug() {
                return "docs";
            }

            @Override
            public String label() {
                return "Docs";
            }

            @Override
            public Table<Doc> table() {
                return Table.<Doc>create().id(Doc::id).column("Id", Doc::id);
            }
        };
    }

    static final class SoftRepo implements SoftDeleteRepository<Doc> {
        final List<String> live;
        final List<String> trashed;

        SoftRepo(List<String> live, List<String> trashed) {
            this.live = new ArrayList<>(live);
            this.trashed = new ArrayList<>(trashed);
        }

        @Override
        public Page<Doc> page(Query query) {
            List<Doc> rows = live.stream().map(Doc::new).toList();
            return Page.of(rows, rows.size());
        }

        @Override
        public Optional<Doc> findById(String id) {
            return live.contains(id) ? Optional.of(new Doc(id)) : Optional.empty();
        }

        @Override
        public Doc create(Doc record) {
            live.add(record.id());
            return record;
        }

        @Override
        public Doc update(String id, Doc record) {
            return record;
        }

        @Override
        public void delete(String id) {
            if (live.contains(id)) {
                trashed.add(id); // soft delete = set the marker, row stays
            }
        }

        @Override
        public void restore(String id) {
            trashed.remove(id);
        }

        @Override
        public void forceDelete(String id) {
            live.remove(id);
            trashed.remove(id);
        }

        @Override
        public boolean isTrashed(Doc record) {
            return trashed.contains(record.id());
        }
    }
}
