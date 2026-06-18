/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * The non-DI static accessor to the kit's manager singletons (the ergonomic twin of Filament's
 * {@code FilamentAsset}/{@code FilamentColor}/{@code FilamentIcon}/{@code FilamentTimezone}
 * facades). In Spring the idiom is to <em>inject</em> the manager beans, and inside a Spring-managed
 * bean that is exactly what an adopter does. But a {@link Plugin}'s {@code register(panel)} runs in
 * a fluent builder <em>outside</em> a managed bean, where field injection is not available, so this
 * facade exposes the same managers for the registration phase.
 *
 * <p>The split is deliberate and documented:
 *
 * <ul>
 *   <li><b>Inside a bean</b> (controllers, services, components): inject {@link AssetManager},
 *       {@link IconRegistry}, {@link TimezoneManager} as beans. Do not use this facade.
 *   <li><b>Inside a builder / plugin register()</b>: use {@code Lievit.assets()} /
 *       {@code Lievit.icons()} / {@code Lievit.timezone()} to reach the same singletons.
 * </ul>
 *
 * <p>The kit's Spring Boot starter calls {@link #bind} once at startup with the managed beans, so
 * the static accessor and the injected beans resolve to the <em>same</em> instances. Off the wire
 * (tests), call {@link #bind} explicitly or read the lazily-created defaults.
 */
public final class Lievit {

    private static @Nullable AssetManager assets;
    private static @Nullable IconRegistry icons;
    private static @Nullable TimezoneManager timezone;

    private Lievit() {}

    /**
     * Binds the manager singletons (called once by the starter with the managed beans, so the static
     * accessor and the injected beans are the same instances).
     *
     * @param assetManager the asset manager bean
     * @param iconRegistry the icon registry bean
     * @param timezoneManager the timezone manager bean
     */
    public static synchronized void bind(
            AssetManager assetManager, IconRegistry iconRegistry, TimezoneManager timezoneManager) {
        assets = Objects.requireNonNull(assetManager, "assetManager");
        icons = Objects.requireNonNull(iconRegistry, "iconRegistry");
        timezone = Objects.requireNonNull(timezoneManager, "timezoneManager");
    }

    /** @return the asset manager singleton (a default is created on first access if unbound) */
    public static synchronized AssetManager assets() {
        if (assets == null) {
            assets = AssetManager.create();
        }
        return assets;
    }

    /** @return the icon registry singleton (a defaults-seeded one is created on first access) */
    public static synchronized IconRegistry icons() {
        if (icons == null) {
            icons = IconRegistry.withDefaults();
        }
        return icons;
    }

    /** @return the timezone manager singleton (UTC by default) */
    public static synchronized TimezoneManager timezone() {
        if (timezone == null) {
            timezone = TimezoneManager.create();
        }
        return timezone;
    }

    /**
     * Resets the bound singletons (test hook so one test's registration does not leak into the next).
     */
    public static synchronized void reset() {
        assets = null;
        icons = null;
        timezone = null;
    }
}
