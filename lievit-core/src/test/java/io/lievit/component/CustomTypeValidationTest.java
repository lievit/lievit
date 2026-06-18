/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import jakarta.validation.Valid;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

import org.junit.jupiter.api.Test;

import io.lievit.wire.synth.Wireable;

/**
 * Specifies that a custom serializable property type (a {@link Wireable} value object held in a
 * {@code @Wire} field, issue #139) validates at the correct nested dotted path: Bean Validation
 * cascades into the object via {@code @Valid} and keys each violation by its property path
 * ({@code account.iban}), and the Livewire {@code validateOnly} convention surfaces exactly that
 * path on a {@code l:model="account.iban"}-style per-field update. Uses the canonical Bean Validation
 * cascade, not a parallel engine, so the path the client binds matches the path the error reports.
 */
class CustomTypeValidationTest {

    // A custom serializable type (Wireable, issue #139) that ALSO carries nested constraints. The
    // wire round-trip and the validation cascade are orthogonal: round-trip via toWire/fromWire,
    // validation via the bean's own constraints reached by @Valid.
    public static final class Account implements Wireable {
        @NotBlank(message = "iban is required")
        public String iban = "";

        @Min(value = 0, message = "balance must not be negative")
        public long balance;

        public Account() {}

        Account(String iban, long balance) {
            this.iban = iban;
            this.balance = balance;
        }

        @Override
        public Object toWire() {
            return Map.of("iban", iban, "balance", balance);
        }

        @SuppressWarnings("unchecked")
        public static Account fromWire(Object data) {
            Map<String, Object> m = (Map<String, Object>) data;
            return new Account((String) m.get("iban"), ((Number) m.get("balance")).longValue());
        }
    }

    public static class Profile {
        @Valid public Account account = new Account();

        Profile(Account account) {
            this.account = account;
        }
    }

    private static FieldValidator beanValidator() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        return new BeanValidationFieldValidator(validator);
    }

    /**
     * @spec.given a profile holding a custom-type Account with a blank iban (a violated nested rule)
     * @spec.when  the Bean Validation-backed validator validates it (cascading via @Valid)
     * @spec.then  the violation is keyed by the nested dotted path account.iban, the exact path a
     *     l:model="account.iban" binds, so the error reports where the client wrote (#139)
     * @spec.adr   ADR-0020
     */
    @Test
    void custom_type_field_reports_violation_at_the_nested_dotted_path() {
        FieldValidator validator = beanValidator();

        Map<String, List<String>> errors = validator.validate(new Profile(new Account("", 100)));

        assertThat(errors).containsKey("account.iban");
        assertThat(errors.get("account.iban")).containsExactly("iban is required");
    }

    /**
     * @spec.given a profile whose custom-type Account violates two nested rules (blank iban, negative
     *     balance)
     * @spec.when  validateOnly is called with the dotted path "account.iban"
     * @spec.then  only the iban violation surfaces, not the still-untouched balance error: a
     *     real-time per-field update on a custom-type sub-path reports just that path (#139, ADR-0038)
     * @spec.adr   ADR-0038
     */
    @Test
    void validate_only_surfaces_exactly_the_bound_nested_path() {
        FieldValidator validator = beanValidator();

        Map<String, List<String>> only =
                validator.validateOnly(new Profile(new Account("", -5)), "account.iban");

        assertThat(only).containsOnlyKeys("account.iban");
    }
}
