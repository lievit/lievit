/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;

/**
 * Specifies the concrete {@link Column} subtypes: each carries the base label+cell contract and
 * adds type-specific rendering or metadata through a fluent factory API. No Spring context needed.
 */
class ColumnTypesTest {

    record Product(String name, String status, boolean available, LocalDate releaseDate) {}

    // ── TextColumn ────────────────────────────────────────────────────────────

    /**
     * @spec.given a TextColumn with a value extractor
     * @spec.when  cell() is called with a row
     * @spec.then  it returns the extracted value as text (same as base Column)
     */
    @Test
    void text_column_extracts_cell_value_as_text() {
        TextColumn<Product> col = TextColumn.make("Name", Product::name);

        assertThat(col.cell(new Product("Widget", "draft", true, LocalDate.of(2026, 1, 1))))
                .isEqualTo("Widget");
    }

    /**
     * @spec.given a TextColumn with no sortable flag set
     * @spec.when  sortable() is read
     * @spec.then  it returns false (opt-in, not the default)
     */
    @Test
    void text_column_is_not_sortable_by_default() {
        TextColumn<Product> col = TextColumn.make("Name", Product::name);

        assertThat(col.sortable()).isFalse();
    }

    /**
     * @spec.given a TextColumn with .makeSortable() called
     * @spec.when  sortable() is read
     * @spec.then  it returns true
     */
    @Test
    void text_column_becomes_sortable_when_make_sortable_is_called() {
        TextColumn<Product> col = TextColumn.make("Name", Product::name).makeSortable();

        assertThat(col.sortable()).isTrue();
    }

    /**
     * @spec.given a TextColumn with .sortable(false) called explicitly after .makeSortable()
     * @spec.when  sortable() is read
     * @spec.then  it returns false
     */
    @Test
    void text_column_sortable_can_be_set_explicitly_to_false() {
        TextColumn<Product> col = TextColumn.make("Name", Product::name).makeSortable().sortable(false);

        assertThat(col.sortable()).isFalse();
    }

    // ── TextColumn.money ──────────────────────────────────────────────────────

    record Priced(String name, Object price) {}

    /**
     * @spec.given a TextColumn.money column over a numeric (Number) price accessor
     * @spec.when  cell() is called
     * @spec.then  the value is formatted as a currency amount in the declared currency
     */
    @Test
    void money_column_formats_a_numeric_value_as_currency() {
        TextColumn<Priced> col = TextColumn.<Priced>make("Price", Priced::price).money("EUR");

        // Locale-independent: assert the euro symbol and the significant digits are present,
        // not the locale's grouping/decimal separators.
        assertThat(col.cell(new Priced("Widget", 1234.5)))
                .contains("€")
                .containsPattern("1.?234.?50");
    }

    /**
     * @spec.given a TextColumn.money column over a String price accessor holding a numeric string
     * @spec.when  cell() is called
     * @spec.then  the numeric string is parsed and formatted as currency, not a ClassCastException
     */
    @Test
    void money_column_parses_a_numeric_string_accessor() {
        TextColumn<Priced> col = TextColumn.<Priced>make("Price", Priced::price).money("EUR");

        assertThat(col.cell(new Priced("Widget", "1234.5")))
                .contains("€")
                .containsPattern("1.?234.?50");
    }

    /**
     * @spec.given a TextColumn.money column over a null price accessor
     * @spec.when  cell() is called
     * @spec.then  it renders the empty string
     */
    @Test
    void money_column_renders_empty_for_null_value() {
        TextColumn<Priced> col = TextColumn.<Priced>make("Price", Priced::price).money("EUR");

        assertThat(col.cell(new Priced("Widget", null))).isEmpty();
    }

