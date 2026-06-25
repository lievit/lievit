/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/**
 * Specifies the facade/manager singleton access layer (the Filament {@code FilamentAsset}/{@code
 * FilamentIcon}/{@code FilamentTimezone} facades): the {@link Lievit} static accessor reaches the
 * same manager singletons a bean would inject, so a {@link Plugin}'s {@code register(panel)} (which
 * runs outside a managed bean) can register assets/icons/timezone without field injection. A
 * documented default timezone bean backs the date components.
 */
class FacadeManagerTest {

    @AfterEach
    void resetFacade() {
        Lievit.reset();
    }

    /**
     * @spec.given the kit's manager beans bound once at startup
     * @spec.when  a builder reaches them through the static facade
     * @spec.then  the facade resolves the same instances the beans expose
     */
    @Test
    void the_facade_resolves_the_bound_singletons() {
        AssetManager assets = AssetManager.create();
        IconRegistry icons = IconRegistry.withDefaults();
        TimezoneManager tz = TimezoneManager.create();
        Lievit.bind(assets, icons, tz);

        assertThat(Lievit.assets()).isSameAs(assets);
        assertThat(Lievit.icons()).isSameAs(icons);
        assertThat(Lievit.timezone()).isSameAs(tz);
    }

    /**
     * @spec.given a plugin registration phase with no DI available
     * @spec.when  it registers an asset through the static accessor
     * @spec.then  the asset is visible to the (same) injected manager afterwards
     */
    @Test
    void a_builder_registers_assets_without_injection() {
        AssetManager bean = AssetManager.create();
        Lievit.bind(bean, IconRegistry.withDefaults(), TimezoneManager.create());

        // simulate a plugin register() running outside a Spring bean
        Lievit.assets().register(Css.make("plugin-x", "/plugin-x.css"));

        assertThat(bean.asset("plugin-x")).isNotNull();
    }

    /**
     * @spec.given an unbound facade
     * @spec.when  a manager is accessed
     * @spec.then  a sane default singleton is lazily created (UTC timezone, defaults-seeded icons)
     */
    @Test
    void unbound_managers_lazily_default() {
        assertThat(Lievit.timezone().get().getId()).isEqualTo("UTC");
        assertThat(Lievit.icons().resolve(Icon.of("actions.create"))).isPresent();
    }

    /**
     * @spec.given a configured default timezone
     * @spec.when  it is read back
     * @spec.then  the date components read the documented display zone
     */
    @Test
    void the_default_timezone_is_configurable() {
        TimezoneManager tz = TimezoneManager.create().set("Europe/Rome");

        assertThat(tz.get().getId()).isEqualTo("Europe/Rome");
    }
}
