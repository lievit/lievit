/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import io.lievit.kit.RecordRepository.Query;

/**
 * Specifies {@link BulkSelection} (the Filament select-rows + select-all-across-pages state, AC#1 of
 * issue 251): a selection is either an explicit set of row ids (the checkboxes on the current page)
 * or an "all matching" mode that survives pagination by resolving every id matching the live query
 * from the resource, with optional deselected exceptions.
 */
class BulkSelectionTest {

    record Item(String id) {}

    /**
     * @spec.given an explicit selection of two ids
     * @spec.when  it is resolved
     * @spec.then  it yields exactly those ids and is not the all-matching mode
     */
    @Test
    void an_explicit_selection_yields_the_checked_ids() {
        BulkSelection selection = BulkSelection.of(List.of("1", "3"));

        assertThat(selection.isAllMatching()).isFalse();
        assertThat(selection.resolve(resource(List.of("1", "2", "3", "4")), Query.of(0, 2)))
                .containsExactly("1", "3");
    }

    /**
     * @spec.given an all-matching selection over a four-row store paged two at a time
     * @spec.when  it is resolved against the resource and the live query
     * @spec.then  it yields every matching id across pages, not just the current page
     */
    @Test
    void all_matching_survives_pagination() {
        BulkSelection selection = BulkSelection.allMatching();

        List<String> resolved =
                selection.resolve(resource(List.of("1", "2", "3", "4")), Query.of(0, 2));

        assertThat(resolved).containsExactly("1", "2", "3", "4");
    }

    /**
     * @spec.given an all-matching selection with one id deselected
     * @spec.when  it is resolved
     * @spec.then  the deselected id is excluded from the matching set
     */
    @Test
    void all_matching_honours_deselected_exceptions() {
        BulkSelection selection = BulkSelection.allMatching().deselect(List.of("2"));

        List<String> resolved =
                selection.resolve(resource(List.of("1", "2", "3", "4")), Query.of(0, 2));

        assertThat(resolved).containsExactly("1", "3", "4");
    }

    /**
     * @spec.given an empty explicit selection
     * @spec.when  its emptiness is read
     * @spec.then  it reports empty so the bulk bar stays hidden
     */
    @Test
    void an_empty_selection_is_reported_empty() {
        assertThat(BulkSelection.of(List.of()).isEmpty()).isTrue();
        assertThat(BulkSelection.of(List.of("1")).isEmpty()).isFalse();
        assertThat(BulkSelection.allMatching().isEmpty()).isFalse();
    }

    static Resource<Item> resource(List<String> ids) {
        RecordRepository<Item> repo =
                new RecordRepository<>() {
                    @Override
                    public Page<Item> page(Query query) {
                        List<Item> all = ids.stream().map(Item::new).toList();
                        int from = Math.min(query.offset(), all.size());
                        int to = Math.min(from + query.limit(), all.size());
                        return Page.of(all.subList(from, to), all.size());
                    }

                    @Override
                    public Optional<Item> findById(String id) {
                        return ids.contains(id) ? Optional.of(new Item(id)) : Optional.empty();
                    }

                    @Override
                    public Item create(Item record) {
                        return record;
                    }

                    @Override
                    public Item update(String id, Item record) {
                        return record;
                    }

                    @Override
                    public void delete(String id) {}
                };
        return new Resource<>(repo) {
            @Override
            public String slug() {
                return "items";
            }

            @Override
            public String label() {
                return "Items";
            }

            @Override
            public Table<Item> table() {
                return Table.<Item>create().id(Item::id).column("Id", Item::id);
            }
        };
    }
}
