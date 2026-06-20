/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.wire;

import jakarta.validation.Validation;
import jakarta.validation.Validator;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

import io.lievit.kit.AdminOperation;
import io.lievit.kit.Form;
import io.lievit.kit.FormValidator;
import io.lievit.kit.WizardAction;
import io.lievit.kit.wire.ActionFixtures.Message;

/**
 * Minimal Spring Boot app for the multistep wizard-action wire end-to-end test (the Filament
 * {@code Action::steps([...])} parity, the audit's "action wizards" row). It wires ONE
 * {@link WizardAction} over the {@link Message} fixture with two steps:
 *
 * <ul>
 *   <li><b>step 1 "Subject"</b> requires the {@code subject} field (the per-step Next gate);
 *   <li><b>step 2 "Body"</b> has no required field; its Finish submits the accumulated state.
 * </ul>
 *
 * The backing {@link Form} carries the binder + a bean-validation {@link FormValidator} so the
 * final-step submit binds the accumulated state into a {@link Message} and validates it
 * ({@code subject} is {@code @NotBlank}). {@link WizardActionComponentIT} drives mount -> Next-gate
 * -> Previous -> Finish through the real runtime.
 */
@SpringBootApplication
public class WizardActionWireTestApp {

    /**
     * @return the validator backing the form's {@link FormValidator}
     */
    static Validator validator() {
        return Validation.buildDefaultValidatorFactory().getValidator();
    }

    /**
     * The fixture wizard: two steps over the message form, the first gating on {@code subject}.
     *
     * @return the wizard action
     */
    static WizardAction<Message> fixtureWizard() {
        Form<Message> form =
                Form.<Message>create()
                        .field("subject")
                        .field("body")
                        .binder(ActionFixtures.BINDER)
                        .validator(new FormValidator(validator()));
        return WizardAction.<Message>make(
                        "compose",
                        "Compose",
                        AdminOperation.CREATE,
                        form,
                        (record, ctx) -> {
                            // The process is a no-op: the IT asserts the submit reached completion
                            // (modal closed), not a side effect.
                        })
                .steps(
                        WizardAction.Step.make("Subject")
                                .description("Who and what")
                                .requires("subject"),
                        WizardAction.Step.make("Body").description("The message"));
    }

    /**
     * @return a fresh wizard component per wire call (the stateless wire contract; the cursor
     *     round-trips in {@code stepIndex}). The {@link Resource} is built inline rather than exposed
     *     as a bean: the sibling action-modal {@code @SpringBootApplication} already publishes a
     *     {@code Resource<Message>}, and the two test apps share this package's component scan, so a
     *     second {@code Resource<Message>} bean would make the autowire ambiguous.
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    WizardActionComponent wizardActionComponent() {
        return new WizardActionComponent(fixtureWizard(), ActionFixtures.resource());
    }
}
