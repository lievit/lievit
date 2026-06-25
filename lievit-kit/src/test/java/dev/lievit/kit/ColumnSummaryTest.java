/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

/**
 * Specifies per-column summaries (the Filament {@code Columns/Summarizers/*} + {@code
 * CanBeSummarized}): {@link Summarizer#sum()}, {@link Summarizer#average()},
 * {@link Summarizer#count()}, {@link Summarizer#range()} and {@link Summarizer#values()} fold the
 * in-scope cell values into a labelled footer value, multiple summarizers compose on one column, and
 * the fold is a pure function of the rows the page hands it (so it respects active filters/search).
 */
class ColumnSummaryTest {

    record Order(String id, int amount, String region) {}

    private static final List<Order> ORDERS =
            List.of(
                    new Order("1", 100, "north"),
                    new Order("2", 250, "south"),
                    new Order("3", 50, "north"));

    private static Column<Order> amount() {
        Column<Order> c = new Column<>("Amount", Order::amount);
        return c;
    }

    /**
     * @spec.given an amount column summarized with a Sum
     * @spec.when  the footer summary is computed over the in-scope rows
     * @spec.then  it renders the total as a label/value pair
     */
    @Test
    void sum_renders_the_column_total_in_the_footer() {
        Column<Order> col = amount().summarize(Summarizer.sum());

        List<ColumnSummary> summaries = col.summaries(ORDERS);

        assertThat(col.isSummarized()).isTrue();
        assertThat(summaries).hasSize(1);
        assertThat(summaries.get(0).label()).isEqualTo("Sum");
        assertThat(summaries.get(0).value()).isEqualTo("400");
    }

    /**
     * @spec.given an amount column with Average, Count and Range summaries
     * @spec.when  the summaries are computed
     * @spec.then  each produces the matching aggregate, in declaration order
     */
    @Test
    void average_count_and_range_produce_their_aggregates() {
        Column<Order> col =
                amount()
                        .summarize(Summarizer.average())
                        .summarize(Summarizer.count())
                        .summarize(Summarizer.range());

        List<ColumnSummary> s = col.summaries(ORDERS);

        assertThat(s).extracting(ColumnSummary::label).containsExactly("Average", "Count", "Range");
        assertThat(s.get(0).value()).startsWith("133.3"); // 400 / 3
        assertThat(s.get(1).value()).isEqualTo("3");
        assertThat(s.get(2).value()).isEqualTo("50 - 250");
    }

    /**
     * @spec.given a region column summarized with Values
     * @spec.when  the summary is computed
     * @spec.then  it lists the distinct values in encounter order
     */
    @Test
    void values_lists_the_distinct_cell_values() {
        Column<Order> col = new Column<Order>("Region", Order::region).summarize(Summarizer.values());

        assertThat(col.summaries(ORDERS).get(0).value()).isEqualTo("north, south");
    }

    /**
     * @spec.given a summarized column and a filtered (smaller) row set
     * @spec.when  the summary is computed over only the in-scope rows
     * @spec.then  it reflects the filtered scope, not the whole table
     */
    @Test
    void a_summary_respects_the_in_scope_rows_only() {
        Column<Order> col = amount().summarize(Summarizer.sum());

        List<Order> northOnly = ORDERS.stream().filter(o -> o.region().equals("north")).toList();

        assertThat(col.summaries(northOnly).get(0).value()).isEqualTo("150");
    }

    /**
     * @spec.given a Sum summarizer with an overridden label
     * @spec.when  it summarizes an empty row set
     * @spec.then  it carries the custom label and folds to zero
     */
    @Test
    void a_summarizer_label_overrides_and_empty_folds_to_zero() {
        Column<Order> col = amount().summarize(Summarizer.sum().label("Total"));

        ColumnSummary s = col.summaries(List.of()).get(0);

        assertThat(s.label()).isEqualTo("Total");
        assertThat(s.value()).isEqualTo("0");
    }
}
