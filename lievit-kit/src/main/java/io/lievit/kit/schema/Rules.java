/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import java.util.Collection;
import java.util.Objects;
import java.util.Set;
import java.util.function.Predicate;
import java.util.regex.Pattern;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.support.EvaluationContext.Operation;

/**
 * The validation rule library: the filament-forms {@code CanBeValidated} surface (~82 methods)
 * decomposed into a coherent set of {@link Rule} factories, grouped by the spec's categories. The
 * rules that map cleanly to Jakarta Bean Validation (size, email, pattern) ALSO live here as
 * state-aware rules so a field can carry one uniform list; the rules Jakarta cannot express (the
 * conditional {@code requiredIf} family, cross-field comparisons, {@code unique}-ignores-the-current
 * -record-on-edit) are the real reason the kit owns this SPI.
 *
 * <p>Documented JSR-380 mapping (which Jakarta constraint a rule mirrors):
 * {@code required}=@NotNull/@NotBlank, {@code min/max}=@Size/@Min/@Max, {@code email}=@Email,
 * {@code regex}=@Pattern, {@code in}=no direct constraint. The conditional and cross-field rules
 * ({@code requiredIf}, {@code gte(field)}, {@code same}, {@code unique}) have NO Jakarta equivalent
 * and are the kit-SPI deliverable.
 */
public final class Rules {

    private static final Pattern EMAIL =
            Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private Rules() {}

    // ── presence / conditional ────────────────────────────────────────────────

    /**
     * @return a rule that fails when the value is null or blank (JSR-380 {@code @NotBlank})
     */
    public static Rule required() {
        return (value, ctx) -> isBlank(value) ? "This field is required." : null;
    }

    /**
     * The {@code requiredIf} rule: required only when a sibling field equals an expected value
     * (reads the live state, so it has no Jakarta equivalent).
     *
     * @param otherPath the sibling field's state path
     * @param expected the value that makes this field required
     * @return the conditional-required rule
     */
    public static Rule requiredIf(String otherPath, Object expected) {
        Objects.requireNonNull(otherPath, "otherPath");
        return (value, ctx) -> {
            boolean triggers = Objects.equals(ctx.get(otherPath), expected)
                    || ctx.getString(otherPath).equals(String.valueOf(expected));
            return triggers && isBlank(value) ? "This field is required." : null;
        };
    }

    /**
     * The {@code requiredUnless} rule: required unless a sibling equals an expected value.
     *
     * @param otherPath the sibling field's state path
     * @param expected the value that makes this field optional
     * @return the conditional-required rule
     */
    public static Rule requiredUnless(String otherPath, Object expected) {
        Objects.requireNonNull(otherPath, "otherPath");
        return (value, ctx) -> {
            boolean exempt = ctx.getString(otherPath).equals(String.valueOf(expected));
            return !exempt && isBlank(value) ? "This field is required." : null;
        };
    }

    /**
     * The {@code prohibitedIf} rule: must be empty when a sibling equals an expected value.
     *
     * @param otherPath the sibling field's state path
     * @param expected the value that prohibits this field
     * @return the conditional-prohibited rule
     */
    public static Rule prohibitedIf(String otherPath, Object expected) {
        Objects.requireNonNull(otherPath, "otherPath");
        return (value, ctx) -> {
            boolean triggers = ctx.getString(otherPath).equals(String.valueOf(expected));
            return triggers && !isBlank(value) ? "This field must be empty." : null;
        };
    }

    // ── string / format ─────────────────────────────────────────────────────────

    /**
     * @return a rule that fails when the value is not a well-formed email (JSR-380 {@code @Email})
     */
    public static Rule email() {
        return (value, ctx) ->
                isBlank(value) || EMAIL.matcher(String.valueOf(value)).matches()
                        ? null
                        : "Must be a valid email address.";
    }

    /**
     * @return a rule that fails when the value is not an http(s) URL
     */
    public static Rule url() {
        return (value, ctx) -> {
            if (isBlank(value)) {
                return null;
            }
            String s = String.valueOf(value);
            return s.startsWith("http://") || s.startsWith("https://")
                    ? null
                    : "Must be a valid URL.";
        };
    }

    /**
     * @return a rule that fails when the value contains non-alphabetic characters
     */
    public static Rule alpha() {
        return (value, ctx) ->
                isBlank(value) || String.valueOf(value).chars().allMatch(Character::isLetter)
                        ? null
                        : "May only contain letters.";
    }

    /**
     * @return a rule that fails when the value contains non-alphanumeric characters
     */
    public static Rule alphaNum() {
        return (value, ctx) ->
                isBlank(value) || String.valueOf(value).chars().allMatch(Character::isLetterOrDigit)
                        ? null
                        : "May only contain letters and numbers.";
    }

    /**
     * The {@code regex} rule (JSR-380 {@code @Pattern}).
     *
     * @param pattern the regex the value must match in full
     * @return the pattern rule
     */
    public static Rule regex(String pattern) {
        Pattern compiled = Pattern.compile(pattern);
        return (value, ctx) ->
                isBlank(value) || compiled.matcher(String.valueOf(value)).matches()
                        ? null
                        : "Has an invalid format.";
    }

