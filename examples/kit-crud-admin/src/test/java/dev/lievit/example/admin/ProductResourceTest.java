/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.example.admin;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import jakarta.validation.Validation;
import jakarta.validation.Validator;

import org.junit.jupiter.api.Test;

import dev.lievit.example.admin.product.InMemoryProductRepository;
import dev.lievit.example.admin.product.Product;
import dev.lievit.example.admin.product.ProductResource;
import dev.lievit.kit.AdminFormView;
import dev.lievit.kit.AdminListView;
import dev.lievit.kit.SaveResult;

/**
 * Pure (no-Spring) tests of the kit wiring: the resource derives the list and form view-models, and
 * the form's save path validates the bound record. These run in the fast surefire loop.
 */
class ProductResourceTest {

    private static final Validator VALIDATOR =
            Validation.buildDefaultValidatorFactory().getValidator();

    private ProductResource resource() {
        return new ProductResource(new InMemoryProductRepository(), VALIDATOR);
    }

    /**
     * @spec.given the product resource over the seeded in-memory repository
     * @spec.when  the first list page (size 5) view-model is built
     * @spec.then  it carries the declared column headers and a bounded page of rows
     */
    @Test
    void list_view_has_headers_and_a_bounded_page_of_rows() {
        AdminListView view = AdminListView.of(resource(), 1, 5);

        assertThat(view.headers()).containsExactly("Name", "SKU", "Status", "Price");
        assertThat(view.rows()).hasSize(5); // page size, not the 6 seeded rows
        assertThat(view.pagination().totalPages()).isEqualTo(2);
        assertThat(view.pagination().hasNext()).isTrue();
    }

    /**
     * @spec.given the product resource's form
     * @spec.when  the create form view-model is built
     * @spec.then  it carries one field view per declared field, in order
     */
    @Test
    void form_view_lists_the_declared_fields() {
        AdminFormView form = AdminFormView.of(resource().form(), false, Map.of(), List.of());

        assertThat(form.fields())
                .extracting(AdminFormView.FieldView::name)
                .containsExactly("name", "sku", "status", "price");
    }

    /**
     * @spec.given a valid product state
     * @spec.when  the form saves it as a create
     * @spec.then  the save succeeds and the repository holds the new row
     */
    @Test
    void valid_state_saves_a_new_product() {
        InMemoryProductRepository repo = new InMemoryProductRepository();
        ProductResource res = new ProductResource(repo, VALIDATOR);
        long before = repo.page(dev.lievit.kit.RecordRepository.Query.of(0, 100)).total();

        SaveResult<Product> result =
                res.form()
                        .save(
                                repo,
                                null,
                                Map.of(
                                        "name", "Cold Brew Kit",
                                        "sku", "CBK-007",
                                        "status", "active",
                                        "price", "39.00"));

        assertThat(result.ok()).isTrue();
        assertThat(result.record().name()).isEqualTo("Cold Brew Kit");
        assertThat(repo.page(dev.lievit.kit.RecordRepository.Query.of(0, 100)).total())
                .isEqualTo(before + 1);
    }

    /**
     * @spec.given an invalid product state (blank name, non-numeric price)
     * @spec.when  the form tries to save it
     * @spec.then  the save fails carrying the per-field validation errors and persists nothing
     */
    @Test
    void invalid_state_fails_with_field_errors() {
        InMemoryProductRepository repo = new InMemoryProductRepository();
        ProductResource res = new ProductResource(repo, VALIDATOR);

        SaveResult<Product> result =
                res.form()
                        .save(
                                repo,
                                null,
                                Map.of("name", "", "sku", "X-1", "status", "draft", "price", "free"));

        assertThat(result.ok()).isFalse();
        assertThat(result.errors())
                .extracting(dev.lievit.kit.FieldError::field)
                .contains("name", "price");
    }
}
