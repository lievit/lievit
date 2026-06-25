/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * Specifies the programmatic error-bag API on {@link LievitEffects} (ADR-0038, Livewire
 * {@code addError} / {@code resetValidation} / {@code errorBagExcept} parity): an action manipulates
 * the per-component error bag imperatively, riding the same {@code errors} effect the automatic
 * validation uses.
 */
class ErrorBagApiTest {

    /**
     * @spec.given a fresh effects sink with no errors
     * @spec.when  an action adds a custom cross-field error
     * @spec.then  the error appears in the bag under that field (the auto-validation channel)
     * @spec.adr   ADR-0038
     * @spec.us    US-imperative-error-bag
     */
    @Test
    void add_error_records_a_custom_error_on_a_field() {
        LievitEffects effects = LievitEffects.capturing();

        effects.addError("confirm", "password and confirmation must match");

        assertThat(effects.validationErrors())
                .containsKey("confirm")
                .extractingByKey("confirm")
                .asList()
                .containsExactly("password and confirmation must match");
    }

    /**
     * @spec.given a sink already carrying a validator error on "email"
     * @spec.when  an action adds another message on the same field
     * @spec.then  both messages accumulate (addError merges, it does not replace)
     * @spec.adr   ADR-0038
     */
    @Test
    void add_error_merges_with_existing_validator_errors() {
        LievitEffects effects = LievitEffects.capturing();
        effects.setValidationErrors(Map.of("email", List.of("must be valid")));

        effects.addError("email", "already registered");

        assertThat(effects.validationErrors().get("email"))
                .containsExactly("must be valid", "already registered");
    }

    /**
     * @spec.given a sink carrying errors on two fields
     * @spec.when  resetValidation() is called
     * @spec.then  the whole bag is cleared (the errors effect is omitted: validationErrors is null)
     * @spec.adr   ADR-0038
     */
    @Test
    void reset_validation_clears_the_whole_bag() {
        LievitEffects effects = LievitEffects.capturing();
        effects.setValidationErrors(Map.of("email", List.of("bad"), "name", List.of("blank")));

        effects.resetValidation();

        assertThat(effects.validationErrors()).isNull();
    }

    /**
     * @spec.given a sink carrying errors on "email" and "name"
     * @spec.when  resetValidation("email") clears only that field
     * @spec.then  "name" survives, "email" is gone
     * @spec.adr   ADR-0038
     */
    @Test
    void reset_validation_of_one_field_leaves_the_others() {
        LievitEffects effects = LievitEffects.capturing();
        effects.setValidationErrors(Map.of("email", List.of("bad"), "name", List.of("blank")));

        effects.resetValidation("email");

        assertThat(effects.validationErrors()).containsOnlyKeys("name");
    }

    /**
     * @spec.given a sink carrying errors on "email", "name", and "phone"
     * @spec.when  errorBagExcept("phone") is read
     * @spec.then  the returned view has email + name but not phone, and the sink is unchanged
     * @spec.adr   ADR-0038
     */
    @Test
    void error_bag_except_returns_a_filtered_view_without_mutating() {
        LievitEffects effects = LievitEffects.capturing();
        effects.setValidationErrors(
                Map.of("email", List.of("bad"), "name", List.of("blank"), "phone", List.of("nope")));

        Map<String, List<String>> view = effects.errorBagExcept("phone");

        assertThat(view).containsOnlyKeys("email", "name");
        // The sink itself still has all three (errorBagExcept is a view, not a mutation).
        assertThat(effects.validationErrors()).containsOnlyKeys("email", "name", "phone");
    }

    /**
     * @spec.given a fresh sink
     * @spec.when  addError is called with a blank field or message
     * @spec.then  it rejects the call: an error must name a field and carry a message
     * @spec.adr   ADR-0038
     */
    @Test
    void add_error_rejects_blank_field_or_message() {
        LievitEffects effects = LievitEffects.capturing();

        assertThatThrownBy(() -> effects.addError("", "msg"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> effects.addError("email", "  "))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
