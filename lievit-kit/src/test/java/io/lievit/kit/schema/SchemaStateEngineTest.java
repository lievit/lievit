/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;

import io.lievit.kit.support.EvaluationContext;
import io.lievit.kit.support.EvaluationContext.Operation;

/**
 * Specifies the schema state engine: path resolution (incl. nested repeater paths), get/set,
 * default-on-hydrate, the StateCast round-trip, the dehydration flags (dehydratedWhenHidden), and
 * the reactive hooks (afterStateUpdated mutating siblings via the mutable context).
 */
class SchemaStateEngineTest {

    /** A minimal concrete component to exercise the base engine. */
    static final class Probe<T> extends SchemaComponent<T, Probe<T>> {
        static <T> Probe<T> at(String path) {
            return new Probe<T>().statePath(path);
        }
    }

    /**
     * @spec.given a schema state with a value nested two levels into a repeater
     * @spec.when  the value is read by its dot path
     * @spec.then  the nested path resolves correctly (items.1.qty)
     */
    @Test
    void a_state_path_resolves_nested_two_levels_into_a_repeater() {
        SchemaState state = SchemaState.empty();
        state.set("items.1.qty", "5");

        assertThat(state.getString("items.1.qty")).isEqualTo("5");
        assertThat(state.get("items.0")).isNull();
    }

    /**
     * @spec.given a flat state and a flatten of a nested state
     * @spec.when  flatten() is called on a nested state
     * @spec.then  every leaf path appears in the flat snapshot
     */
    @Test
    void flatten_produces_every_leaf_path() {
        SchemaState state = SchemaState.empty();
        state.set("country", "IT");
        state.set("items.0.qty", "2");

        Map<String, Object> flat = state.flatten();

        assertThat(flat).containsEntry("country", "IT").containsEntry("items.0.qty", "2");
    }

    /**
     * @spec.given a component with a closure default and no value in state
     * @spec.when  it hydrates on mount
     * @spec.then  the default populates the state path
     */
    @Test
    void default_populates_on_hydrate_when_state_is_empty() {
        SchemaState state = SchemaState.empty();
        Probe<String> field = Probe.<String>at("country").defaultUsing(ctx -> "IT");
        EvaluationContext ctx =
                EvaluationContext.readOnly(null, null, Operation.CREATE, state.flatten());

        field.hydrate(state, ctx);

        assertThat(state.getString("country")).isEqualTo("IT");
    }

    /**
     * @spec.given a date-cast component
     * @spec.when  a raw ISO string is hydrated and the typed value dehydrated
     * @spec.then  the cast round-trips (hydrate(dehydrate(x)) == x)
     */
    @Test
    void a_state_cast_round_trips_both_ways() {
        StateCast<LocalDate> cast = StateCasts.date();
        Object raw = "2026-01-31";

        LocalDate hydrated = cast.hydrate(raw);
        Object dehydrated = cast.dehydrate(hydrated);

        assertThat(hydrated).isEqualTo(LocalDate.of(2026, 1, 31));
        assertThat(dehydrated).isEqualTo("2026-01-31");
        assertThat(cast.hydrate(dehydrated)).isEqualTo(hydrated);
    }

    /**
     * @spec.given the boolean and number casts
     * @spec.when  representative raw values are hydrated then dehydrated
     * @spec.then  they round-trip to a canonical form
     */
    @Test
    void boolean_and_number_casts_round_trip() {
        assertThat(StateCasts.bool().hydrate("true")).isTrue();
        assertThat(StateCasts.bool().hydrate("0")).isFalse();
        assertThat(StateCasts.bool().dehydrate(true)).isEqualTo(true);

        assertThat(StateCasts.number().hydrate("42")).isEqualTo(42L);
        assertThat(StateCasts.number().dehydrate(42L)).isEqualTo("42");
        assertThat(StateCasts.number().hydrate("")).isNull();
    }

