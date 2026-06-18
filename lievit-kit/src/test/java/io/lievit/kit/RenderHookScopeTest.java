/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.function.Supplier;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;

/**
 * Specifies render hooks as the named extension surface (the Filament {@code FilamentView}
 * register/render hooks): a global hook renders everywhere the point appears, a scoped hook fires
 * only for its declared page/resource scope, {@link Panel#hasRenderHook} lets the layout skip the
 * wrapper when nothing is registered, and the standard {@link RenderHook} catalog is available.
 */
class RenderHookScopeTest {

    private static List<String> render(List<Supplier<String>> hooks) {
        return hooks.stream().map(Supplier::get).collect(Collectors.toList());
    }

    /**
     * @spec.given a panel with a global topbar-end hook
     * @spec.when  the point is resolved for any scope
     * @spec.then  the global fragment renders and hasRenderHook reports it present
     */
    @Test
    void a_global_hook_renders_at_its_point() {
        Panel panel = Panel.create("admin").renderHook(RenderHook.TOPBAR_END, () -> "<button>x</button>");

        assertThat(panel.hasRenderHook(RenderHook.TOPBAR_END)).isTrue();
        assertThat(render(panel.renderHooks(RenderHook.TOPBAR_END, "any.scope")))
                .containsExactly("<button>x</button>");
    }

    /**
     * @spec.given a panel with a hook scoped to one resource
     * @spec.when  the point is resolved for the matching vs a different scope
     * @spec.then  the scoped fragment fires only for its declared scope
     */
    @Test
    void a_scoped_hook_fires_only_for_its_scope() {
        Panel panel =
                Panel.create("admin")
                        .renderHook(RenderHook.PAGE_START, "PostResource", () -> "<banner/>");

        assertThat(render(panel.renderHooks(RenderHook.PAGE_START, "PostResource")))
                .containsExactly("<banner/>");
        assertThat(panel.renderHooks(RenderHook.PAGE_START, "UserResource")).isEmpty();
        assertThat(panel.renderHooks(RenderHook.PAGE_START, null)).isEmpty();
    }

    /**
     * @spec.given a panel with a global and a scoped hook at the same point
     * @spec.when  the point is resolved for the scoped surface
     * @spec.then  the global renders first, then the matching scoped one
     */
    @Test
    void global_and_scoped_hooks_compose_at_a_point() {
        Panel panel =
                Panel.create("admin")
                        .renderHook(RenderHook.CONTENT_BEFORE, () -> "<global/>")
                        .renderHook(RenderHook.CONTENT_BEFORE, "Dashboard", () -> "<dash/>");

        assertThat(render(panel.renderHooks(RenderHook.CONTENT_BEFORE, "Dashboard")))
                .containsExactly("<global/>", "<dash/>");
    }

    /**
     * @spec.given a panel with no hooks at a point
     * @spec.when  hasRenderHook is checked
     * @spec.then  it reports absent so the layout can skip the wrapper markup
     */
    @Test
    void has_render_hook_is_false_when_nothing_is_registered() {
        assertThat(Panel.create("admin").hasRenderHook(RenderHook.BODY_END)).isFalse();
    }

    /**
     * @spec.given the standard hook catalog
     * @spec.when  the topbar/sidebar/auth names are read
     * @spec.then  they follow the kit:: namespace convention
     */
    @Test
    void the_standard_hook_catalog_is_namespaced() {
        assertThat(RenderHook.TOPBAR_END).isEqualTo("kit::topbar.end");
        assertThat(RenderHook.SIDEBAR_NAV_START).startsWith("kit::sidebar");
        assertThat(RenderHook.AUTH_LOGIN_FORM_BEFORE).startsWith("kit::auth.login");
    }
}
