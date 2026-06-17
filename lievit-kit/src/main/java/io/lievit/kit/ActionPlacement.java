/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

/**
 * Where an action is hosted on a table/page (the Filament {@code BelongsToTable} host context):
 * the page header, a table row, or the bulk-action bar.
 */
public enum ActionPlacement {
    /** A header action (resource-scoped, e.g. the "Create" button). */
    HEADER,
    /** A per-row action (record-scoped, e.g. Edit / Delete). */
    ROW,
    /** A bulk action over the selected rows (e.g. "Delete selected"). */
    BULK
}