    /**
     * @spec.given a hidden component with dehydratedWhenHidden(false)
     * @spec.when  the form dehydrates
     * @spec.then  the hidden field's value is omitted from the persisted data
     */
    @Test
    void dehydrated_when_hidden_false_omits_a_hidden_fields_value() {
        SchemaState state = SchemaState.empty();
        state.set("vatNumber", "X");
        Probe<String> field = Probe.<String>at("vatNumber").hidden(true).dehydratedWhenHidden(false);
        EvaluationContext ctx =
                EvaluationContext.readOnly(null, null, Operation.CREATE, state.flatten());

        Map<String, Object> persisted = new LinkedHashMap<>();
        field.dehydrate(state, ctx, persisted::put);

        assertThat(persisted).doesNotContainKey("vatNumber");
    }

    /**
     * @spec.given a hidden component with dehydratedWhenHidden(true)
     * @spec.when  the form dehydrates
     * @spec.then  the hidden field still persists its value
     */
    @Test
    void dehydrated_when_hidden_true_keeps_a_hidden_fields_value() {
        SchemaState state = SchemaState.empty();
        state.set("auditFlag", "1");
        Probe<String> field = Probe.<String>at("auditFlag").hidden(true).dehydratedWhenHidden(true);
        EvaluationContext ctx =
                EvaluationContext.readOnly(null, null, Operation.CREATE, state.flatten());

        Map<String, Object> persisted = new LinkedHashMap<>();
        field.dehydrate(state, ctx, persisted::put);

        assertThat(persisted).containsEntry("auditFlag", "1");
    }

    /**
     * @spec.given a country field with an afterStateUpdated hook clearing region, and a live state
     * @spec.when  the hook fires through a mutable context after country changes
     * @spec.then  it reads the new country and writes region=null (dependent fields work)
     */
    @Test
    void after_state_updated_can_read_and_write_a_sibling_via_the_mutable_context() {
        SchemaState state = SchemaState.of(new HashMap<>(Map.of("country", "FR", "region", "Paris")));
        Probe<String> country =
                Probe.<String>at("country")
                        .live()
                        .afterStateUpdated((value, ctx) -> ctx.set("region", null));

        state.set("country", "IT");
        MutableEvaluationContext ctx =
                MutableEvaluationContext.over("IT", null, Operation.EDIT, state);
        country.fireAfterStateUpdated("IT", ctx);

        assertThat(state.get("region")).isNull();
        assertThat(state.getString("country")).isEqualTo("IT");
        assertThat(country.liveMode().isLive()).isTrue();
    }

    /**
     * @spec.given a component made reactive with the debounce live mode
     * @spec.when  the live mode is read
     * @spec.then  it reports a debounced binding with the configured window
     */
    @Test
    void live_debounce_carries_its_coalescing_window() {
        Probe<String> field = Probe.<String>at("q").live(LiveMode.debounced(500));

        assertThat(field.liveMode().kind()).isEqualTo(LiveMode.Kind.DEBOUNCED);
        assertThat(field.liveMode().debounceMillis()).isEqualTo(500);
    }

    /**
     * @spec.given a field visibleOn CREATE
     * @spec.when  visibility is resolved under CREATE and under EDIT
     * @spec.then  it is visible only under CREATE (operation gate)
     */
    @Test
    void visible_on_gates_by_operation() {
        Probe<String> field = Probe.<String>at("password").visibleOn(Operation.CREATE);

        EvaluationContext create =
                EvaluationContext.readOnly(null, null, Operation.CREATE, Map.of());
        EvaluationContext edit = EvaluationContext.readOnly(null, null, Operation.EDIT, Map.of());

        assertThat(field.isVisible(create)).isTrue();
        assertThat(field.isVisible(edit)).isFalse();
    }

    /**
     * @spec.given a field whose visibility is a closure over a sibling's live value
     * @spec.when  visibility is resolved with the sibling set to the triggering value
     * @spec.then  the field shows/hides reactively from the live state
     */
    @Test
    void reactive_visibility_reads_a_sibling_live_value() {
        Probe<String> vat =
                Probe.<String>at("vat").visible(ctx -> ctx.getString("type").equals("business"));

        EvaluationContext business =
                EvaluationContext.readOnly(null, null, Operation.CREATE, Map.of("type", "business"));
        EvaluationContext personal =
                EvaluationContext.readOnly(null, null, Operation.CREATE, Map.of("type", "personal"));

        assertThat(vat.isVisible(business)).isTrue();
        assertThat(vat.isVisible(personal)).isFalse();
    }
}
