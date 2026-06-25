/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.List;

/**
 * The port a relation manager reads/writes a parent record's related records through (the data side
 * of Filament's {@code RelationManager} + the Attach/Associate/Detach/Dissociate actions). Like
 * {@link RecordRepository}, the kit never hard-codes the relation mechanism: the adopter implements
 * the attach/detach over a pivot table (many-to-many) or a foreign key (one-to-many), and the kit's
 * relationship actions only call this contract.
 *
 * <p>"Attach"/"Detach" is the many-to-many pivot language; "Associate"/"Dissociate" is the
 * one-to-many foreign-key language. The two action pairs share this single port because the kit-side
 * shape is identical (link/unlink a related id to a parent); the distinction is the adopter's
 * implementation and the action labels.
 *
 * @param <R> the related-record type
 */
public interface RelationshipRepository<R> {

    /**
     * Lists the records currently related to a parent.
     *
     * @param parentId the parent record id
     * @return the related records
     */
    List<R> related(String parentId);

    /**
     * Lists the candidate records that could be attached to a parent (the attach modal's select
     * options: typically all records of the related resource not already related).
     *
     * @param parentId the parent record id
     * @return the attachable candidates
     */
    List<R> attachable(String parentId);

    /**
     * Links a related record to a parent (attach / associate). A no-op if already linked.
     *
     * @param parentId the parent record id
     * @param relatedId the related record id
     */
    void attach(String parentId, String relatedId);

    /**
     * Unlinks a related record from a parent (detach / dissociate). A no-op if not linked.
     *
     * @param parentId the parent record id
     * @param relatedId the related record id
     */
    void detach(String parentId, String relatedId);
}
