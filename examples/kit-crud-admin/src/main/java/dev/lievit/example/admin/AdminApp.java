/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.example.admin;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

import dev.lievit.EnableLievit;
import dev.lievit.example.admin.product.Product;
import dev.lievit.example.admin.product.ProductSearchComponent;
import dev.lievit.kit.RecordRepository;

/**
 * A small CRUD admin built end-to-end on lievit-kit: a product resource (table + form), full-page
 * MVC CRUD pages that render the kit's view-models, and a reactive lievit search island on the list
 * page. {@code @EnableLievit} turns on the wire runtime; Spring Security guards every page.
 *
 * <p>Run it: {@code ./mvnw -pl examples/kit-crud-admin spring-boot:run}, then open
 * {@code http://localhost:8080/admin/products} and log in as {@code admin} / {@code admin}.
 */
@SpringBootApplication
@EnableLievit
public class AdminApp {

    public static void main(String[] args) {
        SpringApplication.run(AdminApp.class, args);
    }

    /**
     * The reactive search component is a prototype bean: a fresh instance per wire call (state lives
     * in the snapshot), wired with the repository so it can re-query over the wire.
     *
     * @param repository the product data port
     * @return a fresh search component per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    ProductSearchComponent productSearchComponent(RecordRepository<Product> repository) {
        return new ProductSearchComponent(repository);
    }
}
