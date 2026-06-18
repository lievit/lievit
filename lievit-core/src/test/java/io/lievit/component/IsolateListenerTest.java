/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.LievitIsolate;
import io.lievit.Wire;
import io.lievit.wire.PayloadGuard;
import io.lievit.wire.synth.SynthesizerRegistry;

/**
 * Specifies the isolate lifecycle listener ({@link IsolateListener}, issue #61, ADR-0075): a
 * {@code @LievitIsolate} component carries {@code isolate: true} in its snapshot memo on dehydrate so
 * the client sends its updates in their own request, and a plain component carries nothing (the memo
 * stays empty, the Counter snapshot unchanged).
 */
class IsolateListenerTest {

    @LievitComponent(template = "isolated")
    @LievitIsolate
    static class IsolatedComponent {
        @Wire int count = 0;

        @LievitAction
        void increment() {
            count++;
        }
    }

    @LievitComponent(template = "plain")
    static class PlainComponent {
        @Wire int count = 0;

        @LievitAction
        void increment() {
            count++;
        }
    }

    private WireDispatcher dispatcherWithIsolate() {
        LifecycleBus bus = new LifecycleBus();
        IsolateListener.registerOn(bus);
        return new WireDispatcher(
                new PayloadGuard(), NoOpFieldValidator.INSTANCE, new SynthesizerRegistry(), bus);
    }

    /**
     * @spec.given a @LievitIsolate component
     * @spec.when  the dispatcher mounts it
     * @spec.then  the snapshot memo carries isolate:true so it rides the snapshot to the client
     * @spec.adr   ADR-0075
     * @spec.us    US-61-isolate-component
     */
    @Test
    void mount_stamps_the_isolate_flag_into_the_memo_for_an_isolated_component() {
        WireDispatcher dispatcher = dispatcherWithIsolate();
        ComponentMetadata meta = ComponentMetadata.of(IsolatedComponent.class);

        WireCall mounted = dispatcher.mount(meta, new IsolatedComponent());

        Object memo = mounted.wire().get(WireDispatcher.MEMO_KEY);
        assertThat(memo).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> memoMap = (Map<String, Object>) memo;
        assertThat(memoMap).containsEntry(IsolateListener.MEMO_KEY, Boolean.TRUE);
    }

    /**
     * @spec.given a plain component (no @LievitIsolate)
     * @spec.when  the dispatcher mounts it
     * @spec.then  no isolate flag is written: the memo stays absent (the common-case snapshot is
     *     unchanged, no behavior or size cost for a non-isolated component)
     * @spec.adr   ADR-0075
     * @spec.us    US-61-isolate-component
     */
    @Test
    void mount_writes_no_memo_for_a_plain_component() {
        WireDispatcher dispatcher = dispatcherWithIsolate();
        ComponentMetadata meta = ComponentMetadata.of(PlainComponent.class);

        WireCall mounted = dispatcher.mount(meta, new PlainComponent());

        assertThat(mounted.wire()).doesNotContainKey(WireDispatcher.MEMO_KEY);
    }

    /**
     * @spec.given an isolated component whose previous snapshot memo carried isolate:true
     * @spec.when  the dispatcher runs a wire call (an update round trip)
     * @spec.then  the re-dehydrated memo still carries isolate:true: the flag survives the round trip
     * @spec.adr   ADR-0075
     * @spec.us    US-61-isolate-component
     */
    @Test
    void the_isolate_flag_survives_the_round_trip() {
        WireDispatcher dispatcher = dispatcherWithIsolate();
        ComponentMetadata meta = ComponentMetadata.of(IsolatedComponent.class);
        Map<String, Object> snapshotWire =
                Map.of(
                        "count",
                        0,
                        WireDispatcher.MEMO_KEY,
                        Map.of(IsolateListener.MEMO_KEY, Boolean.TRUE));

        WireCall result =
                dispatcher.call(
                        meta,
                        new IsolatedComponent(),
                        snapshotWire,
                        Map.of(),
                        java.util.List.of("increment"));

        Object memo = result.wire().get(WireDispatcher.MEMO_KEY);
        @SuppressWarnings("unchecked")
        Map<String, Object> memoMap = (Map<String, Object>) memo;
        assertThat(memoMap).containsEntry(IsolateListener.MEMO_KEY, Boolean.TRUE);
    }
}
