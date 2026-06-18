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
    private @Nullable SchemaAction prefixAction;
    private @Nullable SchemaAction suffixAction;
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

    // ── affix actions (filament HasAffixes: prefixAction / suffixAction) ──

    /**
     * Attaches a clickable action button as the field's prefix affix (the filament
     * {@code prefixAction}): a small inline button before the input, for an inline "Generate" /
     * "Verify" affordance whose closure mutates this or sibling fields.
     *
     * @param action the prefix action
     * @return this field
     */
    public SELF prefixAction(SchemaAction action) {
        this.prefixAction = Objects.requireNonNull(action, "action");
        return self();
    }

    /**
     * @return the prefix affix action, or {@code null}
     */
    public @Nullable SchemaAction prefixAction() {
        return prefixAction;
    }

    /**
     * Attaches a clickable action button as the field's suffix affix (the filament
     * {@code suffixAction}): a small inline button after the input.
     *
     * @param action the suffix action
     * @return this field
     */
    public SELF suffixAction(SchemaAction action) {
        this.suffixAction = Objects.requireNonNull(action, "action");
        return self();
    }

    /**
     * @return the suffix affix action, or {@code null}
     */
    public @Nullable SchemaAction suffixAction() {
        return suffixAction;
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
     * Adds multiple validation rules to this field, in order.
     *
     * @param toAdd the rules
     * @return this field
     */
    public SELF rules(Rule... toAdd) {
        rules.rules(toAdd);
        return self();
    }

    /**
     * @return the field's rule set
     */
    public RuleSet rules() {
        return rules;
    }

    // ── validation builder surface (filament CanBeValidated, shared by every field) ──

    /**
     * Restricts the value to a membership set (the filament {@code in}).
     *
     * @param allowed the allowed values
     * @return this field
     */
    public SELF in(java.util.Collection<?> allowed) {
        rules.rule("in", Rules.in(allowed));
        return self();
    }

    /**
     * Forbids the value from a disallowed set (the filament {@code notIn}).
     *
     * @param disallowed the disallowed values
     * @return this field
     */
    public SELF notIn(java.util.Collection<?> disallowed) {
        rules.rule("not_in", Rules.notIn(disallowed));
        return self();
    }

    /**
     * Requires a well-formed email (the filament {@code email}).
     *
     * @return this field
     */
    public SELF email() {
        rules.rule("email", Rules.email());
        return self();
    }

    /**
     * Requires the value to match a regular expression in full (the filament {@code regex}).
     *
     * @param pattern the regex
     * @return this field
     */
    public SELF regex(String pattern) {
        rules.rule("regex", Rules.regex(pattern));
        return self();
    }

    /**
     * Requires the value to parse as a number (the filament {@code numeric}).
     *
     * @return this field
     */
    public SELF numeric() {
        rules.rule("numeric", Rules.numeric());
        return self();
    }

    /**
     * Requires the value to parse as a whole number (the filament {@code integer}).
     *
     * @return this field
     */
    public SELF integer() {
        rules.rule("integer", Rules.integer());
        return self();
    }

    /**
     * Requires the value to be strictly greater than a sibling field's live value (the filament
     * {@code gt}).
     *
     * @param otherPath the sibling field's state path
     * @return this field
     */
    public SELF gt(String otherPath) {
        rules.rule("gt", Rules.gt(otherPath));
        return self();
    }

    /**
     * Requires the value to be greater than or equal to a sibling field's live value (the filament
     * {@code gte}).
     *
     * @param otherPath the sibling field's state path
     * @return this field
     */
    public SELF gte(String otherPath) {
        rules.rule("gte", Rules.gte(otherPath));
        return self();
    }

    /**
     * Requires the value to be strictly less than a sibling field's live value (the filament
     * {@code lt}).
     *
     * @param otherPath the sibling field's state path
     * @return this field
     */
    public SELF lt(String otherPath) {
        rules.rule("lt", Rules.lt(otherPath));
        return self();
    }

    /**
     * Requires the value to be less than or equal to a sibling field's live value (the filament
     * {@code lte}).
     *
     * @param otherPath the sibling field's state path
     * @return this field
     */
    public SELF lte(String otherPath) {
        rules.rule("lte", Rules.lte(otherPath));
        return self();
    }

    /**
     * Requires the value to equal a sibling field's live value (the filament {@code same}).
     *
     * @param otherPath the sibling field's state path
     * @return this field
     */
    public SELF same(String otherPath) {
        rules.rule("same", Rules.same(otherPath));
        return self();
    }

    /**
     * Requires the value to differ from a sibling field's live value (the filament {@code different}).
     *
     * @param otherPath the sibling field's state path
     * @return this field
     */
    public SELF different(String otherPath) {
        rules.rule("different", Rules.different(otherPath));
        return self();
    }

    /**
     * Requires the value to equal its conventional confirmation sibling {@code <statePath>_confirmation}
     * (the filament {@code confirmed}).
     *
     * @return this field
     */
    public SELF confirmed() {
        String path = statePath();
        rules.rule("confirmed", Rules.confirmed(path == null ? "" : path));
        return self();
    }

    /**
     * Makes the field required only when a sibling field equals an expected value (the filament
     * {@code requiredIf}).
     *
     * @param otherPath the sibling field's state path
     * @param expected the value that makes this field required
     * @return this field
     */
    public SELF requiredIf(String otherPath, Object expected) {
        rules.rule("required_if", Rules.requiredIf(otherPath, expected));
        return self();
    }

    /**
     * Makes the field required when any of the named sibling fields is present (the filament
     * {@code requiredWith}).
     *
     * @param otherPaths the sibling fields whose presence makes this field required
     * @return this field
     */
    public SELF requiredWith(String... otherPaths) {
        rules.rule("required_with", Rules.requiredWith(otherPaths));
        return self();
    }

    /**
     * Makes the field required when any of the named sibling fields is absent (the filament
     * {@code requiredWithout}).
     *
     * @param otherPaths the sibling fields whose absence makes this field required
     * @return this field
     */
    public SELF requiredWithout(String... otherPaths) {
        rules.rule("required_without", Rules.requiredWithout(otherPaths));
        return self();
    }

    /**
     * Requires the value to be unique, ignoring the current record on edit (the filament
     * {@code unique(ignoreRecord)}). The existence check is the app's: a predicate answering whether
     * ANOTHER record already holds the value.
     *
     * @param valueTakenByAnother given the value and the (nullable) current record, whether another
     *     record already holds it
     * @return this field
     */
    public SELF unique(
            java.util.function.BiPredicate<Object, @Nullable Object> valueTakenByAnother) {
        rules.rule("unique", Rules.unique(valueTakenByAnother));
        return self();
    }

    /**
     * Requires the value to exist in the app's backing store (the filament {@code exists}).
     *
     * @param exists whether the value exists in the backing store
     * @return this field
     */
    public SELF exists(java.util.function.Predicate<Object> exists) {
        rules.rule("exists", Rules.exists(exists));
        return self();
    }

    /**
     * Overrides the failure messages of named rules (the filament {@code validationMessages}). Keyed
     * by the rule's name (for example {@code "email"}, {@code "min"}, {@code "unique"}).
     *
     * @param overrides rule name to custom message
     * @return this field
     */
    public SELF validationMessages(java.util.Map<String, String> overrides) {
        rules.validationMessages(overrides);
        return self();
    }

    /**
     * Sets the human attribute name used in default failure messages (the filament
     * {@code validationAttribute}).
     *
     * @param attribute the attribute name (for example "email address")
     * @return this field
     */
    public SELF validationAttribute(String attribute) {
        rules.validationAttribute(attribute);
        return self();
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
