/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.LievitOn;
import io.lievit.Wire;
import io.lievit.wire.PayloadGuard;
import io.lievit.wire.synth.SynthesizerRegistry;

/**
 * Pins that the validation gate is INTENT-driven, not shape-driven (the three-silent-drop fix):
 * "validation failed" means "do not run the form-submit handlers", never "drop everything this POST
 * carried". A framework magic mutation ({@code $set} / {@code $toggle}) and an inbound
 * {@code @LievitOn} event are not form submits, so they run even when an unrelated {@code @Wire}
 * field is invalid; only the real form-submit {@code @LievitAction} call is held back until the form
 * validates (ADR-0030, ADR-0038).
 */
class ValidationGateIntentTest {

    @LievitComponent
    static class Panel {
        @Wire String email = ""; // the "always invalid" field for these tests
        @Wire boolean open;
        @Wire int counter;
        @Wire boolean processed;

        @LievitAction
        void process() {
            this.processed = true;
        }

        @LievitOn("ping")
        void onPing() {
            this.counter = this.counter + 1;
        }
    }

    /** A validator that always reports the email field invalid, whatever the instance holds. */
    private static final FieldValidator EMAIL_ALWAYS_INVALID =
            new FieldValidator() {
                @Override
                public Map<String, List<String>> validate(Object instance) {
                    return Map.of("email", List.of("email is required"));
                }

                @Override
                public Map<String, List<String>> validateOnly(Object instance, String field) {
                    return field.equals("email")
                            ? Map.of("email", List.of("email is required"))
                            : Map.of();
                }
            };

    private WireDispatcher dispatcherWithMagicAnd(FieldValidator validator) {
        SynthesizerRegistry synth = new SynthesizerRegistry();
        LifecycleBus bus = new LifecycleBus().on(LifecyclePhase.CALL, new MagicActionListener(synth));
        return new WireDispatcher(new PayloadGuard(), validator, synth, bus);
    }

    /**
     * @spec.given a Panel whose email @Wire field is always invalid, and a $set('open', true) magic
     *     mutation in _calls (no real form-submit action)
     * @spec.when  the wire call runs through the intent-driven validation gate
     * @spec.then  the magic mutation applies (open = true) even though an unrelated field is invalid:
     *     a state write is not a form submit (the "click expand, nothing happens" bug is gone)
     * @spec.adr   ADR-0030
     */
    @Test
    void magic_set_applies_despite_an_unrelated_invalid_field() {
        ComponentMetadata meta = ComponentMetadata.of(Panel.class);
        WireCall result = dispatcherWithMagicAnd(EMAIL_ALWAYS_INVALID).call(
                meta,
                new Panel(),
                Map.of("email", "", "open", false, "counter", 0, "processed", false),
                Map.of(),
                List.of("$set('open', true)"));

        assertThat(result.wire()).containsEntry("open", true);
    }

    /**
     * @spec.given a Panel whose email field is always invalid, with open=false, and a
     *     $toggle('open') magic mutation in _calls
     * @spec.when  the wire call runs
     * @spec.then  the boolean flips to true regardless of the invalid neighbour
     * @spec.adr   ADR-0030
     */
    @Test
    void magic_toggle_applies_despite_an_unrelated_invalid_field() {
        ComponentMetadata meta = ComponentMetadata.of(Panel.class);
        WireCall result = dispatcherWithMagicAnd(EMAIL_ALWAYS_INVALID).call(
                meta,
                new Panel(),
                Map.of("email", "", "open", false, "counter", 0, "processed", false),
                Map.of(),
                List.of("$toggle('open')"));

        assertThat(result.wire()).containsEntry("open", true);
    }

    /**
     * @spec.given a Panel whose email field is always invalid, listening for "ping", with an inbound
     *     "ping" event and no _calls / _updates
     * @spec.when  the wire call runs
     * @spec.then  the @LievitOn handler runs (counter incremented) regardless of validation: an event
     *     is not a form submit, so it is delivered even when the target has an invalid field
     * @spec.adr   ADR-0030
     */
    @Test
    void inbound_event_is_delivered_when_the_target_has_an_invalid_field() {
        ComponentMetadata meta = ComponentMetadata.of(Panel.class);
        WireCall result = dispatcherWithMagicAnd(EMAIL_ALWAYS_INVALID).call(
                meta,
                new Panel(),
                Map.of("email", "", "open", false, "counter", 0, "processed", false),
                Map.of(),
                List.of(),
                List.of(new InboundEvent("ping", null)));

        assertThat(result.wire()).containsEntry("counter", 1);
    }

    /**
     * @spec.given a Panel whose email field is always invalid and a real form-submit "process" action
     * @spec.when  the wire call runs with that action in _calls
     * @spec.then  the action is SKIPPED (processed stays false) and the validation errors are written
     *     to the effects sink: the gate still holds back a real form submit
     * @spec.adr   ADR-0038
     */
    @Test
    void real_form_submit_is_skipped_and_errors_surface_when_invalid() {
        ComponentMetadata meta = ComponentMetadata.of(Panel.class);
        WireCall result = dispatcherWithMagicAnd(EMAIL_ALWAYS_INVALID).call(
                meta,
                new Panel(),
                Map.of("email", "", "open", false, "counter", 0, "processed", false),
                Map.of(),
                List.of("process"));

        assertThat(result.wire()).containsEntry("processed", false);
        assertThat(result.effects().validationErrors()).containsKey("email");
    }

    /**
     * @spec.given a Panel whose email field is always invalid, a $set magic mutation AND a real
     *     "process" submit in the same _calls
     * @spec.when  the wire call runs
     * @spec.then  the magic mutation still applies (open=true) while the real submit is held back
     *     (processed=false): one POST, two intents, gated independently
     * @spec.adr   ADR-0030
     */
    @Test
    void magic_mutation_runs_while_the_real_submit_in_the_same_call_is_held_back() {
        ComponentMetadata meta = ComponentMetadata.of(Panel.class);
        WireCall result = dispatcherWithMagicAnd(EMAIL_ALWAYS_INVALID).call(
                meta,
                new Panel(),
                Map.of("email", "", "open", false, "counter", 0, "processed", false),
                Map.of(),
                List.of("$set('open', true)", "process"));

        assertThat(result.wire()).containsEntry("open", true);
        assertThat(result.wire()).containsEntry("processed", false);
        assertThat(result.effects().validationErrors()).containsKey("email");
    }

    /**
     * @spec.given a Panel with a passing validator and a real "process" submit
     * @spec.when  the wire call runs
     * @spec.then  the action runs (processed=true): a valid form submit is not held back
     * @spec.adr   ADR-0038
     */
    @Test
    void real_form_submit_runs_when_valid() {
        ComponentMetadata meta = ComponentMetadata.of(Panel.class);
        WireCall result = dispatcherWithMagicAnd(NoOpFieldValidator.INSTANCE).call(
                meta,
                new Panel(),
                Map.of("email", "ok@example.com", "open", false, "counter", 0, "processed", false),
                Map.of(),
                List.of("process"));

        assertThat(result.wire()).containsEntry("processed", true);
    }
}
