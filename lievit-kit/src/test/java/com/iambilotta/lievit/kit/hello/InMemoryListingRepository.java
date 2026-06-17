/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit.hello;

import java.util.List;
import java.util.Optional;

import com.iambilotta.lievit.kit.AdminRecordRepository;

/**
 * The adopter-supplied data port for the hello-admin: an in-memory list. Proves the kit reads rows
 * only through {@link AdminRecordRepository}, never a hard-coded persistence engine (so the same
 * resource would work over JDBC or JPA by swapping this bean).
 */
public final class InMemoryListingRepository implements AdminRecordRepository<Listing> {

    private final List<Listing> rows =
            List.of(new Listing(1, "Parma"), new Listing(2, "Reggio Emilia"));

    @Override
    public List<Listing> findAll() {
        return rows;
    }

    @Override
    public Optional<Listing> findById(String id) {
        return rows.stream().filter(l -> String.valueOf(l.ref()).equals(id)).findFirst();
    }
}
