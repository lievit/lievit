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
 * Specifies {@link DetachBulkAction} (the Filament {@code DetachBulkAction}, named in issue 251):
 * detaches every authorized selected related record from a parent through a
 * {@link RelationshipRepository}, the relation-manager bulk counterpart of {@link RelationshipAction}
 * detach. Runs through the shared {@link BulkAction} loop so it reuses authorization, chunking, and
 * deselect-after-completion.
 */
class DetachBulkActionTest {

    record Tag(String id) {}

    /**
     * @spec.given a detach-bulk action bound to parent "p1" and a selection of two related ids
     * @spec.when  it runs under a permit-all authorizer
     * @spec.then  both related records are detached from the parent and counted as successes
     */
    @Test
    void detaches_the_selected_related_records_from_the_parent() {
        RecordingRelationRepo rel = new RecordingRelationRepo();
        DetachBulkAction<Tag> action = new DetachBulkAction<>(rel, "p1");
        ActionTester<Tag> tester =
                ActionTester.of(resource(List.of("t1", "t2", "t3")), "admin", AdminAuthorizer.permitAll());

        BulkActionResult result = tester.callBulkAction(action, List.of("t1", "t2"));

        assertThat(result.successful()).isEqualTo(2);
        assertThat(rel.detached).containsExactly("p1:t1", "p1:t2");
    }

    /**
     * @spec.given a detach-bulk action
     * @spec.when  its flags and identity are read
     * @spec.then  it is a named bulk action that deselects after completion (no destructive confirm)
     */
    @Test
    void detach_bulk_has_the_expected_identity() {
        DetachBulkAction<Tag> action = new DetachBulkAction<>(new RecordingRelationRepo(), "p1");

        assertThat(action.name()).isEqualTo("detach-selected");
        assertThat(action.deselectsAfterCompletion()).isTrue();
    }

    static final class RecordingRelationRepo implements RelationshipRepository<Tag> {
        final List<String> detached = new ArrayList<>();

        @Override
        public List<Tag> related(String parentId) {
            return List.of();
        }

        @Override
        public List<Tag> attachable(String parentId) {
            return List.of();
        }

        @Override
        public void attach(String parentId, String relatedId) {}

        @Override
        public void detach(String parentId, String relatedId) {
            detached.add(parentId + ":" + relatedId);
        }
    }

    static Resource<Tag> resource(List<String> ids) {
        RecordRepository<Tag> repo =
                new RecordRepository<>() {
                    @Override
                    public Page<Tag> page(Query query) {
                        List<Tag> rows = ids.stream().map(Tag::new).toList();
                        return Page.of(rows, rows.size());
                    }

                    @Override
                    public Optional<Tag> findById(String id) {
                        return ids.contains(id) ? Optional.of(new Tag(id)) : Optional.empty();
                    }

                    @Override
                    public Tag create(Tag record) {
                        return record;
                    }

                    @Override
                    public Tag update(String id, Tag record) {
                        return record;
                    }

                    @Override
                    public void delete(String id) {}
                };
        return new Resource<>(repo) {
            @Override
            public String slug() {
                return "tags";
            }

            @Override
            public String label() {
                return "Tags";
            }

            @Override
            public Table<Tag> table() {
                return Table.<Tag>create().id(Tag::id).column("Id", Tag::id);
            }
        };
    }
}
