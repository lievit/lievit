/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

/**
 * Specifies the {@link Panel} builder DSL: a named surface that accumulates resources, render
 * hooks, and plugins, and runs the plugin {@code register}/{@code boot} lifecycle (ADR-0008; the
 * filament-internals.md Panel builder mapped to a Spring configuration DSL, kept under ten concerns).
 */
class PanelTest {

    static final class StringRepo implements RecordRepository<String> {
        @Override
        public Page<String> page(Query query) {
            return Page.of(List.of("a", "b"), 2);
        }

        @Override
        public Optional<String> findById(String id) {
            return Optional.of(id);
        }

        @Override
        public String create(String record) {
            return record;
        }

        @Override
        public String update(String id, String record) {
            return record;
        }

        @Override
        public void delete(String id) {}
    }

    static final class StringsResource extends Resource<String> {
        StringsResource() {
            super(new StringRepo());
        }

        @Override
        public String slug() {
            return "strings";
        }

        @Override
        public String label() {
            return "Strings";
        }

        @Override
        public Table<String> table() {
            return Table.<String>create().column("Value", s -> s);
        }
    }

    /**
     * @spec.given a panel with an id
     * @spec.when  a resource is registered
     * @spec.then  the panel exposes it and reports its own id (a named, configurable surface)
     * @spec.adr   ADR-0008
     */
    @Test
    void registers_a_resource_under_a_named_panel() {
        Resource<String> resource = new StringsResource();
        Panel panel = Panel.create("admin").resource(resource);

        assertThat(panel.id()).isEqualTo("admin");
        assertThat(panel.resources()).containsExactly(resource);
    }

    /**
     * @spec.given a panel and a render hook registered at CONTENT_BEFORE
     * @spec.when  the hooks for that point are read
     * @spec.then  the registered fragment supplier is returned (the named injection surface)
     * @spec.adr   ADR-0008
     */
    @Test
    void registers_a_render_hook_at_a_named_point() {
        Panel panel =
                Panel.create("admin")
                        .renderHook(RenderHook.CONTENT_BEFORE, () -> "<div>banner</div>");

        assertThat(panel.renderHooks(RenderHook.CONTENT_BEFORE))
                .extracting(java.util.function.Supplier::get)
                .containsExactly("<div>banner</div>");
    }

    /**
     * @spec.given a panel with no hooks at a point
     * @spec.when  the hooks for that point are read
     * @spec.then  an empty list is returned, never null
     * @spec.adr   ADR-0008
     */
    @Test
    void returns_no_hooks_for_an_unused_point() {
        Panel panel = Panel.create("admin");

        assertThat(panel.renderHooks(RenderHook.BODY_END)).isEmpty();
    }

    /**
     * @spec.given a plugin that registers a resource and flips a boot flag
     * @spec.when  the plugin is applied to the panel
     * @spec.then  register runs (the resource appears) and boot runs after assembly
     * @spec.adr   ADR-0008
     */
    @Test
    void applies_a_plugin_running_register_then_boot() {
        boolean[] booted = {false};
        Plugin plugin =
                new Plugin() {
                    @Override
                    public String getId() {
                        return "demo";
                    }

                    @Override
                    public void register(Panel panel) {
                        panel.resource(new StringsResource());
                    }

                    @Override
                    public void boot(Panel panel) {
                        booted[0] = true;
                    }
                };

        Panel panel = Panel.create("admin").plugin(plugin);

        assertThat(panel.resources()).hasSize(1);
        assertThat(panel.plugin("demo")).containsSame(plugin);
        assertThat(booted[0]).isTrue();
    }
}
