/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Maps a full-page {@code @LievitComponent} directly to a route (issue #181, Livewire
 * {@code Route::livewire($uri, Component::class)} parity): the component becomes reachable as a URL,
 * rendered inside its {@code @LievitLayout} with its {@code @LievitTitle}, and the route's path
 * variables are bound to the component's {@code @Wire} fields (the props seeded before mount).
 *
 * <p>The starter discovers {@code @LievitPage} components and registers a route to a single shared
 * page handler (the lievit analogue of Livewire's {@code LivewirePageController}); the core only
 * declares the mapping. A path variable {@code {id}} is bound to the same-named {@code @Wire} field /
 * mount-seeded prop (the lievit analogue of implicit route-model binding). Governed by ADR-0033.
 */
@Documented
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface LievitPage {

    /**
     * The route URI with optional path variables (e.g. {@code "/post/{id}"}), Spring MVC pattern
     * syntax.
     *
     * @return the route URI
     */
    String value();
}
