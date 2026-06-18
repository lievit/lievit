/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The QueryBuilder filter family (the Filament query-builder package carried over): constraint-based
 * advanced filtering for power users. A {@link io.lievit.kit.querybuilder.QueryBuilder} is a single
 * {@link io.lievit.kit.Filter} under which the user composes {@link
 * io.lievit.kit.querybuilder.Constraint constraints} across many columns into a list of {@link
 * io.lievit.kit.querybuilder.Predicate predicates} the adopter's repository turns into a WHERE
 * clause. The kit carries the intent and the presentation; it never executes the query, the same
 * persistence-agnostic contract the rest of the filter family follows.
 */
@org.jspecify.annotations.NullMarked
package io.lievit.kit.querybuilder;
