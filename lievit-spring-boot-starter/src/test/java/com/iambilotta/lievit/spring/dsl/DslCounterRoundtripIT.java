/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.spring.dsl;

import static com.iambilotta.lievit.test.Lievit.test;

import org.junit.jupiter.api.Test;

import com.iambilotta.lievit.test.LievitTest;

/**
 * The single-file-DSL golden roundtrip (ADR-0015), on the {@code Lievit.test()} harness (ADR-0010).
 * It proves a DSL component flows through the SAME real pipeline as a template component (codec →
 * registry → dispatcher → the DSL {@code TemplateAdapter} → the {@code POST /lievit/{id}/call} HTTP
 * edge over MockMvc): mount, an {@code l:click} action over the real signed snapshot, and a
 * re-render, with only the adapter that produced the HTML differing from {@code CounterRoundtripIT}.
 */
@LievitTest(classes = DslTestApp.class)
class DslCounterRoundtripIT {

    /**
     * @spec.given a freshly mounted single-file-DSL counter and its signed initial snapshot
     * @spec.when  that snapshot is carried back over the wire with an increment action
     * @spec.then  the count advances to 1, the re-rendered DSL HTML shows it with the l:click marker
     *     the client binds, and a fresh snapshot rotated
     * @spec.adr   ADR-0015
     */
    @Test
    void mounts_then_increments_a_dsl_component_over_the_wire_endpoint() {
        test(DslCounterComponent.class)
                .mount()
                .assertWire("count", 0)
                .assertSee(">0<")
                .assertSeeHtml("l:click=\"increment\"")
                .assertSeeHtml(
                        "data-lievit-component=\"" + DslCounterComponent.class.getName() + "\"")
                .call("increment")
                .assertWire("count", 1)
                .assertSee(">1<")
                .assertSnapshotRotated();
    }
}
