/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.constraints.NotBlank;

import org.junit.jupiter.api.Test;

/**
 * Specifies modal-with-form actions (the Filament {@code HasSchema} + {@code HasData} +
 * {@code CanSubmitForm} composition): an action carries a {@link Form}, opens a modal, validates the
 * submitted state on submit, routes the validated record into a custom process, and re-renders the
 * modal with field errors on a validation failure.
 */
class FormActionTest {

    record Message(String to, @NotBlank String subject) {}

    static final FormBinder<Message> BINDER =
            new FormBinder<>() {
                @Override
                public Message toRecord(Message existing, Map<String, String> state) {
                    return new Message(state.getOrDefault("to", ""), state.getOrDefault("subject", ""));
                }

                @Override
                public Map<String, String> toState(Message record) {
                    Map<String, String> s = new LinkedHashMap<>();
                    s.put("to", record.to());
                    s.put("subject", record.subject());
                    return s;
                }
            };

    static Validator validator() {
        return Validation.buildDefaultValidatorFactory().getValidator();
    }

    /**
     * @spec.given a form action with a valid submission
     * @spec.when  the action runs
     * @spec.then  the validated record reaches the process body and the action completes
     */
    @Test
    void valid_form_data_reaches_the_process_body() {
        AtomicReference<Message> processed = new AtomicReference<>();
        Form<Message> form =
                Form.<Message>create()
                        .field("to")
                        .field("subject")
                        .binder(BINDER)
                        .validator(new FormValidator(validator()));
        FormAction<Message> action =
                FormAction.make(
                        "send",
                        "Send",
                        AdminOperation.UPDATE,
                        form,
                        (record, ctx) -> processed.set(record));

        ActionTester<Message> tester =
                ActionTester.of(resource(), "admin", AdminAuthorizer.permitAll());
        AdminActionResult result =
                tester.callAction(action, null, Map.of("to", "ada@x", "subject", "Hi"));

        tester.assertActionCompleted(result);
        assertThat(processed.get()).isEqualTo(new Message("ada@x", "Hi"));
    }

    /**
     * @spec.given a form action whose submission fails validation
     * @spec.when  the action runs
     * @spec.then  it halts with INVALID and the process body never runs
     */
    @Test
    void invalid_form_data_halts_the_action_with_errors() {
        AtomicReference<Message> processed = new AtomicReference<>();
        Form<Message> form =
                Form.<Message>create()
                        .field("to")
                        .field("subject")
                        .binder(BINDER)
                        .validator(new FormValidator(validator()));
        FormAction<Message> action =
                FormAction.make(
                        "send",
                        "Send",
                        AdminOperation.UPDATE,
                        form,
                        (record, ctx) -> processed.set(record));

        ActionTester<Message> tester =
                ActionTester.of(resource(), "admin", AdminAuthorizer.permitAll());
        AdminActionResult result =
                tester.callAction(action, null, Map.of("to", "ada@x", "subject", "  "));

        tester.assertActionHalted(result);
        assertThat(result.status()).isEqualTo(AdminActionResult.Status.INVALID);
        assertThat(processed.get()).isNull();
    }

    /**
     * @spec.given a form action configured to open as a slide-over with a heading
     * @spec.when  its modal config is read
     * @spec.then  the modal opens, slides over, and carries the heading
     */
    @Test
    void a_form_action_opens_a_configured_modal() {
        FormAction<Message> action =
                FormAction.make(
                                "send",
                                "Send",
                                AdminOperation.UPDATE,
                                Form.<Message>create().field("to").binder(BINDER),
                                (record, ctx) -> {})
                        .modal(ModalConfig.defaults().heading("Compose").asSlideOver());

        assertThat(action.opensModal()).isTrue();
        assertThat(action.modal().heading()).isEqualTo("Compose");
        assertThat(action.modal().slideOver()).isTrue();
    }

    static Resource<Message> resource() {
        RecordRepository<Message> repo =
                new RecordRepository<>() {
                    @Override
                    public Page<Message> page(Query query) {
                        return Page.of(java.util.List.of(), 0);
                    }

                    @Override
                    public Optional<Message> findById(String id) {
                        return Optional.empty();
                    }

                    @Override
                    public Message create(Message record) {
                        return record;
                    }

                    @Override
                    public Message update(String id, Message record) {
                        return record;
                    }

                    @Override
                    public void delete(String id) {}
                };
        return new Resource<>(repo) {
            @Override
            public String slug() {
                return "messages";
            }

            @Override
            public String label() {
                return "Messages";
            }

            @Override
            public Table<Message> table() {
                return Table.<Message>create().column("To", Message::to);
            }
        };
    }
}
