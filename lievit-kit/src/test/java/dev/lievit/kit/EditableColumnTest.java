/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Specifies the inline-editable columns: {@link ToggleColumn} flips a boolean and produces the
 * updated row, {@link TextInputColumn} edits a text value with optional validation, and the
 * {@link EditableColumn} transform is pure (the page persists the result through the repository).
 * The Filament {@code ToggleColumn}/{@code TextInputColumn} + {@code CanUpdateState}, kept as a pure
 * transform so the persistence stays the page's job.
 */
class EditableColumnTest {

    record Listing(String id, boolean active, String title) {}

    /**
     * @spec.given a toggle column reading and writing a boolean
     * @spec.when  the cell is edited to "true"
     * @spec.then  it produces a row with the flag set, without persisting itself
     */
    @Test
    void toggle_column_flips_a_boolean_into_a_new_row() {
        ToggleColumn<Listing> col =
                ToggleColumn.make(
                        "Active",
                        Listing::active,
                        (row, v) -> new Listing(row.id(), v, row.title()));

        Listing edited = col.applyEdit(new Listing("1", false, "x"), "true");

        assertThat(edited.active()).isTrue();
        assertThat(col.valueOf(edited)).isTrue();
    }

    /**
     * @spec.given a text-input column reading and writing a title
     * @spec.when  the cell is edited
     * @spec.then  it produces a row carrying the new value
     */
    @Test
    void text_input_column_edits_a_value_into_a_new_row() {
        TextInputColumn<Listing> col =
                TextInputColumn.make(
                        "Title",
                        Listing::title,
                        (row, v) -> new Listing(row.id(), row.active(), v));

        Listing edited = col.applyEdit(new Listing("1", true, "old"), "new");

        assertThat(edited.title()).isEqualTo("new");
    }

    /**
     * @spec.given a text-input column with a non-blank rule
     * @spec.when  a blank value is validated
     * @spec.then  the validation reports the error message (the edit is to be rejected)
     */
    @Test
    void text_input_column_validates_an_edit() {
        TextInputColumn<Listing> col =
                TextInputColumn.<Listing>make(
                                "Title",
                                Listing::title,
                                (row, v) -> new Listing(row.id(), row.active(), v))
                        .rule(v -> v.isBlank() ? "required" : null);

        assertThat(col.validate("")).contains("required");
        assertThat(col.validate("ok")).isEmpty();
    }

    /**
     * @spec.given a select column over a closed option set
     * @spec.when  an on-list value is edited in
     * @spec.then  it produces a row carrying the chosen value
     */
    @Test
    void select_column_edits_a_chosen_option_into_a_new_row() {
        SelectColumn<Listing> col =
                SelectColumn.make(
                        "Status",
                        Listing::title,
                        java.util.List.of(SelectOption.of("draft", "Draft"), SelectOption.of("live", "Live")),
                        (row, v) -> new Listing(row.id(), row.active(), v));

        Listing edited = col.applyEdit(new Listing("1", true, "draft"), "live");

        assertThat(edited.title()).isEqualTo("live");
        assertThat(col.options()).hasSize(2);
    }

    /**
     * @spec.given a select column over a closed option set
     * @spec.when  an off-list value is validated and then applied
     * @spec.then  validation rejects it and applyEdit refuses to smuggle it into the row
     */
    @Test
    void select_column_rejects_an_off_list_value() {
        SelectColumn<Listing> col =
                SelectColumn.make(
                        "Status",
                        Listing::title,
                        java.util.List.of(SelectOption.of("draft", "Draft")),
                        (row, v) -> new Listing(row.id(), row.active(), v));

        assertThat(col.validate("deleted")).isPresent();
        org.assertj.core.api.Assertions.assertThatThrownBy(
                        () -> col.applyEdit(new Listing("1", true, "draft"), "deleted"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
