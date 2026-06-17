/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit.hello;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

import com.iambilotta.lievit.kit.RecordRepository;

/**
 * Minimal Spring Boot app for the hello-admin end-to-end test. Wires the adopter-supplied data port,
 * the admin resource, and the list component as a <strong>prototype</strong> bean (a fresh instance
 * per stateless wire call, the runtime contract; the snapshot is the only state carrier).
 */
@SpringBootApplication
public class HelloAdminTestApp {

    /**
     * @return the in-memory data port standing in for the adopter's persistence
     */
    @Bean
    RecordRepository<Listing> listingRepository() {
        return new InMemoryListingRepository();
    }

    /**
     * @param repository the data port
     * @return the admin resource for listings
     */
    @Bean
    ListingResource listingResource(RecordRepository<Listing> repository) {
        return new ListingResource(repository);
    }

    /**
     * @param resource the admin resource
     * @return a fresh list component per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    ListingAdminListComponent listingAdminListComponent(ListingResource resource) {
        return new ListingAdminListComponent(resource);
    }
}
