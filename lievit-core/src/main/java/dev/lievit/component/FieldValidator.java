/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * SPI: validates a component instance after client updates have been applied and before any
 * {@code @LievitAction} runs.
 *
 * <p>Implementations return a map of {@code fieldName -> [message, ...]}. An empty map (or
 * {@code null}) means "no errors": actions run normally. A non-empty map means one or more fields
 * are invalid: the errors are written to the effects channel (as the {@code errors} effect in the
 * {@code Lievit-Effects} header) and the actions are <em>skipped</em> for this call — validation is
 * server-authoritative.
 *
 * <p>Only validation messages are ever surfaced to the client; internal class names, stack traces,
 * and payload content are never exposed (ADR-0014, fail-closed posture).
 *
 * <p>The default implementation ({@link NoOpFieldValidator}) passes every instance unchanged, so
 * omitting a validator in tests or small apps has zero cost.
 *
 * <p>The Spring Boot starter auto-configures a {@link jakarta.validation.Validator}-backed
 * implementation when Hibernate Validator is on the classpath; applications may provide their own
 * bean to override.
 */
public interface FieldValidator {

    /**
     * Validates {@code instance} and returns per-field constraint violations.
     *
     * @param instance the rehydrated + updated component instance to validate
     * @return a map from {@code @Wire} field name to its constraint-violation messages; empty or
     *     {@code null} if the instance is valid
     */
    Map<String, List<String>> validate(Object instance);

    /**
     * Validates {@code instance} but surfaces only the violations of the field named {@code field}
     * (Livewire {@code validateOnly($field)} parity, ADR-0038). This is the seam that powers
     * real-time per-field validation on a {@code wire:model} update: when the user edits one field,
     * the dispatcher validates and surfaces only that field's error, never the still-invalid
     * neighbours' errors (which the user has not touched yet).
     *
     * <p>The default implementation runs the full {@link #validate(Object)} and filters the bag, so
     * it works for any implementation, including a non-Bean-Validation custom validator. Matching
     * rules (Livewire's dot/star convention):
     *
     * <ul>
     *   <li><b>Exact</b>: a plain name ({@code "email"}) or a dotted form-object field
     *       ({@code "form.email"}) matches the same key.
     *   <li><b>Star</b>: a rule key containing {@code .*.} ({@code "items.*.qty"}) matches every
     *       indexed array-element path Bean Validation produced ({@code "items[0].qty"},
     *       {@code "items[1].qty"}), so one rule validates all elements of a {@code @Valid} collection.
     * </ul>
     *
     * @param instance the rehydrated + updated component instance to validate
     * @param field the field name (or dotted path, or {@code items.*.qty} star rule) to surface
     * @return the violations for the matched field(s) only; empty when the field is valid
     */
    default Map<String, List<String>> validateOnly(Object instance, String field) {
        Map<String, List<String>> all = validate(instance);
        if (all == null || all.isEmpty()) {
            return Map.of();
        }
        Pattern star = starPattern(field);
        Map<String, List<String>> only = new LinkedHashMap<>();
        for (Map.Entry<String, List<String>> entry : all.entrySet()) {
            String key = entry.getKey();
            boolean matches = star != null ? star.matcher(key).matches() : key.equals(field);
            if (matches) {
                only.put(key, entry.getValue());
            }
        }
        return only;
    }

    /**
     * Compiles a star rule key ({@code items.*.qty}) into a regex matching the indexed paths Bean
     * Validation emits ({@code items[0].qty}). Returns {@code null} when {@code field} carries no
     * {@code .*.} segment (an exact match is used instead). The {@code *} matches a single path
     * segment's index; literal segments are quoted so a {@code .} matches only a dot.
     */
    private static Pattern starPattern(String field) {
        if (!field.contains(".*.")) {
            return null;
        }
        // Map the Livewire star convention onto Bean Validation's indexed container-element paths:
        //   items.*.qty  ->  items[0].qty / items[1].qty / ...
        // The ".*." before a property becomes "[<index>]." (the dot is kept, only the index varies).
        StringBuilder regex = new StringBuilder();
        String[] segments = field.split("\\.", -1);
        boolean first = true;
        for (String segment : segments) {
            if (segment.equals("*")) {
                // No separator dot before an index: it attaches to the preceding container segment.
                regex.append("\\[\\d+\\]");
            } else {
                if (!first) {
                    regex.append("\\.");
                }
                regex.append(Pattern.quote(segment));
            }
            first = false;
        }
        return Pattern.compile(regex.toString());
    }
}
