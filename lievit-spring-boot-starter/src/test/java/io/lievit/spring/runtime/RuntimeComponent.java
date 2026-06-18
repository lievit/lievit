/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.runtime;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.LievitOn;
import io.lievit.LievitRenderless;
import io.lievit.Wire;
import io.lievit.component.LievitEffects;

/**
 * Exercises the Epic #34 server-side runtime-parity features end-to-end through the real wire
 * pipeline (ADR-0030 / ADR-0031): a magic {@code $set} / {@code $toggle}, a renderless action, a
 * server-driven redirect, an {@code @LievitOn} event listener, and the convention lifecycle hooks.
 */
@LievitComponent(template = "runtime/panel")
public class RuntimeComponent {

    @Wire int count;
    @Wire boolean open;
    @Wire int views;
    @Wire int lastEventId = -1;

    // Lifecycle-hook witnesses (read back over the wire to assert the hooks fired).
    @Wire boolean booted;
    @Wire boolean rendered;

    void boot() {
        this.booted = true;
    }

    void rendered() {
        this.rendered = true;
    }

    @LievitAction
    void save() {
        LievitEffects.current().dispatch("saved", java.util.Map.of("count", this.count));
    }

    @LievitAction
    void leave() {
        LievitEffects.current().redirect("/done");
    }

    @LievitAction
    void downloadReport() {
        LievitEffects.current()
                .download(
                        io.lievit.component.DownloadEffect.ofText(
                                "report.csv", "id,name\n1,a\n", "text/csv"));
    }

    @LievitAction
    @LievitRenderless
    void track() {
        this.views++;
    }

    @LievitOn("incremented")
    void onIncremented(int id) {
        this.lastEventId = id;
        this.count++;
    }
}
