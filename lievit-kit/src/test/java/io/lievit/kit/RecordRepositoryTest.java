/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

/**
 * Specifies the {@link RecordRepository} read window {@link RecordRepository.Query} and
 * {@link RecordRepository.Page}: the page read is bounded (offset + limit), the query clamps hostile
 * or empty parameters to a sane range, and {@code findAll} stays answerable as a default over
 * {@code page} so an adopter need only implement the bounded read.
 */
class RecordRepositoryTest {

    /**
     * @spec.given a one-based page number and a size
     * @spec.when  a Query is built for that page
     * @spec.then  the offset is (page - 1) * size and the limit is the size
     * @spec.adr   ADR-0008
     */
    @Test
    void builds_a_bounded_window_from_a_one_based_page_number() {
        RecordRepository.Query query = RecordRepository.Query.page(3, 10);

        assertThat(query.offset()).isEqualTo(20);
        assertThat(query.limit()).isEqualTo(10);
    }

    /**
     * @spec.given a negative offset and a non-positive limit (a hostile or empty page parameter)
     * @spec.when  a Query is built
     * @spec.then  the offset clamps to 0 and the limit clamps to at least 1 (no negative window)
     * @spec.adr   ADR-0008
     */
    @Test
    void clamps_a_hostile_window_to_a_sane_range() {
        RecordRepository.Query query = RecordRepository.Query.of(-5, 0);

        assertThat(query.offset()).isZero();
        assertThat(query.limit()).isEqualTo(1);
    }

    /**
     * @spec.given a repository that only implements the bounded page read
     * @spec.when  findAll() is called
     * @spec.then  the default delegates to a single large page, so it still answers
     * @spec.adr   ADR-0008
     */
    @Test
    void find_all_defaults_to_a_single_large_page() {
        RecordRepository<String> repo =
                new RecordRepository<>() {
                    private final List<String> rows = List.of("a", "b", "c");

                    @Override
                    public Page<String> page(Query query) {
                        int from = Math.min(query.offset(), rows.size());
                        int to = Math.min(from + query.limit(), rows.size());
                        return Page.of(rows.subList(from, to), rows.size());
                    }

                    @Override
                    public java.util.Optional<String> findById(String id) {
                        return rows.stream().filter(r -> r.equals(id)).findFirst();
                    }

                    @Override
                    public String create(String record) {
                        return record;
                    }

                    @Override
                    public String update(String id, String record) {
                        return record;
                    }

                    @Override
                    public void delete(String id) {}
                };

        assertThat(repo.findAll()).containsExactly("a", "b", "c");
    }

    /**
     * @spec.given a page of rows and a total larger than the page
     * @spec.when  the page is built
     * @spec.then  it carries the rows defensively copied and reports the across-all-pages total
     * @spec.adr   ADR-0008
     */
    @Test
    void a_page_carries_its_rows_and_the_total() {
        RecordRepository.Page<String> page = RecordRepository.Page.of(List.of("x", "y"), 9);

        assertThat(page.rows()).containsExactly("x", "y");
        assertThat(page.total()).isEqualTo(9);
        assertThat(page.isEmpty()).isFalse();
    }
}
