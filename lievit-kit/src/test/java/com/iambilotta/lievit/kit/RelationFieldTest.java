/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

/**
 * Specifies the relation fields {@link BelongsToField} and {@link HasManyField}: minimal v0.1
 * read-only relation display on a form. No Spring context required.
 */
class RelationFieldTest {

    // ── shared fixtures ───────────────────────────────────────────────────────

    record Category(String id, String name) {}

    record Tag(String id, String label) {}

    static final class CategoryRepository implements RecordRepository<Category> {
        @Override
        public List<Category> findAll() {
            return List.of(new Category("1", "Residential"), new Category("2", "Commercial"));
        }

        @Override
        public Optional<Category> findById(String id) {
            return findAll().stream().filter(c -> c.id().equals(id)).findFirst();
        }
    }

    // ── BelongsToField ────────────────────────────────────────────────────────

    /**
     * @spec.given a BelongsToField for a related Category repository
     * @spec.when  options() is called
     * @spec.then  all records from the related repository are returned (live, not cached at build)
     */
    @Test
    void belongs_to_field_loads_options_from_the_related_repository() {
        BelongsToField<Category> field = BelongsToField.make(
                "categoryId",
                new CategoryRepository(),
                Category::id,
                Category::name);

        assertThat(field.options())
                .extracting(Category::id)
                .containsExactly("1", "2");
    }

    /**
     * @spec.given a BelongsToField with optionValue and optionLabel extractors
     * @spec.when  optionValueOf() and optionLabelOf() are called with a related record
     * @spec.then  each returns the value extracted by the declared function
     */
    @Test
    void belongs_to_field_extracts_option_value_and_label_from_a_related_record() {
        BelongsToField<Category> field = BelongsToField.make(
                "categoryId",
                new CategoryRepository(),
                Category::id,
                Category::name);

        Category residential = new Category("1", "Residential");
        assertThat(field.optionValueOf(residential)).isEqualTo("1");
        assertThat(field.optionLabelOf(residential)).isEqualTo("Residential");
    }

    /**
     * @spec.given a BelongsToField made with name only (humanized label)
     * @spec.when  label() is read
     * @spec.then  it is the humanized form of the name
     */
    @Test
    void belongs_to_field_humanizes_label_when_only_name_is_given() {
        BelongsToField<Category> field = BelongsToField.make(
                "category_id",
                new CategoryRepository(),
                Category::id,
                Category::name);

        assertThat(field.label()).isEqualTo("Category Id");
    }

    /**
     * @spec.given a BelongsToField
     * @spec.when  its type is checked
     * @spec.then  it is an instance of Field (base contract preserved)
     */
    @Test
    void belongs_to_field_is_a_field() {
        BelongsToField<Category> field = BelongsToField.make(
                "categoryId", "Category",
                new CategoryRepository(),
                Category::id,
                Category::name);

        assertThat(field).isInstanceOf(Field.class);
        assertThat(field.name()).isEqualTo("categoryId");
        assertThat(field.label()).isEqualTo("Category");
    }

    // ── HasManyField ──────────────────────────────────────────────────────────

    /**
     * @spec.given a HasManyField backed by a loader that returns two items
     * @spec.when  items() is called
     * @spec.then  the loader's result is returned
     */
    @Test
    void has_many_field_returns_items_from_the_loader() {
        List<Tag> tags = List.of(new Tag("t1", "Garden"), new Tag("t2", "Pool"));
        HasManyField field = HasManyField.make("tags", () -> tags);

        assertThat(field.items()).hasSize(2);
    }

    /**
     * @spec.given a HasManyField
     * @spec.when  its type is checked
     * @spec.then  it is an instance of Field
     */
    @Test
    void has_many_field_is_a_field() {
        HasManyField field = HasManyField.make("tags", "Tags", List::of);

        assertThat(field).isInstanceOf(Field.class);
        assertThat(field.name()).isEqualTo("tags");
        assertThat(field.label()).isEqualTo("Tags");
    }

    /**
     * @spec.given a HasManyField backed by a loader
     * @spec.when  items() is called twice
     * @spec.then  the loader is called each time (not cached), so live data is always returned
     */
    @Test
    void has_many_field_calls_loader_on_every_items_invocation() {
        int[] callCount = {0};
        HasManyField field = HasManyField.make("tags", () -> {
            callCount[0]++;
            return List.of();
        });

        field.items();
        field.items();

        assertThat(callCount[0]).isEqualTo(2);
    }
}
