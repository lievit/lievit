/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

import java.util.List;
import java.util.Optional;

/**
 * The persistence-agnostic data port for an {@link Resource} (the filament-internals.md lesson:
 * never hard-code {@code JdbcClient} or {@code JpaRepository}; the adopter wires the data).
 *
 * <p>Filament couples its whole data path to {@code getEloquentQuery()}; lievit-kit refuses that
 * coupling. A resource declares the row type {@code <T>} and the kit reads rows only through this
 * interface, so the same admin works over JDBC, JPA, an HTTP backend, or an in-memory list. The
 * adopter provides the implementation as a bean and the resource holds a reference to it.
 *
 * <p>v0.1 covers the read path the hello-admin skeleton needs (list + find by id). Write operations
 * (save, delete) are deliberately deferred to the form-submission slice; adding them here without a
 * test that demands them would be speculative surface.
 *
 * @param <T> the row type the resource lists
 */
public interface RecordRepository<T> {

    /**
     * Lists the rows for the table view.
     *
     * @return all rows, in the repository's natural order (paging is a later concern)
     */
    List<T> findAll();

    /**
     * Looks up a single row by its string id (the value {@link Table#id(java.util.function.Function)}
     * derives from a row).
     *
     * @param id the row id
     * @return the row, or empty if no row has that id
     */
    Optional<T> findById(String id);
}
