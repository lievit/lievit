/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring.counter;

import java.util.Map;

import dev.lievit.LievitAction;
import dev.lievit.LievitComponent;
import dev.lievit.Wire;
import dev.lievit.component.LievitEffects;

/**
 * Exercises the effects channel end-to-end (ADR-0012): one action redirects, one dispatches a
 * browser event, one returns a value. It is the effects-channel sibling of {@link CounterComponent}
 * in the golden roundtrip, proving redirect / dispatch / returns ride the {@code Lievit-Effects}
 * header through the real codec, dispatcher, JTE adapter, and HTTP endpoint.
 */
@LievitComponent(template = "effectful")
public class EffectfulComponent {

    @Wire int count;

    @LievitAction
    void save() {
        this.count++;
        LievitEffects.current().dispatch("saved", Map.of("count", this.count));
    }

    @LievitAction
    void leave() {
        LievitEffects.current().redirect("/done");
    }

    /**
     * Queues a CSP-safe {@code $js} effect (issue #73, ADR-0024 #131): the server names a client
     * handler ({@code highlight}) the runtime invokes by name with the new count as its argument,
     * never an eval. The escape hatch for server-driven client behavior under the strict CSP.
     */
    @LievitAction
    void flash() {
        this.count++;
        LievitEffects.current().js("highlight", this.count);
    }

    @LievitAction
    int total() {
        return this.count + 100;
    }

    /**
     * A {@code @LievitJson} RPC endpoint (#99): the client calls it as {@code $lievit.lookup()} and
     * gets a {@code Promise} resolving the returned value, with no re-render (the return rides the
     * effects channel's {@code returns} key, the HTML patch is empty).
     */
    @LievitAction
    @dev.lievit.LievitJson
    java.util.Map<String, Object> lookup() {
        return java.util.Map.of("answer", 42, "count", this.count);
    }
}
