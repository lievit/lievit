/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a {@code @LievitComponent} as lazy (or deferred): on the first page load lievit renders a
 * lightweight <em>placeholder</em> instead of the component's real body, then loads the real render
 * via a follow-up wire call (ADR-0036, Livewire {@code #[Lazy]} / {@code SupportLazyLoading} parity,
 * issue #147). The expensive work below the fold is deferred until it is actually needed.
 *
 * <p>Two trigger modes:
 *
 * <ul>
 *   <li><b>lazy</b> (the default, {@link #defer()} = {@code false}): the placeholder loads when it
 *       scrolls into the viewport (the client's {@code l:lazy} intersection-observer trigger).
 *   <li><b>defer</b> ({@link #defer()} = {@code true}): the placeholder loads immediately on init
 *       (the next client tick), not on intersection. Use it to get the first paint out fast and fill
 *       the component in right after, without waiting for a scroll.
 * </ul>
 *
 * <p>The {@code @Wire} state still rehydrates from the snapshot across the load (mount params,
 * reactive props, listeners survive), because the placeholder carries the same signed snapshot the
 * real component would; the follow-up call simply re-renders the full body. By default the placeholder
 * is a minimal skeleton; a component can supply its own by declaring a no-arg method named by
 * {@link #placeholder()} that returns the placeholder HTML (a {@code String}).
 *
 * <p>Adding {@code @LievitLazy} is governed by ADR-0036.
 */
@Documented
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface LievitLazy {

    /**
     * @return {@code true} to load on init (defer) rather than on intersection (lazy, the default)
     */
    boolean defer() default false;

    /**
     * The name of a no-arg method on the component that returns the placeholder HTML ({@code String}).
     * Empty (the default) uses a minimal built-in skeleton.
     *
     * @return the placeholder method name, or empty for the default skeleton
     */
    String placeholder() default "";
}