    /**
     * @spec.given a TextColumn.money column over a non-numeric String accessor
     * @spec.when  cell() is called
     * @spec.then  it throws a clear IllegalArgumentException, never a raw ClassCastException
     */
    @Test
    void money_column_rejects_a_non_numeric_value_with_a_clear_error() {
        TextColumn<Priced> col = TextColumn.<Priced>make("Price", Priced::price).money("EUR");

        org.assertj.core.api.Assertions
                .assertThatThrownBy(() -> col.cell(new Priced("Widget", "not-a-price")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not-a-price");
    }

    // ── BadgeColumn ───────────────────────────────────────────────────────────

    /**
     * @spec.given a BadgeColumn with a colour mapper
     * @spec.when  colorFor() is called with a row whose status is "draft"
     * @spec.then  the mapper's output is returned (the CSS class for that status)
     */
    @Test
    void badge_column_maps_cell_value_to_css_class() {
        BadgeColumn<Product> col = BadgeColumn.make("Status", Product::status)
                .color(v -> "draft".equals(v) ? "badge-grey" : "badge-green");

        Product draft = new Product("Widget", "draft", true, LocalDate.of(2026, 1, 1));
        assertThat(col.colorFor(draft)).isEqualTo("badge-grey");
        assertThat(col.cell(draft)).isEqualTo("draft");
    }

    /**
     * @spec.given a BadgeColumn with no colour mapper registered
     * @spec.when  colorFor() is called
     * @spec.then  it returns an empty string
     */
    @Test
    void badge_column_returns_empty_css_class_when_no_mapper_is_registered() {
        BadgeColumn<Product> col = BadgeColumn.make("Status", Product::status);

        assertThat(col.colorFor(new Product("Widget", "draft", true, LocalDate.of(2026, 1, 1))))
                .isEmpty();
    }

    // ── BooleanColumn ─────────────────────────────────────────────────────────

    /**
     * @spec.given a BooleanColumn with default icon names
     * @spec.when  cell() is called for a row where the flag is true
     * @spec.then  it returns the default true icon name
     */
    @Test
    void boolean_column_returns_true_icon_for_true_value() {
        BooleanColumn<Product> col = BooleanColumn.make("Available", Product::available);

        assertThat(col.cell(new Product("Widget", "draft", true, LocalDate.of(2026, 1, 1))))
                .isEqualTo(BooleanColumn.DEFAULT_TRUE_ICON);
    }

    /**
     * @spec.given a BooleanColumn with default icon names
     * @spec.when  cell() is called for a row where the flag is false
     * @spec.then  it returns the default false icon name
     */
    @Test
    void boolean_column_returns_false_icon_for_false_value() {
        BooleanColumn<Product> col = BooleanColumn.make("Available", Product::available);

        assertThat(col.cell(new Product("Widget", "draft", false, LocalDate.of(2026, 1, 1))))
                .isEqualTo(BooleanColumn.DEFAULT_FALSE_ICON);
    }

    /**
     * @spec.given a BooleanColumn with custom icon names configured
     * @spec.when  cell() is called
     * @spec.then  the custom icon names are returned
     */
    @Test
    void boolean_column_uses_custom_icon_names_when_configured() {
        BooleanColumn<Product> col = BooleanColumn.make("Available", Product::available)
                .trueIcon("checkmark-circle")
                .falseIcon("close-circle");

        assertThat(col.trueIcon()).isEqualTo("checkmark-circle");
        assertThat(col.falseIcon()).isEqualTo("close-circle");
        assertThat(col.cell(new Product("Widget", "draft", true, LocalDate.of(2026, 1, 1))))
                .isEqualTo("checkmark-circle");
    }

    // ── DateColumn ────────────────────────────────────────────────────────────

    /**
     * @spec.given a DateColumn with no format pattern
     * @spec.when  cell() is called
     * @spec.then  the temporal's own toString is returned
     */
    @Test
    void date_column_falls_back_to_temporal_to_string_when_no_pattern_is_set() {
        DateColumn<Product> col = DateColumn.make("Released", Product::releaseDate);
        LocalDate date = LocalDate.of(2026, 3, 15);

        assertThat(col.cell(new Product("Widget", "draft", true, date)))
                .isEqualTo(date.toString());  // ISO-8601: "2026-03-15"
    }

    /**
     * @spec.given a DateColumn with a format pattern configured
     * @spec.when  cell() is called
     * @spec.then  the date is formatted using that pattern
     */
    @Test
    void date_column_formats_with_declared_pattern() {
        DateColumn<Product> col = DateColumn.make("Released", Product::releaseDate)
                .format("dd/MM/yyyy");
        LocalDate date = LocalDate.of(2026, 3, 15);

        assertThat(col.cell(new Product("Widget", "draft", true, date)))
                .isEqualTo("15/03/2026");
    }

    /**
     * @spec.given a DateColumn
     * @spec.when  pattern() is read before format() is called
     * @spec.then  it returns null
     */
    @Test
    void date_column_has_null_pattern_by_default() {
        DateColumn<Product> col = DateColumn.make("Released", Product::releaseDate);

        assertThat(col.pattern()).isNull();
    }

    // ── Table integration ─────────────────────────────────────────────────────

    /**
     * @spec.given a Table with typed columns added via the column(Column) overload
     * @spec.when  columns() is read
     * @spec.then  both typed columns appear in declaration order with their correct runtime types
     */
    @Test
    void table_accepts_typed_columns_via_column_instance_overload() {
        Table<Product> table = Table.<Product>create()
                .column(TextColumn.make("Name", Product::name).makeSortable())
                .column(BooleanColumn.make("Available", Product::available));

        assertThat(table.columns()).hasSize(2);
        assertThat(table.columns().get(0)).isInstanceOf(TextColumn.class);
        assertThat(table.columns().get(1)).isInstanceOf(BooleanColumn.class);
        assertThat(((TextColumn<?>) table.columns().get(0)).sortable()).isTrue();
    }
}
