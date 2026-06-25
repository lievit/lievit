/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

/**
 * The contract of an inline-editable table column (the Filament {@code CanUpdateState} concern): the
 * user edits the cell in place and the column produces the updated row, which the page persists
 * through the {@link RecordRepository}. The kit holds the transform; it never persists itself.
 *
 * @param <T> the row type
 */
public interface EditableColumn<T> {

    /**
     * Applies an inline edit to a row, returning the new row state (the persistence is the page's
     * job, through {@link RecordRepository#update}).
     *
     * @param row the current row
     * @param newValue the submitted value, as a string from the wire
     * @return the updated row
     */
    T applyEdit(T row, String newValue);
}
