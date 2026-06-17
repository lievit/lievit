/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

/**
 * The unit of work of the admin layer: one resource per domain entity, exposing a table view (the
 * list) and a form view (create / edit) over the row type {@code <T>} (the filament-internals.md
 * "Resource as the unit of work" carried over).
 *
 * <p>Two deliberate departures from Filament (filament-internals.md "What NOT to carry over"):
 *
 * <ol>
 *   <li><strong>Instance-based, not static.</strong> A resource is a Spring bean: it receives its
 *       {@link RecordRepository} by constructor injection and its {@code table()} /
 *       {@code form()} are instance methods. Statics are hard to test and do not compose with DI.
 *   <li><strong>Persistence-agnostic.</strong> The resource reads rows only through the injected
 *       {@link RecordRepository} port, never a {@code JdbcClient} or {@code JpaRepository}.
 * </ol>
 *
 * <p>A concrete resource overrides {@link #table()} and {@link #form()} to build its two views with
 * the fluent {@link Table} / {@link Form} DSL, and {@link #slug()} / {@link #label()} for
 * its navigation and routes.
 *
 * @param <T> the row type this resource manages
 */
public abstract class Resource<T> {

    private final RecordRepository<T> repository;

    /**
     * @param repository the persistence-agnostic data port, provided by the adopter
     */
    protected Resource(RecordRepository<T> repository) {
        this.repository = repository;
    }

    /**
     * @return the data port for this resource's rows
     */
    public final RecordRepository<T> repository() {
        return repository;
    }

    /**
     * The url slug and route base for this resource (for example {@code "listings"} -&gt;
     * {@code /admin/listings}).
     *
     * @return the slug
     */
    public abstract String slug();

    /**
     * The human label shown in navigation and headings.
     *
     * @return the label
     */
    public abstract String label();

    /**
     * Builds the table (list) view.
     *
     * @return the configured table builder
     */
    public abstract Table<T> table();

    /**
     * Builds the form (create / edit) view. Defaults to an empty form so a read-only,
     * list-only resource (the hello-admin skeleton) need not declare one.
     *
     * @return the configured form builder
     */
    public Form<T> form() {
        return Form.create();
    }
}
