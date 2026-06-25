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
 * The action-modal (Filament action modal + mount lifecycle + forms parity) end-to-end gate: a
 * {@link dev.lievit.kit.FormAction} driven through the REAL lievit runtime by
 * {@link ActionModalComponent}. It proves the audit's three action rows render / behave their
 * defining sub-features:
 *
 * <ul>
 *   <li><b>action modals</b>: the deepened {@link dev.lievit.kit.ModalConfig} renders the width token,
 *       icon + colour, centre alignment, sticky header/footer, close button, the content fragments,
 *       and the extra footer action.
 *   <li><b>action forms</b>: {@code disabledForm()} renders the fields read-only, {@code mountUsing()}
 *       prefills on open.
 *   <li><b>action lifecycle</b>: a {@code before()} hook halts the submit (no notification), and a
 *       valid submit fires the {@code after()} + success notification onto the effects channel.
 * </ul>
 *
 * <p>It boots a Spring context, so it is an {@code *IT} (the failsafe loop, ADR-0007).
 */
@SpringBootTest(classes = ActionModalWireTestApp.class)
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class ActionModalComponentIT {

    @Autowired LievitWireService wireService;

    private static final String COMPONENT = ActionModalComponent.class.getName();

    /**
     * @spec.given an action whose modal sets width LARGE, an icon+colour, centre alignment, sticky
     *     header/footer, an explicit close button, content fragments and an extra footer action
     * @spec.when  the modal is opened and rendered by JTE through the real runtime
     * @spec.then  every modal sub-feature is stamped: the width token, the icon + its colour, the
     *     alignment, the sticky flags, the close button, the above/below content fragments and the
     *     extra footer-action label, proving the deepened ModalConfig renders (the audit's "action
     *     modals" row)
     * @spec.us   US-action-modals
     */
    @Test
    void renders_the_deepened_modal_config() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        WireCallResult opened =
                wireService.call(mounted.snapshot(), Map.of(), List.of("open"), "test-client");

        assertThat(opened.html())
                .contains("data-lv-modal-width=\"lg\"")
                .contains("data-lv-modal-alignment=\"center\"")
                .contains("data-lv-modal-sticky-header=\"true\"")
                .contains("data-lv-modal-sticky-footer=\"true\"")
                .contains("data-lv-modal-icon=\"bell\"")
                .contains("data-lv-modal-icon-color=\"warning\"")
                .contains("data-lv-modal-close")
                .contains("data-lv-modal-content-above=\"legal-notice\"")
                .contains("data-lv-modal-content-below=\"delivery-note\"")
                .contains("data-lv-modal-extra-action=\"Save draft\"")
                .contains(">Send</button>")
                .contains(">Discard</button>")
                .contains("role=\"dialog\"")
                .contains("aria-modal=\"true\"");
    }

    /**
     * @spec.given the same action declares disabledForm() + mountUsing()
     * @spec.when  the modal opens through the real runtime
     * @spec.then  the form fields render read-only ({@code disabled} + the data flag) AND the
     *     recipient is prefilled by mountUsing (team@example.com), proving the audit's "action forms"
     *     row (disabledForm read-only + the mount fill)
     * @spec.us   US-action-forms
     */
    @Test
    void renders_disabled_form_prefilled_by_mount_using() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        WireCallResult opened =
                wireService.call(mounted.snapshot(), Map.of(), List.of("open"), "test-client");

        assertThat(opened.html())
                .contains("data-lv-modal-field=\"subject\"")
                .contains("data-lv-field-disabled=\"true\"")
                .containsPattern("data-lv-modal-field=\"subject\"[\\s\\S]*?disabled")
                // mountUsing prefilled the recipient.
                .containsPattern("id=\"lv-af-to\"[^>]*value=\"team@example.com\"");
    }

    /**
     * @spec.given the action's before() hook halts when the subject is blank
     * @spec.when  the modal is opened (mountUsing leaves subject blank) and submitted as-is
     * @spec.then  the action halts: no success notification rides the effects channel and the modal
     *     stays open, proving the lifecycle before()/halt() gate (the audit's "action lifecycle" row)
     * @spec.us   US-action-lifecycle
     */
    @Test
    void before_hook_halts_the_submit_without_notifying() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        WireCallResult opened =
                wireService.call(mounted.snapshot(), Map.of(), List.of("open"), "test-client");

        WireCallResult submitted =
                wireService.call(opened.snapshot(), Map.of(), List.of("submit"), "test-client");

        // Halted: no notification effect, the modal is still open.
        assertThat(submitted.effects() == null || !submitted.effects().contains("Message sent"))
                .isTrue();
        assertThat(submitted.html()).doesNotContainPattern("data-lv-action-modal\\b[^>]*\\bhidden\\b");
    }

    /**
     * @spec.given the same action with the subject filled (the before() gate now passes)
     * @spec.when  the modal is submitted
     * @spec.then  the action completes: the per-action success notification rides the Lievit-Effects
     *     channel and the modal closes, proving the lifecycle runs the body + after() + the success
     *     notification on a non-halting completion (the audit's "action lifecycle" row)
     * @spec.us   US-action-lifecycle
     */
    @Test
    void valid_submit_runs_after_and_fires_the_success_notification() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        WireCallResult opened =
                wireService.call(mounted.snapshot(), Map.of(), List.of("open"), "test-client");

        WireCallResult submitted =
                wireService.call(
                        opened.snapshot(),
                        Map.of("state", Map.of("subject", "Welcome")),
                        List.of("submit"),
                        "test-client");

        // The success notification effect rode the response.
        assertThat(submitted.effects()).isNotNull();
        assertThat(submitted.effects()).contains("Message sent successfully");
        // The modal closed on completion.
        assertThat(submitted.html()).containsPattern("data-lv-action-modal\\b[^>]*\\bhidden\\b");
    }
}
