/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.example.admin.product;

import java.util.List;
import java.util.Map;

import jakarta.validation.Validator;

import org.springframework.stereotype.Component;

import io.lievit.kit.BadgeColumn;
import io.lievit.kit.Form;
import io.lievit.kit.FormBinder;
import io.lievit.kit.FormValidator;
import io.lievit.kit.RecordRepository;
import io.lievit.kit.Resource;
import io.lievit.kit.SelectField;
import io.lievit.kit.SelectOption;
import io.lievit.kit.SortDirection;
import io.lievit.kit.Table;
import io.lievit.kit.TextColumn;
import io.lievit.kit.TextField;

/**
 * The lievit-kit resource for {@link Product}: it declares the table (the list view) and the form
 * (the create/edit view). The kit derives the {@code AdminListView} / {@code AdminFormView}
 * view-models from this; the controllers render them.
 *
 * <p>It is a normal Spring bean that takes its repository by constructor injection. The same
 * resource works over any {@link RecordRepository} implementation (here in-memory, but JDBC or JPA
 * would not change a line of this class).
 */
@Component
public class ProductResource extends Resource<Product> {

    private final Validator validator;

    public ProductResource(RecordRepository<Product> repository, Validator validator) {
        super(repository);
        this.validator = validator;
    }

    @Override
    public String slug() {
        return "products";
    }

    @Override
    public String label() {
        return "Products";
    }

    @Override
    public Table<Product> table() {
        return Table.<Product>create()
                .id(Product::id)
                .heading("Products")
                .striped()
                .column(TextColumn.make("Name", Product::name).makeSortable().searchable())
                .column(TextColumn.make("SKU", Product::sku).searchable())
                .column(
                        BadgeColumn.make("Status", Product::status)
                                .color(ProductResource::statusColor))
                .column(
                        TextColumn.make("Price", Product::price)
                                .formatStateUsing(price -> "€ " + price))
                .defaultSort("name", SortDirection.ASC);
    }

    @Override
    public Form<Product> form() {
        return Form.<Product>create()
                .heading("Product")
                .field(TextField.make("name", "Name"))
                .field(TextField.make("sku", "SKU"))
                .field(
                        SelectField.make(
                                "status",
                                "Status",
                                List.of(
                                        SelectOption.of("draft", "Draft"),
                                        SelectOption.of("active", "Active"),
                                        SelectOption.of("archived", "Archived"))))
                .field(TextField.make("price", "Price (EUR)"))
                .binder(new ProductBinder())
                .validator(new FormValidator(validator));
    }

    /** Maps a product status to a badge colour token the template renders. */
    private static String statusColor(String status) {
        return switch (status) {
            case "active" -> "green";
            case "archived" -> "grey";
            default -> "amber";
        };
    }

    /**
     * Translates between the form's string state and the {@link Product} record. The binder is what
     * makes the form writable (a form without a binder is read-only). It is reflection-free by
     * design: the adopter owns the field-to-record mapping.
     */
    static final class ProductBinder implements FormBinder<Product> {

        @Override
        public Product toRecord(Product existing, Map<String, String> state) {
            String id = existing == null ? null : existing.id();
            return new Product(
                    id,
                    state.getOrDefault("name", "").trim(),
                    state.getOrDefault("sku", "").trim(),
                    state.getOrDefault("status", "draft"),
                    state.getOrDefault("price", "").trim());
        }

        @Override
        public Map<String, String> toState(Product record) {
            return Map.of(
                    "name", record.name(),
                    "sku", record.sku(),
                    "status", record.status(),
                    "price", record.price());
        }
    }
}
