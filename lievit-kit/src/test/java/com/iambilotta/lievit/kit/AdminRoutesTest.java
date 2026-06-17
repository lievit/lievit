/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/**
 * Specifies {@link AdminRoutes}: the one place the full-page CRUD URL shape of a resource under a
 * panel lives, so the pages, the actions, and the navigation agree on where list / create / edit go.
 */
class AdminRoutesTest {

    /**
     * @spec.given a panel id and a resource slug
     * @spec.when  the CRUD URLs are derived
     * @spec.then  they follow the /{panel}/{slug}[/create|/{id}/edit] shape
     * @spec.adr   ADR-0008
     */
    @Test
    void derives_the_full_page_crud_urls() {
        AdminRoutes routes = new AdminRoutes("admin", "listings");

        assertThat(routes.list()).isEqualTo("/admin/listings");
        assertThat(routes.create()).isEqualTo("/admin/listings/create");
        assertThat(routes.edit("42")).isEqualTo("/admin/listings/42/edit");
    }

    /**
     * @spec.given a blank panel id
     * @spec.when  the routes are constructed
     * @spec.then  it rejects the blank component (a route prefix must be non-blank)
     * @spec.adr   ADR-0008
     */
    @Test
    void rejects_a_blank_route_component() {
        assertThatThrownBy(() -> new AdminRoutes("", "listings"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
