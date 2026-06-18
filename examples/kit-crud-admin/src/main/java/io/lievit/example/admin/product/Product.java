/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.example.admin.product;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import org.jspecify.annotations.Nullable;

/**
 * The domain row the admin manages. A plain record carrying Jakarta Bean Validation constraints so
 * the kit's {@code FormValidator} can reject an invalid create/edit; lievit-kit is otherwise
 * persistence-agnostic and the row type needs no framework annotations.
 *
 * @param id the row id ({@code null} on a fresh create; a string id once persisted)
 * @param name the product name (required)
 * @param sku the stock-keeping unit (required)
 * @param status one of {@code draft} / {@code active} / {@code archived}
 * @param price the unit price in euros (digits with an optional two-decimal part)
 */
public record Product(
        @Nullable String id,
        @NotBlank(message = "Name is required") String name,
        @NotBlank(message = "SKU is required") String sku,
        String status,
        @Pattern(regexp = "\\d+(\\.\\d{1,2})?", message = "Price must be a number like 12.50")
                String price) {}
