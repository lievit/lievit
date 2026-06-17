/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit;

import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * The result of a {@link LievitFormObject#validate()} call: a map from field name to the list of
 * human-readable violation messages for that field (ADR-0017).
 *
 * <p>An empty result means the form is valid. A non-empty result carries at least one violation for
 * at least one field. Keys are the <em>field names</em> as they appear in the form object (the
 * unqualified Java field name, e.g. {@code "email"}, {@code "password"}).
 *
 * @param violations field name → list of violation messages (immutable; empty when valid)
 */
public record FormValidationResult(Map<String, List<String>> violations) {

    /** Defensive copy so callers cannot mutate the result after construction. */
    public FormValidationResult {
        violations = Map.copyOf(violations);
    }

    /** The empty (valid) result. */
    public static final FormValidationResult VALID = new FormValidationResult(Map.of());

    /**
     * @return {@code true} when the form carries at least one violation
     */
    public boolean hasErrors() {
        return !violations.isEmpty();
    }

    /**
     * @return {@code true} when the form carries no violations (is valid)
     */
    public boolean isValid() {
        return violations.isEmpty();
    }

    /**
     * Returns the violation messages for the named field, or an empty list when the field is valid.
     *
     * @param field the field name (unqualified)
     * @return the violation messages, possibly empty
     */
    public List<String> errorsFor(String field) {
        return violations.getOrDefault(field, List.of());
    }

    /**
     * @return all violation messages across all fields, in no guaranteed order
     */
    public Collection<String> allErrors() {
        return violations.values().stream().flatMap(List::stream).toList();
    }
}
