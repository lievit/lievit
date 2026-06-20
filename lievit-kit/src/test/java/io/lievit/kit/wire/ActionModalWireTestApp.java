/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.wire;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

import io.lievit.kit.AdminNotification;
import io.lievit.kit.AdminOperation;
import io.lievit.kit.Form;
import io.lievit.kit.FormAction;
import io.lievit.kit.ModalConfig;
import io.lievit.kit.ModalWidth;
import io.lievit.kit.Resource;
import io.lievit.kit.wire.ActionFixtures.Message;

/**
 * Minimal Spring Boot app for the action-modal lifecycle + modal-deepening + forms wire ITs. It
 * wires ONE rich {@link FormAction} fixture exercising the audit's "action modals" / "action forms"
 * / "action lifecycle" sub-features in one place:
 *
 * <ul>
 *   <li><b>modal deepening</b>: width enum (LARGE), icon + colour, centre alignment, sticky
 *       header/footer, an explicit close button, content fragments above/below the schema, and an
 *       extra footer-action label.
 *   <li><b>forms</b>: {@code disabledForm()} (read-only fields) + {@code mountUsing()} prefill.
 *   <li><b>lifecycle</b>: a {@code before()} hook that halts when the subject is blank, an
 *       {@code after()} hook, and a per-action success notification.
 * </ul>
 */
@SpringBootApplication
public class ActionModalWireTestApp {

    static FormAction<Message> fixtureAction() {
        Form<Message> form =
                Form.<Message>create()
                        .field("to")
                        .field("subject")
                        .field("body")
                        .binder(ActionFixtures.BINDER);
        ModalConfig modal =
                ModalConfig.defaults()
                        .heading("Send message")
                        .description("Compose and send")
                        .width(ModalWidth.LARGE)
                        .icon("bell", "warning")
                        .alignment("center")
                        .sticky()
                        .footer("Send", "Discard")
                        .content("legal-notice", "delivery-note")
                        .extraFooterActions(List.of("Save draft"));
        FormAction<Message> action =
                FormAction.make(
                                "send",
                                "Send",
                                AdminOperation.UPDATE,
                                form,
                                (record, ctx) ->
                                        AdminNotification.info("Queued for " + record.to())
                                                .flashOnto(ctx.effects()))
                        .modal(modal)
                        .disabledForm();
        // The lifecycle setters are declared on AdminAction (they return AdminAction<T>); set them
        // as statements so the fixture keeps its FormAction<Message> type.
        action.mountUsing(record -> Map.of("to", "team@example.com"));
        // before() halts the action when the subject is still blank (Filament $action->halt()).
        action.before(
                ctx -> {
                    if (ctx.formState().getOrDefault("subject", "").isBlank()) {
                        ctx.halt();
                    }
                });
        // after() + success notification fire only on a non-halting completion.
        action.after(ctx -> AdminNotification.success("Sent").flashOnto(ctx.effects()));
        action.successNotification(ctx -> AdminNotification.success("Message sent successfully"));
        return action;
    }

    /**
     * @return the message resource (the modal action target)
     */
    @Bean
    Resource<Message> messageResource() {
        return ActionFixtures.resource();
    }

    /**
     * @param resource the message resource
     * @return a fresh action-modal component per wire call, over the fixture action
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    ActionModalComponent actionModalComponent(Resource<Message> resource) {
        return new ActionModalComponent(fixtureAction(), resource);
    }
}
