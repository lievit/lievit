/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

import dev.lievit.kit.support.EvaluationContext;

/**
 * A related-record picker that opens a searchable TABLE modal (the filament-forms
 * {@code ModalTableSelect} / {@code TableSelect} carried over onto the schema engine): instead of a
 * flat dropdown, the user picks from a table of candidate rows with multiple columns, useful when an
 * id alone is not enough to choose. It binds the selected record id (or a list of ids, when
 * {@link #multiple()}), exactly like {@link Select}; the modal table is the selection affordance.
 *
 * <p>The candidate rows and their columns are supplied generically over a row type {@code R} so the
 * kit never hard-codes the relation mechanism: the adopter provides a candidate source and the
 * column extractors, and the kit builds the modal {@link Row rows} the island renders. Each row
 * carries the value written to the bound state plus the ordered cell strings.
 *
 * @param <R> the candidate row type shown in the modal table
 */
public final class ModalTableSelect<R> extends SchemaField<Object, ModalTableSelect<R>> {

    /** One column of the modal table: a header label and a cell extractor over the row type. */
    public record TableColumn<R>(String label, Function<? super R, String> cell) {
        /** Compact constructor: defends non-null. */
        public TableColumn {
            Objects.requireNonNull(label, "label");
            Objects.requireNonNull(cell, "cell");
        }
    }

    /**
     * One rendered modal-table row: the value written to the bound state when chosen plus the
     * ordered cell strings aligned with the columns.
     *
     * @param value the value persisted to the bound state when this row is chosen
     * @param cells the cell strings, aligned with {@link ModalTableSelect#columns()}
     */
    public record Row(String value, List<String> cells) {
        /** Compact constructor: defends the cell list. */
        public Row {
            cells = List.copyOf(cells);
        }
    }

    private Function<EvaluationContext, List<R>> candidates = ctx -> List.of();
    private Function<? super R, String> rowValue = r -> String.valueOf(r);
    private final List<TableColumn<R>> columns = new ArrayList<>();
    private boolean multiple;
    private boolean searchable = true;

    private ModalTableSelect(String name) {
        super(name);
    }

    /**
     * @param name the field name and state path
     * @param <R> the candidate row type
     * @return a new modal-table select
     */
    public static <R> ModalTableSelect<R> make(String name) {
        return new ModalTableSelect<>(name);
    }

    /**
     * Sets a fixed candidate row set.
     *
     * @param rows the candidate rows
     * @return this field
     */
    public ModalTableSelect<R> candidates(List<R> rows) {
        List<R> snapshot = List.copyOf(Objects.requireNonNull(rows, "rows"));
        this.candidates = ctx -> snapshot;
        return this;
    }

    /**
     * Sets a candidate row set that recomputes from the live state (a dependent picker).
     *
     * @param source produces the candidate rows from the live context
     * @return this field
     */
    public ModalTableSelect<R> candidatesUsing(Function<EvaluationContext, List<R>> source) {
        this.candidates = Objects.requireNonNull(source, "source");
        return this;
    }

    /**
     * Sets the extractor that maps a candidate row to the value written to the bound state when the
     * row is chosen (its id). Defaults to the row's {@code toString()}.
     *
     * @param rowValue the row-to-value extractor
     * @return this field
     */
    public ModalTableSelect<R> rowValue(Function<? super R, String> rowValue) {
        this.rowValue = Objects.requireNonNull(rowValue, "rowValue");
        return this;
    }

    /**
     * Adds a modal-table column (a header label and a cell extractor over the row type).
     *
     * @param label the column header
     * @param cell extracts the cell string from a candidate row
     * @return this field
     */
    public ModalTableSelect<R> column(String label, Function<? super R, String> cell) {
        columns.add(new TableColumn<>(label, cell));
        return this;
    }

    /**
     * @return the modal-table columns in declaration order (unmodifiable)
     */
    public List<TableColumn<R>> columns() {
        return List.copyOf(columns);
    }

    /**
     * Allows selecting multiple rows (binds a list of ids, casts through the multi-value cast like
     * {@link Select#multiple()}).
     *
     * @return this field
     */
    public ModalTableSelect<R> multiple() {
        this.multiple = true;
        cast(multiCast());
        return this;
    }

    /**
     * @return {@code true} if multiple rows may be selected
     */
    public boolean isMultiple() {
        return multiple;
    }

    /**
     * Disables the modal search box (on by default: the table modal is the searchable variant).
     *
     * @return this field
     */
    public ModalTableSelect<R> notSearchable() {
        this.searchable = false;
        return this;
    }

    /**
     * @return {@code true} if the modal table is searchable
     */
    public boolean isSearchable() {
        return searchable;
    }

    /**
     * Resolves the modal-table rows against the live context: one {@link Row} per candidate, its
     * value from the row-value extractor and its cells from the declared columns.
     *
     * @param context the live evaluation context
     * @return the modal-table rows in candidate order
     */
    public List<Row> resolveRows(EvaluationContext context) {
        List<Row> out = new ArrayList<>();
        for (R candidate : candidates.apply(context)) {
            List<String> cells = new ArrayList<>();
            for (TableColumn<R> column : columns) {
                cells.add(column.cell().apply(candidate));
            }
            out.add(new Row(rowValue.apply(candidate), cells));
        }
        return out;
    }

    /** Adapts the list-valued multi cast to this field's {@code Object} value type. */
    private static StateCast<Object> multiCast() {
        StateCast<List<String>> delegate = CheckboxList.multiValueCast();
        return new StateCast<>() {
            @Override
            public @Nullable Object hydrate(@Nullable Object raw) {
                return delegate.hydrate(raw);
            }

            @Override
            @SuppressWarnings("unchecked")
            public @Nullable Object dehydrate(@Nullable Object value) {
                return delegate.dehydrate((List<String>) value);
            }
        };
    }
}
