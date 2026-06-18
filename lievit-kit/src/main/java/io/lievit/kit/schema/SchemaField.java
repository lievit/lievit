/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import java.util.Objects;
import java.util.Optional;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.Color;
import io.lievit.kit.support.EvaluationContext;

/**
 * The base of every schema INPUT field (as opposed to a {@link Layout} container): a
 * {@link SchemaComponent} that always binds a {@code statePath}, carries a display label, the helper
 * text / hint / affixes (the filament-forms {@code HasHelperText} / {@code HasHint} /
 * {@code HasAffixes} carried over), and a {@link RuleSet} of validation rules.
 *
 * <p>The field name IS the state path by default (so {@code TextInput.make("email")} binds
 * {@code email}), with a humanized label, matching the existing kit {@link io.lievit.kit.Field}
 * convention.
 *
 * @param <T> the in-memory value type
 * @param <SELF> the concrete field type, for fluent returns
 */
public abstract class SchemaField<T extends @Nullable Object, SELF extends SchemaField<T, SELF>>
        extends SchemaComponent<T, SELF> {

    private final String label;
    private @Nullable String helperText;
    private @Nullable String hint;
    private @Nullable String hintIcon;
    private @Nullable Color hintColor;
    private @Nullable String prefix;
    private @Nullable String suffix;
    private @Nullable String prefixIcon;
    private @Nullable String suffixIcon;
    private boolean required;
    private final RuleSet rules = RuleSet.create();

    /**
     * @param name the field name, used as the default state path and humanized into the label
     */
    protected SchemaField(String name) {
        Objects.requireNonNull(name, "name");
        statePath(name);
        this.label = humanize(name);
    }

    /**
     * @param name the field name and default state path
     * @param label the explicit display label
     */
    protected SchemaField(String name, String label) {
        Objects.requireNonNull(name, "name");
        statePath(name);
        this.label = Objects.requireNonNull(label, "label");
    }

    /**
     * @return the display label
     */
    public String label() {
        return label;
    }

    /**
     * Sets the helper text shown beneath the field.
     *
     * @param helperText the helper text
     * @return this field
     */
    public SELF helperText(String helperText) {
        this.helperText = Objects.requireNonNull(helperText, "helperText");
        return self();
    }

    /**
     * @return the helper text, or {@code null}
     */
    public @Nullable String helperText() {
        return helperText;
    }

    /**
     * Sets the hint shown inline beside the label.
     *
     * @param hint the hint text
     * @return this field
     */
    public SELF hint(String hint) {
        this.hint = Objects.requireNonNull(hint, "hint");
        return self();
    }

    /**
     * @return the hint, or {@code null}
     */
    public @Nullable String hint() {
        return hint;
    }

    /**
     * Sets an icon shown beside the hint (an icon name/alias resolved by the icon registry).
     *
     * @param hintIcon the icon name/alias
     * @return this field
     */
    public SELF hintIcon(String hintIcon) {
        this.hintIcon = Objects.requireNonNull(hintIcon, "hintIcon");
        return self();
    }

    /**
     * @return the hint icon name/alias, or {@code null}
     */
    public @Nullable String hintIcon() {
        return hintIcon;
    }

    /**
     * Sets the hint color (tints the hint text and icon).
     *
     * @param hintColor the semantic color
     * @return this field
     */
    public SELF hintColor(Color hintColor) {
        this.hintColor = Objects.requireNonNull(hintColor, "hintColor");
        return self();
    }

    /**
     * @return the hint color, or {@code null} for the default
     */
    public @Nullable Color hintColor() {
        return hintColor;
    }

    /**
     * Sets a prefix affix shown inside the input, before the value (for example a currency sign).
     *
     * @param prefix the prefix text
     * @return this field
     */
    public SELF prefix(String prefix) {
        this.prefix = Objects.requireNonNull(prefix, "prefix");
        return self();
    }

    /**
     * @return the prefix affix, or {@code null}
     */
    public @Nullable String prefix() {
        return prefix;
    }

    /**
     * Sets a suffix affix shown inside the input, after the value (for example a unit).
     *
     * @param suffix the suffix text
     * @return this field
     */
    public SELF suffix(String suffix) {
        this.suffix = Objects.requireNonNull(suffix, "suffix");
        return self();
    }

    /**
     * @return the suffix affix, or {@code null}
     */
    public @Nullable String suffix() {
        return suffix;
    }

    /**
     * Sets a prefix icon affix shown inside the input, before the value.
     *
     * @param prefixIcon the icon name/alias
     * @return this field
     */
    public SELF prefixIcon(String prefixIcon) {
        this.prefixIcon = Objects.requireNonNull(prefixIcon, "prefixIcon");
        return self();
    }

    /**
     * @return the prefix icon affix, or {@code null}
     */
    public @Nullable String prefixIcon() {
        return prefixIcon;
    }

    /**
     * Sets a suffix icon affix shown inside the input, after the value.
     *
     * @param suffixIcon the icon name/alias
     * @return this field
     */
    public SELF suffixIcon(String suffixIcon) {
        this.suffixIcon = Objects.requireNonNull(suffixIcon, "suffixIcon");
        return self();
    }

    /**
     * @return the suffix icon affix, or {@code null}
     */
    public @Nullable String suffixIcon() {
        return suffixIcon;
    }

    /**
     * Marks the field required (adds the {@code required} validation rule and a presentation flag).
     *
     * @return this field
     */
    public SELF required() {
        this.required = true;
        rules.rule(Rules.required());
        return self();
    }

    /**
     * @return {@code true} if the field is marked required
     */
    public boolean isRequired() {
        return required;
    }

    /**
     * Adds a validation rule to this field.
     *
     * @param rule the rule
     * @return this field
     */
    public SELF rule(Rule rule) {
        rules.rule(rule);
        return self();
    }

    /**
     * @return the field's rule set
     */
    public RuleSet rules() {
        return rules;
    }

    /**
     * Validates this field's current value against its rule set and the live context.
     *
     * @param state the live schema state
     * @param context the live evaluation context
     * @return the first failure message, or empty if valid
     */
    public Optional<String> validate(SchemaState state, EvaluationContext context) {
        if (!isVisible(context)) {
            return Optional.empty();
        }
        @Nullable Object value = statePath() == null ? null : state.get(statePath());
        return rules.validate(value, context);
    }

    /** Title-cases a field name into a default label ({@code postal_code} to {@code Postal Code}). */
    static String humanize(String name) {
        String spaced =
                name.replace('_', ' ').replaceAll("([a-z])([A-Z])", "$1 $2").trim();
        if (spaced.isEmpty()) {
            return spaced;
        }
        StringBuilder out = new StringBuilder();
        for (String word : spaced.split("\\s+")) {
            if (out.length() > 0) {
                out.append(' ');
            }
            out.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
        }
        return out.toString();
    }
}
