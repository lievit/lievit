/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.Wire;
import io.lievit.wire.PayloadGuard;
import io.lievit.wire.synth.SynthesizerRegistry;

/**
 * Specifies the locale-pinning lifecycle listener ({@link LocaleListener}, ADR-0037): the active
 * locale is captured into the snapshot memo on dehydrate and restored onto the request on hydrate
 * before render, so a component first rendered in one locale keeps rendering in it across wire
 * updates even though each update is a fresh request whose default differs.
 */
class LocaleListenerTest {

    @LievitComponent(template = "greeter")
    static class GreeterComponent {
        @Wire String name = "";

        @LievitAction
        void noop() {}
    }

    /** A test {@link LocaleSource}: an in-memory holder mimicking {@code LocaleContextHolder}. */
    static final class FakeLocaleSource implements LocaleSource {
        Locale locale;

        FakeLocaleSource(Locale initial) {
            this.locale = initial;
        }

        @Override
        public Locale get() {
            return locale;
        }

        @Override
        public void set(Locale locale) {
            this.locale = locale;
        }
    }

    @AfterEach
    void unbind() {
        LocaleListener.clear();
    }

    private WireDispatcher dispatcherWithLocale() {
        LifecycleBus bus = new LifecycleBus();
        LocaleListener.registerOn(bus);
        return new WireDispatcher(
                new PayloadGuard(), NoOpFieldValidator.INSTANCE, new SynthesizerRegistry(), bus);
    }

    /**
     * @spec.given a component mounted with the request locale resolved to Italian
     * @spec.when  the dispatcher mounts the component with a bound LocaleSource
     * @spec.then  the snapshot memo carries the language tag {@code it} so it rides to the next call
     * @spec.adr   ADR-0037
     * @spec.us    US-locale-persists-across-requests
     */
    @Test
    void mount_captures_the_active_locale_into_the_snapshot_memo() {
        LocaleListener.bind(new FakeLocaleSource(Locale.ITALIAN));
        WireDispatcher dispatcher = dispatcherWithLocale();
        ComponentMetadata meta = ComponentMetadata.of(GreeterComponent.class);

        WireCall mounted = dispatcher.mount(meta, new GreeterComponent());

        Object memo = mounted.wire().get(WireDispatcher.MEMO_KEY);
        assertThat(memo).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> memoMap = (Map<String, Object>) memo;
        assertThat(memoMap).containsEntry(LocaleListener.MEMO_KEY, "it");
    }

    /**
     * @spec.given a snapshot whose memo pinned Italian, and a fresh request resolved to English
     * @spec.when  the dispatcher runs a wire call with that snapshot and the English-defaulting source
     * @spec.then  the source is set back to Italian (the memo wins over the request default), and the
     *     re-dehydrated memo still carries {@code it}: the locale survives the round trip
     * @spec.adr   ADR-0037
     * @spec.us    US-locale-persists-across-requests
     */
    @Test
    void hydrate_restores_the_pinned_locale_over_the_request_default() {
        FakeLocaleSource source = new FakeLocaleSource(Locale.ENGLISH); // fresh request default
        LocaleListener.bind(source);
        WireDispatcher dispatcher = dispatcherWithLocale();
        ComponentMetadata meta = ComponentMetadata.of(GreeterComponent.class);

        // The snapshot memo pins Italian from the previous round trip.
        Map<String, Object> snapshotWire =
                Map.of("name", "", WireDispatcher.MEMO_KEY, Map.of(LocaleListener.MEMO_KEY, "it"));

        WireCall result =
                dispatcher.call(meta, new GreeterComponent(), snapshotWire, Map.of(), List.of("noop"));

        // The locale was restored onto the request (it, not the en the request started with).
        assertThat(source.get()).isEqualTo(Locale.ITALIAN);

        // The memo round-trips: the next snapshot still pins it.
        Object memo = result.wire().get(WireDispatcher.MEMO_KEY);
        @SuppressWarnings("unchecked")
        Map<String, Object> memoMap = (Map<String, Object>) memo;
        assertThat(memoMap).containsEntry(LocaleListener.MEMO_KEY, "it");
    }

    /**
     * @spec.given no LocaleSource bound (a plain unit test or an app without web i18n)
     * @spec.when  the dispatcher mounts and calls the component
     * @spec.then  the listener no-ops: no memo locale key is written, the round trip is unchanged
     * @spec.adr   ADR-0037
     */
    @Test
    void no_locale_source_bound_is_a_no_op() {
        WireDispatcher dispatcher = dispatcherWithLocale(); // nothing bound
        ComponentMetadata meta = ComponentMetadata.of(GreeterComponent.class);

        WireCall mounted = dispatcher.mount(meta, new GreeterComponent());

        // No memo at all (or no locale key): the Counter-style snapshot is unchanged.
        Object memo = mounted.wire().get(WireDispatcher.MEMO_KEY);
        if (memo instanceof Map<?, ?> map) {
            assertThat(map.containsKey(LocaleListener.MEMO_KEY)).isFalse();
        }
    }
}
