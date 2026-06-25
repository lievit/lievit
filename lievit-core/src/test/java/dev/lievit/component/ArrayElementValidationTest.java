/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import jakarta.validation.Valid;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.constraints.Min;

import org.junit.jupiter.api.Test;

/**
 * Specifies that a {@code @Valid} collection's element constraints are surfaced as indexed paths by
 * the real {@link BeanValidationFieldValidator}, and that the Livewire star rule {@code items.*.qty}
 * matches every element via {@link FieldValidator#validateOnly} (ADR-0038, #185 array-element rules).
 * Uses Bean Validation's canonical container-element cascade ({@code @Valid List<Item>}), not a
 * parallel validation engine.
 */
class ArrayElementValidationTest {

    public static class Item {
        @Min(value = 1, message = "quantity must be at least 1")
        public int qty;

        Item(int qty) {
            this.qty = qty;
        }
    }

    public static class Order {
        @Valid public List<Item> items;

        Order(List<Item> items) {
            this.items = items;
        }
    }

    private static FieldValidator beanValidator() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        return new BeanValidationFieldValidator(validator);
    }

    /**
     * @spec.given an order with two invalid items (qty 0 at index 0, qty -1 at index 1)
     * @spec.when  the Bean Validation-backed field validator validates it (cascading via @Valid)
     * @spec.then  each element's violation is keyed by its indexed path (items[0].qty, items[1].qty),
     *     the canonical container-element path Hibernate Validator produces
     * @spec.adr   ADR-0038
     * @spec.us    US-array-element-rules
     */
    @Test
    void cascaded_collection_produces_indexed_element_paths() {
        FieldValidator validator = beanValidator();

        Map<String, List<String>> errors =
                validator.validate(new Order(List.of(new Item(0), new Item(-1))));

        assertThat(errors).containsKeys("items[0].qty", "items[1].qty");
        assertThat(errors.get("items[0].qty")).containsExactly("quantity must be at least 1");
    }

    /**
     * @spec.given an order whose array elements are invalid at two indices
     * @spec.when  validateOnly is called with the star rule key "items.*.qty"
     * @spec.then  every indexed element matching the star is surfaced: one rule validates all
     *     elements, the Livewire dot-star convention mapped onto Bean Validation's indexed paths
     * @spec.adr   ADR-0038
     * @spec.us    US-array-element-rules
     */
    @Test
    void star_rule_matches_all_invalid_array_elements() {
        FieldValidator validator = beanValidator();

        Map<String, List<String>> only =
                validator.validateOnly(
                        new Order(List.of(new Item(0), new Item(5), new Item(-2))), "items.*.qty");

        // Index 1 (qty 5) is valid, so only indices 0 and 2 surface.
        assertThat(only).containsOnlyKeys("items[0].qty", "items[2].qty");
    }
}
