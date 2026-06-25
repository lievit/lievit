/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.wire;

import java.util.LinkedHashMap;
import java.util.Map;

import dev.lievit.LievitAction;
import dev.lievit.LievitComponent;
import dev.lievit.Wire;
import dev.lievit.component.LievitEffects;
import dev.lievit.kit.AdminActionContext;
import dev.lievit.kit.AdminActionResult;
import dev.lievit.kit.AdminAuthorizer;
import dev.lievit.kit.AdminRoutes;
import dev.lievit.kit.FormAction;
import dev.lievit.kit.ModalConfig;
import dev.lievit.kit.Resource;

/**
 * A wire host that drives a {@link FormAction}'s modal lifecycle end-to-end through the real runtime
 * (the Filament action-modal mount lifecycle parity): open mounts + fills the modal (honouring
 * {@code mountUsing}), submit runs the full action lifecycle ({@code before()} + halt, the body, then
 * {@code after()} + the per-action success/failure notifications onto the effects channel). Its
 * {@code lievit/action-modal} template renders the deepened {@link ModalConfig} (width token, icon +
 * colour, alignment, sticky header/footer, close button, content fragments, extra footer actions)
 * and the form fields (read-only when {@link FormAction#isFormDisabled() disabledForm}).
 *
 * <p>The hosted action is supplied at construction (the test app wires a fixture); the open/submit
 * state round-trips through the snapshot, the modal config + filled state are recomputed each render.
 */
@LievitComponent(template = "lievit/action-modal")
public class ActionModalComponent {

    private final FormAction<dev.lievit.kit.wire.ActionFixtures.Message> action;
    private final Resource<dev.lievit.kit.wire.ActionFixtures.Message> resource;

    /** Modal open state, server-owned (the action-modal mount/unmount). */
    @Wire public boolean open = false;

    /** The filled form state (round-trips; the wire {@code l:model} binds each field). */
    @Wire public Map<String, String> state = new LinkedHashMap<>();

    /**
     * @param action the form action whose modal lifecycle this drives
     * @param resource the resource the action targets
     */
    public ActionModalComponent(
            FormAction<dev.lievit.kit.wire.ActionFixtures.Message> action,
            Resource<dev.lievit.kit.wire.ActionFixtures.Message> resource) {
        this.action = action;
        this.resource = resource;
    }

    /** Opens the modal and fills it via the action's mount lifecycle ({@code mountUsing} / record). */
    @LievitAction
    public void open() {
        this.state = new LinkedHashMap<>(action.fill(null));
        this.open = true;
    }

    /**
     * Submits the modal: runs the full action lifecycle against the filled state. The effects
     * (success/failure notification, redirect) ride the response's {@code Lievit-Effects} channel;
     * on a non-halting completion the modal closes.
     */
    @LievitAction
    public void submit() {
        AdminActionContext<dev.lievit.kit.wire.ActionFixtures.Message> context =
                new AdminActionContext<>(
                        resource,
                        AdminRoutes.of("admin", resource),
                        AdminAuthorizer.permitAll(),
                        LievitEffects.current(),
                        null,
                        state);
        AdminActionResult result = action.run(context);
        if (result.isCompleted() || result.isNavigation()) {
            this.open = false;
        }
    }

    /** @return the hosted action (its modal config + form the template renders) */
    public FormAction<dev.lievit.kit.wire.ActionFixtures.Message> action() {
        return action;
    }

    /** @return the action's modal config (the deepened {@link ModalConfig} the template paints) */
    public ModalConfig modal() {
        return action.modal();
    }
}
