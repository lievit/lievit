/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

import dev.lievit.component.LievitEffects;

/**
 * Specifies the relationship actions (the Filament {@code AttachAction}/{@code AssociateAction}/
 * {@code DetachAction}/{@code DissociateAction}): the linking variants open a record-select modal
 * (with attach-another) and link a related id to a parent through a {@link RelationshipRepository};
 * the unlinking variants remove the relation. The relation-manager UI surface is deferred; this
 * pins the action behaviour over the port.
 */
class RelationshipActionTest {

    /**
     * @spec.given an attach action over a relationship repository
     * @spec.when  it runs linking a tag to a post
     * @spec.then  the relation is created and a success notification flashes
     */
    @Test
    void attach_links_a_related_record_and_flashes() {
        Pivot repo = new Pivot();
        LievitEffects effects = LievitEffects.capturing();
        RelationshipAction<String> attach = RelationshipAction.attach(repo);

        attach.run("post-1", "tag-2", effects);

        assertThat(repo.links).containsExactly("post-1:tag-2");
        assertThat(effects.dispatched()).isNotEmpty();
    }

    /**
     * @spec.given a detach action over a relationship repository with an existing link
     * @spec.when  it runs unlinking the related record
     * @spec.then  the relation is removed
     */
    @Test
    void detach_unlinks_a_related_record() {
        Pivot repo = new Pivot();
        repo.attach("post-1", "tag-2");
        RelationshipAction<String> detach = RelationshipAction.detach(repo);

        detach.run("post-1", "tag-2", LievitEffects.capturing());

        assertThat(repo.links).isEmpty();
    }

    /**
     * @spec.given an attach action with attach-another set
     * @spec.when  its modal behaviour is read
     * @spec.then  it opens a modal, offers the attachable candidates, and keeps the modal open
     */
    @Test
    void attach_opens_a_select_modal_with_attach_another() {
        Pivot repo = new Pivot();
        repo.candidates.add("tag-1");
        repo.candidates.add("tag-2");
        RelationshipAction<String> attach = RelationshipAction.attach(repo).attachAnother();

        assertThat(attach.hasModal()).isTrue();
        assertThat(attach.keepsModalOpen()).isTrue();
        assertThat(attach.selectOptions("post-1")).containsExactly("tag-1", "tag-2");
    }

    /**
     * @spec.given the four relationship action factories
     * @spec.when  their kind and linking-ness are read
     * @spec.then  attach/associate link (with a modal); detach/dissociate unlink (no modal)
     */
    @Test
    void the_four_variants_carry_their_kind() {
        Pivot repo = new Pivot();

        assertThat(RelationshipAction.attach(repo).kind()).isEqualTo(RelationshipAction.Kind.ATTACH);
        assertThat(RelationshipAction.associate(repo).isLinking()).isTrue();
        assertThat(RelationshipAction.detach(repo).isLinking()).isFalse();
        assertThat(RelationshipAction.dissociate(repo).hasModal()).isFalse();
        // an unlink action offers no select options
        assertThat(RelationshipAction.detach(repo).selectOptions("post-1")).isEmpty();
    }

    /** A trivial in-memory many-to-many pivot keyed {@code parent:related}. */
    static final class Pivot implements RelationshipRepository<String> {
        final List<String> links = new ArrayList<>();
        final List<String> candidates = new ArrayList<>();

        @Override
        public List<String> related(String parentId) {
            return links.stream().filter(l -> l.startsWith(parentId + ":")).toList();
        }

        @Override
        public List<String> attachable(String parentId) {
            return new ArrayList<>(candidates);
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
}
