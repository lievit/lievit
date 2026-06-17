/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Optional;

/**
 * A ternary filter: true / false / all (the Filament {@code TernaryFilter}). When set to true or
 * false it narrows the query to rows matching that boolean; the "all" state (the filter inactive)
 * imposes no constraint.
 *
 * <p>The state value is {@link #TRUE} or {@link #FALSE}; an absent value (or {@link #ALL}) means no
 * constraint. {@link #resolve(FilterState)} reads the state back as a tri-state {@code Optional}
 * of {@code Boolean}.
 */
public final class TernaryFilter extends Filter {

    /** The filter-state value meaning "true". */
    public static final String TRUE = "true";
    /** The filter-state value meaning "false". */
    public static final String FALSE = "false";
    /** The (absent) filter-state value meaning "no constraint". */
    public static final String ALL = "";

    private TernaryFilter(String name) {
        super(name);
    }

    /**
     * @param name the filter name (the {@link FilterState} key and, by default, the boolean column)
     * @return a ternary filter
     */
    public static TernaryFilter make(String name) {
        return new TernaryFilter(name);
    }

    /**
     * Reads the tri-state value back from the filter state.
     *
     * @param state the active filter state
     * @return {@code Optional.of(true/false)} when constrained, {@code Optional.empty()} for "all"
     */
    public Optional<Boolean> resolve(FilterState state) {
        Optional<String> v = state.value(name());
        if (v.isEmpty()) {
            return Optional.empty();
        }
        return switch (v.get()) {
            case TRUE -> Optional.of(Boolean.TRUE);
            case FALSE -> Optional.of(Boolean.FALSE);
            default -> Optional.empty();
        };
    }
}
