/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.example.admin.product;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.stereotype.Repository;

import io.lievit.kit.RecordRepository;

/**
 * The data port for {@link Product}, backed by an in-memory list (so the demo needs no database).
 * lievit-kit reads and writes only through {@link RecordRepository}, so swapping this for a JDBC or
 * JPA implementation would not touch the resource, the controllers, or the templates.
 *
 * <p>The read is bounded: {@link #page(Query)} honours the offset/limit window and reports the total
 * for pagination. A real implementation would apply {@link Query#search()} and {@link Query#filters()}
 * in SQL; this demo applies the search in memory to keep the example self-contained.
 */
@Repository
public class InMemoryProductRepository implements RecordRepository<Product> {

    private final List<Product> rows = new ArrayList<>();
    private final AtomicInteger sequence = new AtomicInteger();

    /** Seeds a handful of products so the list page is not empty on first run. */
    public InMemoryProductRepository() {
        create(new Product(null, "Espresso Machine", "ESP-001", "active", "499.00"));
        create(new Product(null, "Burr Grinder", "GRD-002", "active", "189.00"));
        create(new Product(null, "Milk Frother", "FRT-003", "draft", "59.00"));
        create(new Product(null, "Travel Mug", "MUG-004", "archived", "24.50"));
        create(new Product(null, "Filter Papers", "FLT-005", "active", "8.00"));
        create(new Product(null, "Descaler", "DSC-006", "draft", "12.00"));
    }

    @Override
    public Page<Product> page(Query query) {
        List<Product> filtered = matching(query.search());
        int from = Math.min(query.offset(), filtered.size());
        int to = Math.min(from + query.limit(), filtered.size());
        return Page.of(new ArrayList<>(filtered.subList(from, to)), filtered.size());
    }

    @Override
    public Optional<Product> findById(String id) {
        return rows.stream().filter(p -> p.id().equals(id)).findFirst();
    }

    @Override
    public Product create(Product record) {
        Product created =
                new Product(
                        String.valueOf(sequence.incrementAndGet()),
                        record.name(),
                        record.sku(),
                        record.status(),
                        record.price());
        rows.add(created);
        return created;
    }

    @Override
    public Product update(String id, Product record) {
        Product updated =
                new Product(id, record.name(), record.sku(), record.status(), record.price());
        for (int i = 0; i < rows.size(); i++) {
            if (rows.get(i).id().equals(id)) {
                rows.set(i, updated);
                return updated;
            }
        }
        rows.add(updated);
        return updated;
    }

    @Override
    public void delete(String id) {
        rows.removeIf(p -> p.id().equals(id));
    }

    /** Returns the rows whose name or SKU contains the (case-insensitive) search term. */
    private List<Product> matching(String search) {
        if (search == null || search.isBlank()) {
            return rows;
        }
        String needle = search.toLowerCase();
        List<Product> out = new ArrayList<>();
        for (Product p : rows) {
            if (p.name().toLowerCase().contains(needle) || p.sku().toLowerCase().contains(needle)) {
                out.add(p);
            }
        }
        return out;
    }
}
