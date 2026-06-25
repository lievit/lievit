/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

/**
 * A soft-delete filter: without-trashed (the default), with-trashed, or only-trashed (the Filament
 * {@code TrashedFilter}). The repository reads the resolved {@link Scope} and adjusts its soft-delete
 * query scope; the kit never executes it.
 *
 * <p>Following Filament's contract: an inactive filter (no value) means without-trashed (live rows
 * only); the user explicitly opts into with-trashed or only-trashed.
 */
public final class TrashedFilter extends Filter {

    /** The default filter name when none is given. */
    public static final String DEFAULT_NAME = "trashed";

    /** The three soft-delete scopes. */
    public enum Scope {
        /** Live rows only (the default). */
        WITHOUT_TRASHED,
        /** Live rows plus soft-deleted rows. */
        WITH_TRASHED,
        /** Soft-deleted rows only. */
        ONLY_TRASHED
    }

    private TrashedFilter(String name) {
        super(name);
        label("Deleted records");
    }

    /**
     * @return a trashed filter named {@value #DEFAULT_NAME}
     */
    public static TrashedFilter make() {
        return new TrashedFilter(DEFAULT_NAME);
    }

    /**
     * @param name an explicit filter name
     * @return a trashed filter with that name
     */
    public static TrashedFilter make(String name) {
        return new TrashedFilter(name);
    }

    /**
     * Resolves the soft-delete scope from the filter state.
     *
     * @param state the active filter state
     * @return the scope (without-trashed when the filter is inactive)
     */
    public Scope scope(FilterState state) {
        return switch (state.value(name()).orElse("")) {
            case "with" -> Scope.WITH_TRASHED;
            case "only" -> Scope.ONLY_TRASHED;
            default -> Scope.WITHOUT_TRASHED;
        };
    }
}
