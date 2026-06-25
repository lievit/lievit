/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.hello;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import dev.lievit.kit.RecordRepository;

/**
 * The adopter-supplied data port for the hello-admin worked example: a mutable in-memory store.
 * Proves the kit reads and writes rows only through {@link RecordRepository}, never a hard-coded
 * persistence engine (so the same resource would work over JDBC or JPA by swapping this bean), and
 * exercises the full CRUD spine end to end (bounded page read + create + update + delete).
 */
public final class InMemoryListingRepository implements RecordRepository<Listing> {

    private final List<Listing> rows = new ArrayList<>();
    private final AtomicLong sequence = new AtomicLong();

    /** Seeds two rows, the worked-example fixture. */
    public InMemoryListingRepository() {
        create(new Listing(0, "Parma"));
        create(new Listing(0, "Reggio Emilia"));
    }

    @Override
    public Page<Listing> page(Query query) {
        int from = Math.min(query.offset(), rows.size());
        int to = Math.min(from + query.limit(), rows.size());
        return Page.of(List.copyOf(rows.subList(from, to)), rows.size());
    }

    @Override
    public Optional<Listing> findById(String id) {
        return rows.stream().filter(l -> String.valueOf(l.ref()).equals(id)).findFirst();
    }

    @Override
    public synchronized Listing create(Listing record) {
        Listing assigned = new Listing(sequence.incrementAndGet(), record.city());
        rows.add(assigned);
        return assigned;
    }

    @Override
    public synchronized Listing update(String id, Listing record) {
        for (int i = 0; i < rows.size(); i++) {
            if (String.valueOf(rows.get(i).ref()).equals(id)) {
                Listing updated = new Listing(rows.get(i).ref(), record.city());
                rows.set(i, updated);
                return updated;
            }
        }
        throw new IllegalArgumentException("no Listing with id " + id);
    }

    @Override
    public synchronized void delete(String id) {
        rows.removeIf(l -> String.valueOf(l.ref()).equals(id));
    }
}
