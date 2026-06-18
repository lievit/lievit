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
import io.lievit.LievitProperty;
import io.lievit.Wire;
import io.lievit.wire.PayloadGuard;
import io.lievit.wire.synth.SynthesizerRegistry;

/**
 * Pins the server-side resolution of magic actions through the CALL-phase listener (ADR-0030):
 * {@code $set} / {@code $toggle} mutate a {@code @Wire} field, {@code $refresh} re-renders, an
 * unknown {@code $}-name no-ops instead of an {@code UNKNOWN_COMPONENT}, and the settable allowlist
 * (locked + non-{@code @Wire}) holds.
 */
class MagicActionListenerTest {

    @LievitComponent
    static class Panel {
        @Wire int count;
        @Wire boolean open;
        @LievitProperty(locked = true) @Wire String role = "user";

        @LievitAction
        void noop() {}
    }

    private WireDispatcher dispatcherWithMagic() {
        SynthesizerRegistry synth = new SynthesizerRegistry();
        LifecycleBus bus = new LifecycleBus().on(LifecyclePhase.CALL, new MagicActionListener(synth));
        return new WireDispatcher(new PayloadGuard(), NoOpFieldValidator.INSTANCE, synth, bus);
    }

    /**
     * @spec.given a component and a $set magic call naming a @Wire int field
     * @spec.when  the wire call runs with that magic call
     * @spec.then  the property is set to the scalar and no UNKNOWN_COMPONENT is raised
     * @spec.adr   ADR-0030
     */
    @Test
    void set_mutates_a_wire_property() {
        ComponentMetadata meta = ComponentMetadata.of(Panel.class);
        WireCall result = dispatcherWithMagic()
                .call(meta, new Panel(), Map.of("count", 0), Map.of(), List.of("$set('count', 5)"));
        assertThat(result.wire()).containsEntry("count", 5);
    }

    /**
     * @spec.given a boolean @Wire field that is false
     * @spec.when  a $toggle magic call runs against it
     * @spec.then  the boolean flips to true
     * @spec.adr   ADR-0030
     */
    @Test
    void toggle_flips_a_boolean_property() {
        ComponentMetadata meta = ComponentMetadata.of(Panel.class);
        WireCall result = dispatcherWithMagic()
                .call(meta, new Panel(), Map.of("open", false), Map.of(), List.of("$toggle('open')"));
        assertThat(result.wire()).containsEntry("open", true);
    }

    /**
     * @spec.given a $refresh magic call (no real method named $refresh exists)
     * @spec.when  the wire call runs
     * @spec.then  it does not raise UNKNOWN_COMPONENT; the call completes (re-render happens)
     * @spec.adr   ADR-0030
     */
    @Test
    void refresh_does_not_raise_unknown_component() {
        ComponentMetadata meta = ComponentMetadata.of(Panel.class);
        WireCall result = dispatcherWithMagic()
                .call(meta, new Panel(), Map.of("count", 3), Map.of(), List.of("$refresh"));
        assertThat(result.wire()).containsEntry("count", 3);
    }

    /**
     * @spec.given a $set targeting a locked @Wire field
     * @spec.when  the magic call runs
     * @spec.then  the locked field is NOT changed (the mutation is dropped, no exception)
     * @spec.adr   ADR-0030
     */
    @Test
    void set_on_a_locked_field_is_dropped() {
        ComponentMetadata meta = ComponentMetadata.of(Panel.class);
        WireCall result = dispatcherWithMagic()
                .call(meta, new Panel(), Map.of("role", "user"), Map.of(),
                        List.of("$set('role', 'admin')"));
        assertThat(result.wire()).containsEntry("role", "user");
    }

    /**
     * @spec.given a $set targeting a name that is not a @Wire field
     * @spec.when  the magic call runs
     * @spec.then  nothing is mutated and no exception is raised (settable allowlist)
     * @spec.adr   ADR-0030
     */
    @Test
    void set_on_an_unknown_property_is_dropped() {
        ComponentMetadata meta = ComponentMetadata.of(Panel.class);
        WireCall result = dispatcherWithMagic()
                .call(meta, new Panel(), Map.of("count", 1), Map.of(),
                        List.of("$set('secret', 9)"));
        assertThat(result.wire()).containsEntry("count", 1);
    }
}
