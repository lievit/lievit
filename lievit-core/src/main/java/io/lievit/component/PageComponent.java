/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.jspecify.annotations.Nullable;

import io.lievit.LievitLayout;
import io.lievit.LievitPage;
import io.lievit.LievitTitle;

/**
 * The full-page metadata of a component (ADR-0031, Livewire {@code SupportPageComponents} parity):
 * the layout it renders inside ({@code @LievitLayout}) and the page title it sets
 * ({@code @LievitTitle}) when it is the target of a route. Reflected once per class and cached.
 *
 * <p>The core only reflects these declarations; the starter (Spring MVC) maps the route, renders the
 * component, wraps it in the resolved layout under a content slot, and sets the title. A component
 * with neither annotation falls back to the configured default layout (resolved by the starter), so
 * {@link #layout()} returns {@code null} to mean "use the default".
 */
public final class PageComponent {

    private static final Map<Class<?>, PageComponent> CACHE = new ConcurrentHashMap<>();

    private final @Nullable String layout;
    private final @Nullable String title;
    private final @Nullable String route;

    private PageComponent(
            @Nullable String layout, @Nullable String title, @Nullable String route) {
        this.layout = layout;
        this.title = title;
        this.route = route;
    }

    /**
     * Reflects (and caches) the full-page metadata of a component class.
     *
     * @param type the component class
     * @return its page metadata ({@link #layout()} / {@link #title()} are {@code null} when absent)
     */
    public static PageComponent of(Class<?> type) {
        return CACHE.computeIfAbsent(type, PageComponent::reflect);
    }

    private static PageComponent reflect(Class<?> type) {
        LievitLayout layout = type.getAnnotation(LievitLayout.class);
        LievitTitle title = type.getAnnotation(LievitTitle.class);
        LievitPage page = type.getAnnotation(LievitPage.class);
        return new PageComponent(
                layout == null ? null : layout.value(),
                title == null ? null : title.value(),
                page == null ? null : page.value());
    }

    /**
     * @return the declared layout template name, or {@code null} to use the configured default layout
     */
    public @Nullable String layout() {
        return layout;
    }

    /**
     * @return the declared page title, or {@code null} if the component sets none
     */
    public @Nullable String title() {
        return title;
    }

    /**
     * @return the declared route URI ({@code @LievitPage}), or {@code null} if the component is not
     *     mapped directly to a route (it is embedded, or routed by the host application)
     */
    public @Nullable String route() {
        return route;
    }
}
