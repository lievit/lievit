/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;

import dev.lievit.kit.support.EvaluationContext.Operation;

/**
 * Specifies the kit-wide closure-injection engine: a {@link ValueOrClosure} resolves a constant or
 * a closure through the same code path, and the {@link EvaluationContext} exposes Filament's
 * injected names ({@code state}, {@code record}, {@code get}, {@code set}, {@code operation},
 * {@code old}) as typed accessors. This is the substrate every reactive/conditional setter sits on.
 */
class ClosureInjectionTest {

    /**
     * @spec.given a ValueOrClosure wrapping a plain constant
     * @spec.when  it is evaluated against any context
     * @spec.then  it returns the constant and reports it is not a closure
     */
    @Test
    void a_constant_evaluates_to_itself_and_ignores_the_context() {
        ValueOrClosure<Boolean> visible = ValueOrClosure.of(true);

        assertThat(visible.isClosure()).isFalse();
        assertThat(visible.evaluate(EvaluationContext.of("anything"))).isTrue();
    }

    /**
     * @spec.given a ValueOrClosure wrapping a closure that reads a sibling field via get
     * @spec.when  it is evaluated against a context carrying that sibling's live value
     * @spec.then  it returns the closure's result computed from the live state
     */
    @Test
    void a_closure_evaluates_against_the_live_form_state() {
        ValueOrClosure<Boolean> visible =
                ValueOrClosure.ofClosure(ctx -> ctx.getString("type").equals("pro"));

        EvaluationContext pro =
                EvaluationContext.readOnly(null, null, Operation.CREATE, Map.of("type", "pro"));
        EvaluationContext free =
                EvaluationContext.readOnly(null, null, Operation.CREATE, Map.of("type", "free"));

        assertThat(visible.isClosure()).isTrue();
        assertThat(visible.evaluate(pro)).isTrue();
        assertThat(visible.evaluate(free)).isFalse();
    }

    /**
     * @spec.given a closure-accepting setter modelled as ValueOrClosure
     * @spec.when  a constant and a closure are fed through the same evaluate call
     * @spec.then  both resolve through one code path (interchangeable at the setter)
     */
    @Test
    void a_value_and_a_closure_are_interchangeable_through_one_code_path() {
        EvaluationContext ctx = EvaluationContext.of("x");

        assertThat(ValueOrClosure.of("label").evaluate(ctx)).isEqualTo("label");
        assertThat(ValueOrClosure.<String>ofClosure(c -> "label").evaluate(ctx)).isEqualTo("label");
    }

    /**
     * @spec.given a context built with state, record, operation and field values
     * @spec.when  the named accessors are read
     * @spec.then  each returns the value mapped from Filament's matching injected name
     */
    @Test
    void the_context_exposes_filament_injected_names_as_accessors() {
        record Customer(String name) {}
        Customer record = new Customer("Acme");

        EvaluationContext ctx =
                EvaluationContext.readOnly(
                        "draft", record, Operation.EDIT, Map.of("country", "IT", "vat", "123"));

        assertThat(ctx.state()).isEqualTo("draft");
        assertThat(ctx.rawState()).isEqualTo("draft");
        assertThat(ctx.record()).contains(record);
        assertThat(ctx.operation()).isEqualTo(Operation.EDIT);
        assertThat(ctx.get("country")).isEqualTo("IT");
        assertThat(ctx.getString("missing")).isEmpty();
    }

    /**
     * @spec.given the read-only base evaluation context
     * @spec.when  set() is called
     * @spec.then  it throws UnsupportedOperationException (writes need the mutable form context)
     */
    @Test
    void the_read_only_context_refuses_writes() {
        EvaluationContext ctx = EvaluationContext.of("x");

        assertThatThrownBy(() -> ctx.set("other", "v"))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    /**
     * @spec.given a ValueOrClosure resolving to null
     * @spec.when  evaluateOr is called with a fallback
     * @spec.then  the fallback is returned in place of null
     */
    @Test
    void evaluate_or_substitutes_a_fallback_for_null() {
        ValueOrClosure<String> maybe = ValueOrClosure.ofClosure(ctx -> null);

        assertThat(maybe.evaluateOr(EvaluationContext.of(null), "default")).isEqualTo("default");
    }

    /**
     * @spec.given a context whose values map is later mutated by the caller
     * @spec.when  a field value is read back from the context
     * @spec.then  the context kept an immutable copy (caller mutation does not leak in)
     */
    @Test
    void the_context_keeps_an_immutable_snapshot_of_the_field_values() {
        Map<String, Object> live = new HashMap<>();
        live.put("a", "1");
        EvaluationContext ctx =
                EvaluationContext.readOnly(null, null, Operation.CREATE, live);

        live.put("a", "2");

        assertThat(ctx.get("a")).isEqualTo("1");
    }
}
