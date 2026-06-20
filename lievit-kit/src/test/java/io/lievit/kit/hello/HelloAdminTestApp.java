/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.hello;

import jakarta.validation.Validation;
import jakarta.validation.Validator;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

import io.lievit.kit.RecordRepository;

/**
 * Minimal Spring Boot app for the hello-admin end-to-end CRUD test. Wires the adopter-supplied data
 * port, a Jakarta validator, the admin resource, and the three full-page CRUD components as
 * <strong>prototype</strong> beans (a fresh instance per stateless wire call, the runtime contract;
 * the snapshot is the only state carrier).
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
     * @return a Jakarta {@link Validator} (built directly so the slice needs no extra Boot
     *     autoconfiguration; a real app uses the autoconfigured {@code LocalValidatorFactoryBean})
     */
    @Bean
    Validator validator() {
        return Validation.buildDefaultValidatorFactory().getValidator();
    }

    /**
     * @param repository the data port
     * @param validator the Jakarta validator
     * @return the admin resource for listings
     */
    @Bean
    ListingResource listingResource(RecordRepository<Listing> repository, Validator validator) {
        return new ListingResource(repository, validator);
    }

    /**
     * @param resource the admin resource
     * @return a fresh list page component per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    ListingListComponent listingListComponent(ListingResource resource) {
        return new ListingListComponent(resource);
    }

    /**
     * @param resource the admin resource
     * @return a fresh create page component per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    ListingCreateComponent listingCreateComponent(ListingResource resource) {
        return new ListingCreateComponent(resource);
    }

    /**
     * @param resource the admin resource
     * @return a fresh edit page component per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    ListingEditComponent listingEditComponent(ListingResource resource) {
        return new ListingEditComponent(resource);
    }

    /**
     * @param resource the admin resource
     * @return a fresh view (detail) page component per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    ListingViewComponent listingViewComponent(ListingResource resource) {
        return new ListingViewComponent(resource);
    }
}
