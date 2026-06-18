/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.UnaryOperator;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.support.EvaluationContext;

/**
 * An ordered set of {@link Rule}s for one field, plus the message/attribute customization and the
 * {@code mutateStateForValidation} hook (the filament-forms {@code CanBeValidated} per-field
 * accumulator carried over). The field holds one of these; the engine evaluates it at submit time
 * against the live context.
 *
 * <p>Evaluation stops at the first failing rule (Filament's short-circuit), returning that rule's
 * message, with a custom validation-attribute name substituted when one is set.
 */
public final class RuleSet {

    /** A rule paired with an optional stable key (the Filament rule name, for message overrides). */
    private record Entry(@Nullable String key, Rule rule) {}

    private final List<Entry> rules = new ArrayList<>();
    private final java.util.Map<String, String> messages = new java.util.LinkedHashMap<>();
    private @Nullable String attribute;
    private UnaryOperator<@Nullable Object> mutateForValidation = UnaryOperator.identity();

    /**
     * @return a new, empty rule set
     */
    public static RuleSet create() {
        return new RuleSet();
    }

    /**
     * Adds a rule to the set.
     *
     * @param rule the rule (from {@link Rules} or a custom one, the escape hatch)
     * @return this set
     */
    public RuleSet rule(Rule rule) {
        rules.add(new Entry(null, Objects.requireNonNull(rule, "rule")));
        return this;
    }

    /**
     * Adds a keyed rule to the set. The key is the Filament rule name (for example {@code "email"},
     * {@code "min"}) a {@link #validationMessages(java.util.Map) custom message} can override.
     *
     * @param key the stable rule key (the Filament rule name)
     * @param rule the rule
     * @return this set
     */
    public RuleSet rule(String key, Rule rule) {
        rules.add(new Entry(Objects.requireNonNull(key, "key"), Objects.requireNonNull(rule, "rule")));
        return this;
    }

    /**
     * Overrides the failure message of keyed rules by their rule key (the Filament
     * {@code validationMessages([rule => message])}). A failing rule whose key is present uses the
     * custom message instead of its default.
     *
     * @param overrides rule key to custom message
     * @return this set
     */
    public RuleSet validationMessages(java.util.Map<String, String> overrides) {
        messages.putAll(Objects.requireNonNull(overrides, "overrides"));
        return this;
    }

    /**
     * Adds multiple rules.
     *
     * @param toAdd the rules
     * @return this set
     */
    public RuleSet rules(Rule... toAdd) {
        for (Rule rule : toAdd) {
            rule(rule);
        }
        return this;
    }

    /**
     * Sets the human attribute name used in failure messages (the {@code validationAttribute}).
     *
     * @param attribute the attribute name (for example "email address")
     * @return this set
     */
    public RuleSet validationAttribute(String attribute) {
        this.attribute = Objects.requireNonNull(attribute, "attribute");
        return this;
    }

    /**
     * Sets the transform applied to the value BEFORE validation (the {@code mutateStateForValidation}
     * hook: validate a normalized value, e.g. a stripped currency, not the raw input).
     *
     * @param mutate the pre-validation transform
     * @return this set
     */
    public RuleSet mutateStateForValidation(UnaryOperator<@Nullable Object> mutate) {
        this.mutateForValidation = Objects.requireNonNull(mutate, "mutate");
        return this;
    }

    /**
     * @return the rules in declaration order (unmodifiable)
     */
    public List<Rule> all() {
        return rules.stream().map(Entry::rule).toList();
    }

    /**
     * Validates a value against every rule, short-circuiting at the first failure. The value is run
     * through {@code mutateStateForValidation} first; a {@linkplain #validationMessages custom
     * message} for the failing rule's key wins, otherwise a custom attribute name is substituted into
     * the default message when set.
     *
     * @param value the field's current value
     * @param context the live evaluation context
     * @return the first failure message, or empty if every rule passes
     */
    public Optional<String> validate(@Nullable Object value, EvaluationContext context) {
        @Nullable Object mutated = mutateForValidation.apply(value);
        for (Entry entry : rules) {
            @Nullable String message = entry.rule().validate(mutated, context);
            if (message != null) {
                @Nullable String override = entry.key() == null ? null : messages.get(entry.key());
                if (override != null) {
                    return Optional.of(override);
                }
                return Optional.of(attribute == null ? message : withAttribute(message));
            }
        }
        return Optional.empty();
    }

    private String withAttribute(String message) {
        // "This field is required." -> "The <attribute> is required." keeps messages readable when a
        // custom attribute name is supplied, without a full i18n layer (that is a later concern).
        return message.replace("This field", "The " + attribute);
    }
}
