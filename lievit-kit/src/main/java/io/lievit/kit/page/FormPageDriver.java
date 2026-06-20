/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.page;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

import io.lievit.component.LievitEffects;
import io.lievit.kit.AdminAction;
import io.lievit.kit.AdminActionContext;
import io.lievit.kit.AdminActionResult;
import io.lievit.kit.AdminAuthorizer;
import io.lievit.kit.AdminFormView;
import io.lievit.kit.AdminRoutes;
import io.lievit.kit.CreateAction;
import io.lievit.kit.EditAction;
import io.lievit.kit.FieldError;
import io.lievit.kit.Form;
import io.lievit.kit.Resource;

/**
 * The reusable logic of the full-page <strong>Create</strong> and <strong>Edit</strong> pages (the
 * Filament {@code CreateRecord} / {@code EditRecord}, full-page mode), factored out of the wire
 * component for the same reason as {@link ListPageDriver}: the lievit core binds only the wire
 * fields + actions declared on the component class itself, so a concrete {@code @LievitComponent}
 * declares its own and delegates here.
 *
 * <p>The driver owns: prefilling the edit form from a record, and running the submit action
 * ({@link CreateAction} / {@link EditAction}) which validates, persists, and on success flashes +
 * redirects. A validation failure comes back as an {@link Outcome} that carries the re-render view
 * (submitted values + field errors) so the page does not lose the user's input.
 *
 * @param <T> the resource row type
 */
public final class FormPageDriver<T> {

    private final Resource<T> resource;
    private final String panelId;
    private final AdminAuthorizer authorizer;

    /**
     * @param resource the admin resource
     * @param panelId the owning panel id (the route prefix)
     * @param authorizer the authorization seam
     */
    public FormPageDriver(Resource<T> resource, String panelId, AdminAuthorizer authorizer) {
        this.resource = Objects.requireNonNull(resource, "resource");
        this.panelId = Objects.requireNonNull(panelId, "panelId");
        this.authorizer = Objects.requireNonNull(authorizer, "authorizer");
    }

    /**
     * @return a blank create-form view-model
     */
    public AdminFormView createView() {
        return AdminFormView.forCreate(resource.form());
    }

    /**
     * Prefills the edit form from the record with the given id.
     *
     * @param id the record id
     * @return the prefilled state + view, or a blank create-style view if the record is gone
     */
    public Prefill editPrefill(String id) {
        Form<T> form = resource.form();
        @Nullable T record = resource.repository().findById(id).orElse(null);
        if (record == null) {
            return new Prefill(new LinkedHashMap<>(), AdminFormView.forCreate(form));
        }
        Map<String, String> state = new LinkedHashMap<>(form.stateOf(record));
        return new Prefill(state, AdminFormView.forEdit(form, record));
    }

    /**
     * Runs the create submit against the submitted state.
     *
     * @param state the submitted field values
     * @param effects the current wire-call effects sink
     * @return the outcome (completed -> effects queued; invalid / forbidden -> a re-render view)
     */
    public Outcome submitCreate(Map<String, String> state, LievitEffects effects) {
        return submit(new CreateAction<>(resource.form()), null, state, effects, false);
    }

    /**
     * Runs the edit submit against the submitted state.
     *
     * @param id the id of the record being edited
     * @param state the submitted field values
     * @param effects the current wire-call effects sink
     * @return the outcome
     */
    public Outcome submitEdit(String id, Map<String, String> state, LievitEffects effects) {
        return submit(new EditAction<>(resource.form()), id, state, effects, true);
    }

    private Outcome submit(
            AdminAction<T> action,
            @Nullable String id,
            Map<String, String> state,
            LievitEffects effects,
            boolean editing) {
        Objects.requireNonNull(state, "state");
        Objects.requireNonNull(effects, "effects");
        AdminActionContext<T> context =
                new AdminActionContext<>(
                        resource, AdminRoutes.of(panelId, resource), authorizer, effects, id, state);
        AdminActionResult result = action.run(context);
        return switch (result.status()) {
            // COMPLETED and NAVIGATE both queued their effect (redirect / navigation): the page is
            // done. A form submit does not navigate, but the switch must stay exhaustive.
            case COMPLETED, NAVIGATE -> new Outcome(result, null);
            // HALTED: a before()-hook stopped the action without writing; re-render the form as-is.
            case HALTED ->
                    new Outcome(
                            result, AdminFormView.of(resource.form(), editing, state, List.of()));
            case INVALID ->
                    new Outcome(
                            result,
                            AdminFormView.withErrors(resource.form(), editing, state, result.errors()));
            case FORBIDDEN ->
                    new Outcome(
                            result,
                            AdminFormView.withErrors(
                                    resource.form(),
                                    editing,
                                    state,
                                    List.of(
                                            FieldError.of(
                                                    "", "You are not allowed to perform this action."))));
        };
    }

    /** @return the resource's CRUD routes under the owning panel */
    public AdminRoutes routes() {
        return AdminRoutes.of(panelId, resource);
    }

    /**
     * The prefilled edit state: the field values to seed the wire {@code state} map plus the view to
     * render.
     *
     * @param state the field values keyed by field name
     * @param view the form view-model
     */
    public record Prefill(Map<String, String> state, AdminFormView view) {
        /** Compact constructor: copies the state map. */
        public Prefill {
            state = Map.copyOf(state);
        }
    }

    /**
     * The submit outcome: the underlying {@link AdminActionResult} plus, when the submit did not
     * complete, the view to re-render (with the submitted values and the errors). On completion the
     * effects (flash + redirect) are already queued and {@link #reRender()} is {@code null}.
     *
     * @param result the action result
     * @param reRender the view to re-render on a non-completed submit, or {@code null} on completion
     */
    public record Outcome(AdminActionResult result, @Nullable AdminFormView reRender) {

        /** @return whether the submit completed (effects queued; the page will navigate) */
        public boolean isCompleted() {
            return result.isCompleted();
        }
    }
}
