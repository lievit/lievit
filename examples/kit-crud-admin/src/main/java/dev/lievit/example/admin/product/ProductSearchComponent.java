/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.example.admin.product;

import java.util.List;

import dev.lievit.LievitComponent;
import dev.lievit.Wire;
import dev.lievit.kit.RecordRepository;

/**
 * A reactive lievit component embedded on the product list page: a live-search box bound to
 * {@code term} (the {@code l:model.live} input in the template) that re-queries the repository over
 * the wire on every keystroke and shows the matching products, with no page reload and no JSON API.
 *
 * <p>This demonstrates the wire loop alongside the kit's server-rendered CRUD pages: the kit table is
 * a full-page MVC view; this is the interactive island. A fresh instance serves each wire call, so
 * state lives only in the signed snapshot (the {@code term}); the result list is recomputed on each
 * render and never serialized.
 */
@LievitComponent(template = "admin/product-search")
public class ProductSearchComponent {

    /** Bound to the search input ({@code l:model.live}); the only state carried in the snapshot. */
    @Wire
    public String term = "";

    private final transient RecordRepository<Product> repository;

    public ProductSearchComponent(RecordRepository<Product> repository) {
        this.repository = repository;
    }

    /**
     * The matches for the current term, recomputed on every render. Not a {@code @Wire} field: it is
     * derived state, so it never rides the snapshot and the client cannot tamper with it.
     *
     * @return up to 10 products whose name or SKU matches the term (all of them when the term is blank)
     */
    public List<Product> results() {
        RecordRepository.Query query =
                new RecordRepository.Query(
                        0,
                        10,
                        dev.lievit.kit.Sort.NONE,
                        term == null ? "" : term,
                        dev.lievit.kit.FilterState.EMPTY);
        return repository.page(query).rows();
    }
}
