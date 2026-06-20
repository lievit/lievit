/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.wire;

import jakarta.validation.Validation;
import jakarta.validation.Validator;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

import io.lievit.kit.RecordRepository;
import io.lievit.kit.hello.InMemoryListingRepository;
import io.lievit.kit.hello.Listing;
import io.lievit.kit.hello.ListingResource;

/**
 * Minimal Spring Boot app for the SlideOver (K2) wire end-to-end test. Wires the hello-admin
 * {@link ListingResource} (its infolist is the content the slide-over hosts) over an in-memory
 * repository, plus the {@link SlideOverComponent} as a <strong>prototype</strong> bean (a fresh
 * instance per stateless wire call, the runtime contract; the signed snapshot is the only state
 * carrier).
 *
 * <p>Scoped to the {@code wire} package; it reuses the {@code hello} fixtures (the Listing row +
 * its infolist) so the panel renders a real resolved infolist, not a bespoke one.
 */
@SpringBootApplication
public class SlideOverWireTestApp {

    /**
     * @return the in-memory data port (the two-row Listing fixture)
     */
    @Bean
    RecordRepository<Listing> listingRepository() {
        return new InMemoryListingRepository();
    }

    /**
     * @return a Jakarta validator (ListingResource needs one for its form)
     */
    @Bean
    Validator validator() {
        return Validation.buildDefaultValidatorFactory().getValidator();
    }

    /**
     * @param repository the data port
     * @param validator the validator
     * @return the listings resource (its infolist feeds the slide-over)
     */
    @Bean
    ListingResource listingResource(RecordRepository<Listing> repository, Validator validator) {
        return new ListingResource(repository, validator);
    }

    /**
     * @param resource the listings resource whose infolist the panel hosts
     * @return a fresh slide-over component per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    SlideOverComponent slideOverComponent(ListingResource resource) {
        return new SlideOverComponent(resource);
    }
}
