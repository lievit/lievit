/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

/**
 * The CRUD operations an {@link AdminAuthorizer} gates, one per full-page action (the Filament
 * resource-page operation set, minus the modal-only ones deferred to the nested-component wave).
 */
public enum AdminOperation {
    /** View the list page. */
    VIEW_LIST,
    /** Create a new record. */
    CREATE,
    /** Update an existing record. */
    UPDATE,
    /** Delete a record. */
    DELETE
}
