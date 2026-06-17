/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

import org.jspecify.annotations.Nullable;

/**
 * The common builder parent of {@link AdminForm} and {@link AdminTable}, shared from v0.1.
 *
 * <p>This is the distilled Filament lesson (filament-internals.md section "Design lessons"): Filament
 * shipped three independent builder hierarchies (Form, Table, Infolist) in v3 and paid a breaking
 * v4 unification under {@code Schema}. lievit-kit puts the shared concerns (heading, the fluent
 * self-type) in one parent from the start, so the form and table builders compose without a later
 * migration.
 *
 * <p>Uses the curiously-recurring self-type {@code SELF} so fluent setters return the concrete
 * builder, keeping the type chain intact ({@code AdminTable.create().heading(...).column(...)}).
 *
 * @param <T> the row type the schema is built for
 * @param <SELF> the concrete builder type, for fluent returns
 */
public abstract class AdminSchema<T, SELF extends AdminSchema<T, SELF>> {

    private @Nullable String heading;

    /** Package-private: only the concrete builders in this package extend the schema. */
    AdminSchema() {}

    /**
     * @return {@code this}, typed as the concrete builder
     */
    @SuppressWarnings("unchecked")
    final SELF self() {
        return (SELF) this;
    }

    /**
     * Sets the schema heading shown above the form or table.
     *
     * @param heading the heading text
     * @return this builder
     */
    public SELF heading(String heading) {
        this.heading = heading;
        return self();
    }

    /**
     * @return the heading, or {@code null} if none was set
     */
    public @Nullable String heading() {
        return heading;
    }
}
