/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Supplier;

/**
 * A named, independently configurable admin surface, built with a fluent DSL (the
 * filament-internals.md Panel builder, mapped to a Spring configuration DSL instead of a Laravel
 * {@code ServiceProvider}). One application can run several panels (for example {@code admin} and a
 * customer portal), each with its own resources, pages, render hooks, and plugins.
 *
 * <p>Deliberately kept under ten concerns (the filament-internals.md lesson: Filament's {@code Panel}
 * accumulates ~35 traits; heavy concerns like tenancy and multi-auth are opt-in later modules, not
 * baked into the core panel). v0.1 holds resources, render hooks, and plugins.
 */
public final class Panel {

    private final String id;
    private final List<Resource<?>> resources = new ArrayList<>();
    private final Map<String, List<Supplier<String>>> renderHooks = new LinkedHashMap<>();
    private final Map<String, Plugin> plugins = new LinkedHashMap<>();

    private Panel(String id) {
        this.id = Objects.requireNonNull(id, "id");
    }

    /**
     * @param id the panel id (also its route prefix, for example {@code "admin"})
     * @return a new, empty panel
     */
    public static Panel create(String id) {
        return new Panel(id);
    }

    /**
     * @return the panel id
     */
    public String id() {
        return id;
    }

    /**
     * Registers a resource on the panel.
     *
     * @param resource the resource
     * @return this panel
     */
    public Panel resource(Resource<?> resource) {
        resources.add(Objects.requireNonNull(resource, "resource"));
        return this;
    }

    /**
     * @return the registered resources, in registration order, as an unmodifiable snapshot
     */
    public List<Resource<?>> resources() {
        return Collections.unmodifiableList(resources);
    }

    /**
     * Registers a render hook: a fragment supplier injected at a named layout point.
     *
     * @param point one of the {@link RenderHook} constants
     * @param fragment supplies the HTML fragment to inject
     * @return this panel
     */
    public Panel renderHook(String point, Supplier<String> fragment) {
        renderHooks.computeIfAbsent(point, p -> new ArrayList<>())
                .add(Objects.requireNonNull(fragment, "fragment"));
        return this;
    }

    /**
     * @param point one of the {@link RenderHook} constants
     * @return the fragment suppliers registered at that point, in registration order (empty if none)
     */
    public List<Supplier<String>> renderHooks(String point) {
        return Collections.unmodifiableList(renderHooks.getOrDefault(point, List.of()));
    }

    /**
     * Applies a plugin: runs its {@link Plugin#register(Panel)} immediately and its
     * {@link Plugin#boot(Panel)} once registration has run (the Filament
     * register-then-boot lifecycle).
     *
     * @param plugin the plugin
     * @return this panel
     */
    public Panel plugin(Plugin plugin) {
        Objects.requireNonNull(plugin, "plugin");
        plugins.put(plugin.getId(), plugin);
        plugin.register(this);
        plugin.boot(this);
        return this;
    }

    /**
     * Looks up an applied plugin by id.
     *
     * @param id the plugin id
     * @return the plugin, or empty if none with that id was applied
     */
    public Optional<Plugin> plugin(String id) {
        return Optional.ofNullable(plugins.get(id));
    }
}
