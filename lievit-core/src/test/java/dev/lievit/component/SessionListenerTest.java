/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import dev.lievit.LievitAction;
import dev.lievit.LievitComponent;
import dev.lievit.LievitSession;
import dev.lievit.Wire;
import dev.lievit.wire.PayloadGuard;
import dev.lievit.wire.synth.SynthesizerRegistry;

/**
 * Pins {@code @LievitSession} persistence (ADR-0031, #55): a session-persisted field is written on
 * dehydrate and restored on mount, surviving a fresh mount (the page-refresh case), and an explicit
 * key with a {@code {placeholder}} resolves against state. Uses an in-memory {@link SessionStore}.
 */
class SessionListenerTest {

    static final class MapStore implements SessionStore {
        final Map<String, Object> map = new HashMap<>();

        @Override
        public @Nullable Object get(String key) {
            return map.get(key);
        }

        @Override
        public void put(String key, @Nullable Object value) {
            map.put(key, value);
        }
    }

    @LievitComponent
    static class Prefs {
        @LievitSession @Wire String filter = "all";

        @LievitAction
        void choose() {
            this.filter = "active";
        }
    }

    @LievitComponent
    static class Scoped {
        @Wire int tenantId = 3;
        @LievitSession(key = "tenant.{tenantId}.theme") @Wire String theme = "light";
    }

    @AfterEach
    void unbind() {
        SessionListener.clear();
    }

    private WireDispatcher dispatcher() {
        LifecycleBus bus = SessionListener.registerOn(new LifecycleBus());
        return new WireDispatcher(
                new PayloadGuard(), NoOpFieldValidator.INSTANCE, new SynthesizerRegistry(), bus);
    }

    /**
     * @spec.given a @LievitSession field changed by an action and written to the session
     * @spec.when  a fresh component is mounted afterwards (the page-refresh case)
     * @spec.then  the mounted field carries the persisted value, not the mount default
     * @spec.adr   ADR-0031
     */
    @Test
    void a_session_field_survives_a_fresh_mount() {
        MapStore store = new MapStore();
        SessionListener.bind(store);
        ComponentMetadata meta = ComponentMetadata.of(Prefs.class);
        WireDispatcher dispatcher = dispatcher();

        // A call changes the field; dehydrate writes it to the session.
        dispatcher.call(meta, new Prefs(), Map.of("filter", "all"), Map.of(), List.of("choose"));

        // A fresh mount (page refresh) restores the persisted value over the "all" default.
        WireCall mounted = dispatcher.mount(meta, new Prefs());
        assertThat(mounted.wire()).containsEntry("filter", "active");
    }

    /**
     * @spec.given an explicit session key embedding {tenantId} resolved to 3
     * @spec.when  the field is dehydrated then restored
     * @spec.then  the value is stored under "tenant.3.theme" and restored from it
     * @spec.adr   ADR-0031
     */
    @Test
    void an_explicit_key_resolves_the_placeholder() {
        MapStore store = new MapStore();
        SessionListener.bind(store);
        ComponentMetadata meta = ComponentMetadata.of(Scoped.class);
        WireDispatcher dispatcher = dispatcher();

        Scoped instance = new Scoped();
        instance.theme = "dark";
        dispatcher.call(meta, instance, Map.of("tenantId", 3, "theme", "dark"), Map.of(), List.of());

        assertThat(store.map).containsKey("tenant.3.theme");
        assertThat(store.map.get("tenant.3.theme")).isEqualTo("dark");
    }

    /**
     * @spec.given no session store bound (the stateless fallback)
     * @spec.when  a component with a @LievitSession field is mounted
     * @spec.then  it works and the field keeps its mount default (no exception)
     * @spec.adr   ADR-0031
     */
    @Test
    void without_a_bound_store_the_field_keeps_its_default() {
        ComponentMetadata meta = ComponentMetadata.of(Prefs.class);
        WireCall mounted = dispatcher().mount(meta, new Prefs());
        assertThat(mounted.wire()).containsEntry("filter", "all");
    }
}
