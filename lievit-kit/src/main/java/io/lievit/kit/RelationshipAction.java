/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.List;
import java.util.Objects;

import io.lievit.component.LievitEffects;

/**
 * A relation-manager action that links or unlinks related records to a parent (the Filament
 * {@code AttachAction}/{@code AssociateAction}/{@code DetachAction}/{@code DissociateAction}). Unlike
 * an {@link AdminAction} (which targets the resource's own record), a relationship action operates
 * over a {@link RelationshipRepository} between a parent id and a related id, so it carries its own
 * run shape. The Attach/Detach variant is many-to-many (a pivot); Associate/Dissociate is
 * one-to-many (a foreign key); both run through the same port (see {@link RelationshipRepository}).
 *
 * <p>Built via the factories ({@link #attach}/{@link #associate}/{@link #detach}/{@link #dissociate});
 * the {@code attach}/{@code associate} variants open a modal with a record select and an
 * {@linkplain #attachAnother() attach-another} flag, then call
 * {@link RelationshipRepository#attach}; the {@code detach}/{@code dissociate} variants call
 * {@link RelationshipRepository#detach}.
 *
 * @param <R> the related-record type
 */
public final class RelationshipAction<R> {

    /** Whether the action links (attach/associate) or unlinks (detach/dissociate). */
    public enum Kind {
        /** Many-to-many link (pivot). */
        ATTACH,
        /** One-to-many link (foreign key). */
        ASSOCIATE,
        /** Many-to-many unlink (pivot). */
        DETACH,
        /** One-to-many unlink (foreign key). */
        DISSOCIATE
    }

    private final String name;
    private final String label;
    private final Kind kind;
    private final RelationshipRepository<R> repository;
    private boolean attachAnother;

    private RelationshipAction(
            String name, String label, Kind kind, RelationshipRepository<R> repository) {
        this.name = Objects.requireNonNull(name, "name");
        this.label = Objects.requireNonNull(label, "label");
        this.kind = Objects.requireNonNull(kind, "kind");
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    /**
     * @param repository the relationship port
     * @param <R> the related type
     * @return an attach action (many-to-many, opens a record-select modal)
     */
    public static <R> RelationshipAction<R> attach(RelationshipRepository<R> repository) {
        return new RelationshipAction<>("attach", "Attach", Kind.ATTACH, repository);
    }

    /**
     * @param repository the relationship port
     * @param <R> the related type
     * @return an associate action (one-to-many, opens a record-select modal)
     */
    public static <R> RelationshipAction<R> associate(RelationshipRepository<R> repository) {
        return new RelationshipAction<>("associate", "Associate", Kind.ASSOCIATE, repository);
    }

    /**
     * @param repository the relationship port
     * @param <R> the related type
     * @return a detach action (many-to-many unlink)
     */
    public static <R> RelationshipAction<R> detach(RelationshipRepository<R> repository) {
        return new RelationshipAction<>("detach", "Detach", Kind.DETACH, repository);
    }

    /**
     * @param repository the relationship port
     * @param <R> the related type
     * @return a dissociate action (one-to-many unlink)
     */
    public static <R> RelationshipAction<R> dissociate(RelationshipRepository<R> repository) {
        return new RelationshipAction<>("dissociate", "Dissociate", Kind.DISSOCIATE, repository);
    }

    /**
     * Keeps the attach modal open after a successful attach so the user can attach another (the
     * Filament {@code attachAnother}). Only meaningful for the linking variants.
     *
     * @return this action
     */
    public RelationshipAction<R> attachAnother() {
        this.attachAnother = true;
        return this;
    }

    /** @return the stable action name */
    public String name() {
        return name;
    }

    /** @return the button label */
    public String label() {
        return label;
    }

    /** @return the action kind */
    public Kind kind() {
        return kind;
    }

    /** @return whether the action links (attach/associate) rather than unlinks */
    public boolean isLinking() {
        return kind == Kind.ATTACH || kind == Kind.ASSOCIATE;
    }

    /** @return whether the attach modal stays open after a successful attach */
    public boolean keepsModalOpen() {
        return attachAnother && isLinking();
    }

    /** @return whether this action opens a record-select modal (the linking variants do) */
    public boolean hasModal() {
        return isLinking();
    }

    /**
     * The select options the attach modal offers (the attachable candidates). Empty for an unlink
     * action, which targets an already-related record instead.
     *
     * @param parentId the parent record id
     * @return the attachable candidates, or empty for an unlink action
     */
    public List<R> selectOptions(String parentId) {
        return isLinking() ? repository.attachable(parentId) : List.of();
    }

    /**
     * Runs the action between a parent and a related id, then flashes a success notification onto the
     * effects sink. The linking variants attach; the unlinking variants detach.
     *
     * @param parentId the parent record id
     * @param relatedId the related record id (the selected option for a link; the related record for
     *     an unlink)
     * @param effects the per-call effects sink to flash onto
     */
    public void run(String parentId, String relatedId, LievitEffects effects) {
        Objects.requireNonNull(parentId, "parentId");
        Objects.requireNonNull(relatedId, "relatedId");
        Objects.requireNonNull(effects, "effects");
        if (isLinking()) {
            repository.attach(parentId, relatedId);
            AdminNotification.success("Attached.").flashOnto(effects);
        } else {
            repository.detach(parentId, relatedId);
            AdminNotification.success("Detached.").flashOnto(effects);
        }
    }
}
