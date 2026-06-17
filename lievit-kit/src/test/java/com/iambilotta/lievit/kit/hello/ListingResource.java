/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit.hello;

import com.iambilotta.lievit.kit.Form;
import com.iambilotta.lievit.kit.RecordRepository;
import com.iambilotta.lievit.kit.Resource;
import com.iambilotta.lievit.kit.Table;

/**
 * The hello-admin resource: one {@link Resource} for the {@link Listing} entity, list-only for
 * the skeleton. Instance-based (it takes its repository by constructor injection) and
 * persistence-agnostic (it never touches a DB directly).
 */
public final class ListingResource extends Resource<Listing> {

    /**
     * @param repository the adopter-supplied data port
     */
    public ListingResource(RecordRepository<Listing> repository) {
        super(repository);
    }

    @Override
    public String slug() {
        return "listings";
    }

    @Override
    public String label() {
        return "Listings";
    }

    @Override
    public Table<Listing> table() {
        return Table.<Listing>create()
                .heading("Listings")
                .id(l -> String.valueOf(l.ref()))
                .column("Ref", Listing::ref)
                .column("City", Listing::city);
    }

    @Override
    public Form<Listing> form() {
        return Form.<Listing>create().heading("Listing").field("city");
    }
}
