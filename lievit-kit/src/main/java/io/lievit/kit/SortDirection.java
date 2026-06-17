/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

/**
 * The direction a table column is sorted in (the Filament {@code CanSortRecords} asc/desc toggle).
 */
public enum SortDirection {
    /** Ascending order (A→Z, 0→9, oldest→newest). */
    ASC,
    /** Descending order (Z→A, 9→0, newest→oldest). */
    DESC;

    /**
     * @return the opposite direction (the toggle a clickable header performs)
     */
    public SortDirection toggle() {
        return this == ASC ? DESC : ASC;
    }
}
