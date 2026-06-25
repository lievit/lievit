/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import dev.lievit.kit.SelectOption;
import dev.lievit.kit.support.EvaluationContext;
import dev.lievit.kit.support.EvaluationContext.Operation;

/**
 * Specifies the dynamic-closure / utility-injection layer the audit's {@code Reactive / live state}
 * and {@code Select} / {@code Radio} rows ask for: the {@code formatStateUsing} (display transform)
 * and {@code dehydrateStateUsing} (persist transform) closures threaded through the engine's read /
 * dehydrate path, and the per-option {@code disableOptionWhen} closure recomputed from the live
 * state. Each test drives the REAL engine end to end (a {@link SchemaForm} hydrate/dehydrate, or the
 * field's resolve against a live {@link EvaluationContext}) and asserts the resolved BEHAVIOUR (what
 * persists, what shows, which option is locked), not the mere presence of a setter.
 */
class FormsClosureLayerTest {

    private static EvaluationContext ctx(Map<String, Object> state) {
        return EvaluationContext.readOnly(null, null, Operation.CREATE, state);
    }

    /**
     * @spec.given a TextInput with dehydrateStateUsing that upper-cases the value
     * @spec.when  the whole form dehydrates through the real engine
     * @spec.then  the PERSISTED value is the transformed one (the transform changes what is stored,
     *     the filament dehydrateStateUsing contract)
     */
    @Test
    void dehydrate_state_using_transforms_what_persists() {
        SchemaForm form =
                SchemaForm.create()
                        .components(
                                TextInput.make("code")
                                        .dehydrateStateUsing(
                                                (value, c) -> value == null ? null : value.toUpperCase()));
        SchemaState state = SchemaState.of(Map.of("code", "ab12"));

        Map<String, Object> persisted = form.dehydrate(state);

        assertThat(persisted).containsEntry("code", "AB12");
    }

    /**
     * @spec.given a field with formatStateUsing but no dehydrateStateUsing
     * @spec.when  the display value and the persisted value are both resolved
     * @spec.then  formatStateUsing changes ONLY the display: the persisted value stays raw (the
     *     display-side twin of dehydrateStateUsing)
     */
    @Test
    void format_state_using_changes_display_only_not_persistence() {
        TextInput field =
                TextInput.make("price").formatStateUsing((value, c) -> "EUR " + value);
        SchemaForm form = SchemaForm.create().components(field);
        SchemaState state = SchemaState.of(Map.of("price", "10"));

        Object shown = field.formattedState(state, ctx(state.flatten()));
        Map<String, Object> persisted = form.dehydrate(state);

        assertThat(shown).isEqualTo("EUR 10");
        assertThat(persisted).containsEntry("price", "10");
    }

    /**
     * @spec.given a field whose format transform reads a sibling's live value through the context
     * @spec.when  the display value is resolved with the sibling set
     * @spec.then  the transform sees the live context (utility injection: the closure reads $get)
     */
    @Test
    void format_transform_receives_the_live_context() {
        TextInput field =
                TextInput.make("amount")
                        .formatStateUsing((value, c) -> c.getString("currency") + " " + value);
        SchemaState state = SchemaState.of(Map.of("amount", "5", "currency", "USD"));

        Object shown = field.formattedState(state, ctx(state.flatten()));

        assertThat(shown).isEqualTo("USD 5");
    }

    /**
     * @spec.given a Select whose disableOptionWhen locks the "pro" option unless plan=enterprise
     * @spec.when  per-option disabling is resolved under plan=free then plan=enterprise
     * @spec.then  only the targeted option toggles, reactively from the live state (the per-option
     *     twin of the field-wide disabled closure)
     */
    @Test
    void select_disable_option_when_locks_one_option_reactively() {
        Select plan =
                Select.make("addon")
                        .options(List.of(SelectOption.of("basic", "Basic"), SelectOption.of("pro", "Pro")))
                        .disableOptionWhen(
                                (value, c) -> value.equals("pro") && !c.getString("plan").equals("enterprise"));

        assertThat(plan.isOptionDisabled("pro", ctx(Map.of("plan", "free")))).isTrue();
        assertThat(plan.isOptionDisabled("basic", ctx(Map.of("plan", "free")))).isFalse();
        assertThat(plan.isOptionDisabled("pro", ctx(Map.of("plan", "enterprise")))).isFalse();
        assertThat(plan.hasDisableOptionWhen()).isTrue();
    }

    /**
     * @spec.given a Radio with a disableOptionWhen predicate over the live state
     * @spec.when  an option is checked against the predicate
     * @spec.then  the radio resolves the same per-option disabling as Select (one shared contract)
     */
    @Test
    void radio_disable_option_when_greys_a_single_option() {
        Radio shipping =
                Radio.make("speed")
                        .options(
                                List.of(
                                        SelectOption.of("standard", "Standard"),
                                        SelectOption.of("express", "Express")))
                        .disableOptionWhen((value, c) -> value.equals("express") && c.getString("region").equals("remote"));

        assertThat(shipping.isOptionDisabled("express", ctx(Map.of("region", "remote")))).isTrue();
        assertThat(shipping.isOptionDisabled("express", ctx(Map.of("region", "city")))).isFalse();
        assertThat(shipping.isOptionDisabled("standard", ctx(Map.of("region", "remote")))).isFalse();
    }

    /**
     * @spec.given a Select switched to native(false)
     * @spec.when  the native flag is read
     * @spec.then  it reports the custom dropdown (the surface that allows rich labels / per-option
     *     disabling beyond a native control); the default stays native
     */
    @Test
    void select_native_false_selects_the_custom_dropdown() {
        assertThat(Select.make("a").isNative()).isTrue();
        assertThat(Select.make("b").native_(false).isNative()).isFalse();
    }
}
