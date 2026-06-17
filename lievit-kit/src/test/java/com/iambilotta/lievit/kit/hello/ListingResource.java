/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit.hello;

import com.iambilotta.lievit.kit.AdminForm;
import com.iambilotta.lievit.kit.AdminRecordRepository;
import com.iambilotta.lievit.kit.AdminResource;
import com.iambilotta.lievit.kit.AdminTable;

/**
 * The hello-admin resource: one {@link AdminResource} for the {@link Listing} entity, list-only for
 * the skeleton. Instance-based (it takes its repository by constructor injection) and
 * persistence-agnostic (it never touches a DB directly).
 */
public final class ListingResource extends AdminResource<Listing> {

    /**
     * @param repository the adopter-supplied data port
     */
    public ListingResource(AdminRecordRepository<Listing> repository) {
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
    public AdminTable<Listing> table() {
        return AdminTable.<Listing>create()
                .heading("Listings")
                .id(l -> String.valueOf(l.ref()))
                .column("Ref", Listing::ref)
                .column("City", Listing::city);
    }

    @Override
    public AdminForm<Listing> form() {
        return AdminForm.<Listing>create().heading("Listing").field("city");
    }
}
