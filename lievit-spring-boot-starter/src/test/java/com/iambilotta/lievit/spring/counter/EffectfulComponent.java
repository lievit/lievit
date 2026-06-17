/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.spring.counter;

import java.util.Map;

import com.iambilotta.lievit.LievitAction;
import com.iambilotta.lievit.LievitComponent;
import com.iambilotta.lievit.Wire;
import com.iambilotta.lievit.component.LievitEffects;

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

    @LievitAction
    int total() {
        return this.count + 100;
    }
}
