/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The full-page CRUD page drivers of lievit-kit: the reusable List / Create / Edit page logic a
 * concrete {@code @LievitComponent} delegates to.
 *
 * <p>The lievit core binds only the {@code @Wire} fields and {@code @LievitAction} methods declared
 * on the component class <em>itself</em> ({@code ComponentMetadata} reflects {@code getDeclaredFields}
 * /{@code getDeclaredMethods}, not inherited members). So the kit cannot ship abstract base
 * <em>components</em> that carry wire state; instead it ships plain drivers
 * ({@link com.iambilotta.lievit.kit.page.ListPageDriver},
 * {@link com.iambilotta.lievit.kit.page.FormPageDriver}) that a concrete page component composes,
 * declaring its own wire fields + actions and delegating the logic here. This mirrors the hello-admin
 * list component delegating to {@link com.iambilotta.lievit.kit.AdminListView}.
 *
 * <p>This is <strong>full-page</strong> CRUD only (List / Create / Edit at distinct URLs, navigation
 * via the {@link com.iambilotta.lievit.component.LievitEffects} redirect substrate). Modal /
 * single-page CRUD needs the nested-component primitive and lands in a separate wave.
 */
@NullMarked
package com.iambilotta.lievit.kit.page;

import org.jspecify.annotations.NullMarked;