    /**
     * The {@code startsWith} rule.
     *
     * @param prefix the required prefix
     * @return the prefix rule
     */
    public static Rule startsWith(String prefix) {
        Objects.requireNonNull(prefix, "prefix");
        return (value, ctx) ->
                isBlank(value) || String.valueOf(value).startsWith(prefix)
                        ? null
                        : "Must start with \"" + prefix + "\".";
    }

    // ── numeric / size ───────────────────────────────────────────────────────────

    /**
     * The {@code min} rule: a string's length or a number's value is at least the bound (JSR-380
     * {@code @Size}/{@code @Min}).
     *
     * @param min the inclusive lower bound
     * @return the minimum rule
     */
    public static Rule min(long min) {
        return (value, ctx) -> {
            if (isBlank(value)) {
                return null;
            }
            return sizeOf(value) < min ? "Must be at least " + min + "." : null;
        };
    }

    /**
     * The {@code max} rule (JSR-380 {@code @Size}/{@code @Max}).
     *
     * @param max the inclusive upper bound
     * @return the maximum rule
     */
    public static Rule max(long max) {
        return (value, ctx) -> {
            if (isBlank(value)) {
                return null;
            }
            return sizeOf(value) > max ? "Must be at most " + max + "." : null;
        };
    }

    /**
     * The field-aware {@code gte} rule: the numeric value must be greater than or equal to a sibling
     * field's live numeric value (cross-field, no Jakarta equivalent).
     *
     * @param otherPath the sibling field's state path
     * @return the cross-field comparison rule
     */
    public static Rule gte(String otherPath) {
        Objects.requireNonNull(otherPath, "otherPath");
        return (value, ctx) -> {
            if (isBlank(value)) {
                return null;
            }
            double self = toNumber(value);
            double other = toNumber(ctx.get(otherPath));
            return self < other ? "Must be greater than or equal to " + otherPath + "." : null;
        };
    }

    // ── set membership ───────────────────────────────────────────────────────────

    /**
     * The {@code in} rule: the value must be one of an allowed set.
     *
     * @param allowed the allowed values
     * @return the membership rule
     */
    public static Rule in(Collection<?> allowed) {
        Set<String> set = Set.copyOf(allowed.stream().map(String::valueOf).toList());
        return (value, ctx) ->
                isBlank(value) || set.contains(String.valueOf(value))
                        ? null
                        : "The selected value is invalid.";
    }

    /**
     * The {@code same} rule: this field's value must equal a sibling field's value (the
     * password-confirmation pattern; cross-field, no Jakarta equivalent).
     *
     * @param otherPath the sibling field's state path
     * @return the equality rule
     */
    public static Rule same(String otherPath) {
        Objects.requireNonNull(otherPath, "otherPath");
        return (value, ctx) ->
                Objects.equals(String.valueOf(value), ctx.getString(otherPath))
                        ? null
                        : "Must match " + otherPath + ".";
    }

    // ── db-backed ──────────────────────────────────────────────────────────────────

    /**
     * The {@code unique} rule with the load-bearing edit-form semantics: on CREATE the value must be
     * absent from the store; on EDIT the current record is ignored by default (so saving an
     * unchanged unique field does not fail against itself). The existence check is the app's, passed
     * as a predicate that answers "does any OTHER record already hold this value?".
     *
     * @param valueTakenByAnother given the value and the (nullable) current record, returns whether
     *     another record already holds it; the kit applies the operation gate so CREATE always
     *     checks and EDIT ignores the current record per the predicate
     * @return the uniqueness rule
     */
    public static Rule unique(java.util.function.BiPredicate<Object, @Nullable Object> valueTakenByAnother) {
        Objects.requireNonNull(valueTakenByAnother, "valueTakenByAnother");
        return (value, ctx) -> {
            if (isBlank(value)) {
                return null;
            }
            @Nullable Object record = ctx.operation() == Operation.EDIT ? ctx.record().orElse(null) : null;
            return valueTakenByAnother.test(value, record) ? "Has already been taken." : null;
        };
    }

    /**
     * The {@code exists} rule: the value must be present in the app's store (the inverse of unique).
     *
     * @param exists answers whether the value exists in the backing store
     * @return the existence rule
     */
    public static Rule exists(Predicate<Object> exists) {
        Objects.requireNonNull(exists, "exists");
        return (value, ctx) -> {
            if (isBlank(value)) {
                return null;
            }
            return exists.test(value) ? null : "The selected value is invalid.";
        };
    }

    // ── helpers ──────────────────────────────────────────────────────────────────

    private static boolean isBlank(@Nullable Object value) {
        return value == null || String.valueOf(value).isBlank();
    }

    private static long sizeOf(Object value) {
        if (value instanceof Number n) {
            return n.longValue();
        }
        if (value instanceof Collection<?> c) {
            return c.size();
        }
        return String.valueOf(value).length();
    }

    private static double toNumber(@Nullable Object value) {
        if (value instanceof Number n) {
            return n.doubleValue();
        }
        String s = value == null ? "" : String.valueOf(value).trim();
        return s.isEmpty() ? 0 : Double.parseDouble(s);
    }
}
