/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Pagination primitives (issue #197, the Livewire {@code WithPagination} analogue): offset
 * ({@link io.lievit.pagination.OffsetPage}, {@code paginate()}) and keyset/cursor
 * ({@link io.lievit.pagination.CursorPage}, {@code cursorPaginate()}) page values, the
 * {@link io.lievit.pagination.Paginators} factory over an adopter-supplied data SPI, and the
 * {@link io.lievit.pagination.PageState} {@code $page} state with named pages + page-reset-on-filter.
 *
 * <p>Pure Java, zero Spring and zero JDBC (ADR-0007): lievit assumes no ORM, so the data fetch is the
 * adopter's {@code SELECT ... LIMIT/OFFSET} or keyset query behind {@code Paginators.OffsetSource} /
 * {@code Paginators.CursorSource}. The cursor path matters for large legacy tables where {@code OFFSET}
 * is a performance trap. URL sync rides the existing {@code @LievitUrl} {@code url} effect (no new
 * wire marker); the client {@code l:page} directive drives the page actions.
 */
@org.jspecify.annotations.NullMarked
package io.lievit.pagination;
