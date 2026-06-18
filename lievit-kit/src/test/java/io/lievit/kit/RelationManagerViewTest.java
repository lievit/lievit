/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

/**
 * Specifies the relation-manager UI page view-model: the related-records {@link Table} page that
 * uses the {@link RelationshipRepository} data port and the {@link RelationshipAction}s that already
 * landed. {@link RelationManagerView} reads one parent's related records, renders them with the
 * supplied column DSL, and surfaces the linking actions in the header and the unlink action per row.
 */
class RelationManagerViewTest {

    private record Tag(String id, String name) {}

    /** A trivial in-memory many-to-many pivot keyed {@code parent:related}, with a record table. */
    private static final class TagPivot implements RelationshipRepository<Tag> {
        final List<String> links = new ArrayList<>();
        final List<Tag> all = new ArrayList<>();

        @Override
        public List<Tag> related(String parentId) {
            List<Tag> out = new ArrayList<>();
            for (Tag t : all) {
                if (links.contains(parentId + ":" + t.id())) {
                    out.add(t);
                }
            }
            return out;
        }

        @Override
        public List<Tag> attachable(String parentId) {
            return new ArrayList<>(all);
        }

        @Override
        public void attach(String parentId, String relatedId) {
            String key = parentId + ":" + relatedId;
            if (!links.contains(key)) {
                links.add(key);
            }
        }

        @Override
        public void detach(String parentId, String relatedId) {
            links.remove(parentId + ":" + relatedId);
        }
    }

    /**
     * @spec.given a parent with two related tags and a tag table with one column
     * @spec.when  the relation-manager view is built over the relationship port
     * @spec.then  it renders one row per related record with the column cells and the parent id
     */
    @Test
    void renders_a_parent_s_related_records_as_a_table() {
        TagPivot repo = new TagPivot();
        repo.all.add(new Tag("t1", "java"));
        repo.all.add(new Tag("t2", "spring"));
        repo.all.add(new Tag("t3", "kafka"));
        repo.attach("post-1", "t1");
        repo.attach("post-1", "t3");

        Table<Tag> table = Table.<Tag>create().id(Tag::id).column("Name", Tag::name);

        RelationManagerView view =
                RelationManagerView.of(
                        "Tags",
                        "post-1",
                        repo,
                        table,
                        List.of(RelationshipAction.attach(repo), RelationshipAction.detach(repo)));

        assertThat(view.heading()).isEqualTo("Tags");
        assertThat(view.parentId()).isEqualTo("post-1");
        assertThat(view.headers()).containsExactly("Name");
        assertThat(view.rows()).extracting(RelationManagerView.Row::id).containsExactly("t1", "t3");
        assertThat(view.rows().get(0).cells()).containsExactly("java");
    }

    /**
     * @spec.given the attach (linking) and detach (unlinking) actions for a relation
     * @spec.when  the view derives its action surface
     * @spec.then  the linking action sits in the header and the unlinking action is the per-row label
     */
    @Test
    void surfaces_linking_actions_in_the_header_and_the_unlink_action_per_row() {
        TagPivot repo = new TagPivot();
        Table<Tag> table = Table.<Tag>create().id(Tag::id).column("Name", Tag::name);

        RelationManagerView view =
                RelationManagerView.of(
                        "Tags",
                        "post-1",
                        repo,
                        table,
                        List.of(RelationshipAction.attach(repo).attachAnother(), RelationshipAction.detach(repo)));

        assertThat(view.headerActions()).containsExactly("Attach");
        assertThat(view.rowActionLabel()).isEqualTo("Detach");
        assertThat(view.rows()).isEmpty();
    }
}
