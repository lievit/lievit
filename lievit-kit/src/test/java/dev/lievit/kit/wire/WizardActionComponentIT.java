/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.wire;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import dev.lievit.spring.LievitWireService;
import dev.lievit.spring.WireCallResult;

/**
 * The multistep wizard-action (Filament {@code Action::steps([...])} parity, the audit's "action
 * wizards" row) end-to-end gate: a {@link dev.lievit.kit.WizardAction} driven through the REAL lievit
 * runtime by {@link WizardActionComponent}. It proves a wizard INSIDE an action modal renders its
 * step progress strip with the active step marked, that Next is GATED on the current step's required
 * field (it does not advance while {@code subject} is blank, it does once filled), that Previous
 * walks back, and that the final-step Finish binds the accumulated state and completes (closing the
 * modal).
 *
 * <p>It boots a Spring context, so it is an {@code *IT} (the failsafe loop, ADR-0007).
 */
@SpringBootTest(classes = WizardActionWireTestApp.class)
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class WizardActionComponentIT {

    @Autowired LievitWireService wireService;

    private static final String COMPONENT = WizardActionComponent.class.getName();

    /**
     * @spec.given a two-step wizard action (Subject, Body) over a record
     * @spec.when  the wizard modal is opened through the real runtime
     * @spec.then  the modal renders its step progress strip with both steps, the FIRST step marked
     *     active (aria-current="step") and a Next affordance (not Finish), proving the wizard's
     *     multistep modal + progress strip render (the audit's "action wizards" row)
     * @spec.us   US-action-wizards
     */
    @Test
    void renders_the_wizard_step_strip_with_the_first_step_active() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        WireCallResult opened =
                wireService.call(mounted.snapshot(), Map.of(), List.of("open"), "test-client");

        assertThat(opened.html())
                .contains("data-lv-wizard-action")
                .contains("role=\"dialog\"")
                .contains("aria-modal=\"true\"")
                .contains("data-lv-wizard-step=\"Subject\"")
                .contains("data-lv-wizard-step=\"Body\"")
                .containsPattern(
                        "data-lv-wizard-step=\"Subject\"[\\s\\S]*?data-lv-wizard-step-active=\"true\"")
                .containsPattern(
                        "data-lv-wizard-step=\"Subject\"[\\s\\S]*?aria-current=\"step\"")
                .contains("data-lv-wizard-next")
                // The first step is not the last: no Finish yet.
                .doesNotContain("data-lv-wizard-submit");
    }

    /**
     * @spec.given the wizard sits on step 1, whose required field {@code subject} is still blank
     * @spec.when  Next is invoked with a blank subject
     * @spec.then  the wizard STAYS on step 1 (the server-enforced per-step gate refused to advance):
     *     Subject is still the active step and the Next button is still shown, proving the per-step
     *     required-field gate (the wizard's defining sub-feature)
     * @spec.us   US-action-wizards
     */
    @Test
    void next_is_gated_on_the_current_step_required_field() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        WireCallResult opened =
                wireService.call(mounted.snapshot(), Map.of(), List.of("open"), "test-client");

        WireCallResult blocked =
                wireService.call(opened.snapshot(), Map.of(), List.of("next"), "test-client");

        assertThat(blocked.html())
                .containsPattern(
                        "data-lv-wizard-step=\"Subject\"[\\s\\S]*?data-lv-wizard-step-active=\"true\"")
                .contains("data-lv-wizard-next")
                .doesNotContain("data-lv-wizard-submit");
    }

    /**
     * @spec.given the wizard on step 1 with {@code subject} now filled
     * @spec.when  Next is invoked, then Previous
     * @spec.then  Next advances to step 2 (Body active, Finish shown), and Previous walks back to
     *     step 1 (Subject active, Next shown again): proving Next/Previous navigation across the gated
     *     boundary (the wizard's defining sub-feature)
     * @spec.us   US-action-wizards
     */
    @Test
    void next_advances_when_filled_and_previous_walks_back() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        WireCallResult opened =
                wireService.call(mounted.snapshot(), Map.of(), List.of("open"), "test-client");

        WireCallResult advanced =
                wireService.call(
                        opened.snapshot(),
                        Map.of("state", Map.of("subject", "Welcome")),
                        List.of("next"),
                        "test-client");

        assertThat(advanced.html())
                .containsPattern(
                        "data-lv-wizard-step=\"Body\"[\\s\\S]*?data-lv-wizard-step-active=\"true\"")
                .contains("data-lv-wizard-submit")
                .contains("data-lv-wizard-previous")
                .doesNotContain("data-lv-wizard-next");

        WireCallResult back =
                wireService.call(
                        advanced.snapshot(),
                        Map.of("state", Map.of("subject", "Welcome")),
                        List.of("previous"),
                        "test-client");

        assertThat(back.html())
                .containsPattern(
                        "data-lv-wizard-step=\"Subject\"[\\s\\S]*?data-lv-wizard-step-active=\"true\"")
                .contains("data-lv-wizard-next")
                .doesNotContain("data-lv-wizard-submit");
    }

    /**
     * @spec.given the wizard advanced to the last step (Body) with a valid accumulated state
     * @spec.when  Finish (the last-step submit) is invoked
     * @spec.then  the wizard binds the accumulated state, validation passes, the process runs and the
     *     modal CLOSES (hidden), proving the final-step submit completes the wizard (the audit's
     *     "action wizards" row, the multistep submit)
     * @spec.us   US-action-wizards
     */
    @Test
    void finish_submits_the_accumulated_state_and_closes_the_modal() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        WireCallResult opened =
                wireService.call(mounted.snapshot(), Map.of(), List.of("open"), "test-client");
        WireCallResult advanced =
                wireService.call(
                        opened.snapshot(),
                        Map.of("state", Map.of("subject", "Welcome")),
                        List.of("next"),
                        "test-client");

        WireCallResult finished =
                wireService.call(
                        advanced.snapshot(),
                        Map.of("state", Map.of("subject", "Welcome", "body", "Hello")),
                        List.of("submit"),
                        "test-client");

        // The wizard completed: the modal is hidden and the invalid banner is absent.
        assertThat(finished.html())
                .containsPattern("data-lv-wizard-action\\b[^>]*\\bhidden\\b")
                .doesNotContain("data-lv-wizard-invalid");
    }
}
