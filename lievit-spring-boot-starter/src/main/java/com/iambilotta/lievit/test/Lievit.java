/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.test;

import com.iambilotta.lievit.LievitComponent;

/**
 * The developer-facing component test harness: {@code Lievit.test(MyComponent.class)} (ADR-0010).
 *
 * <p>This is lievit's answer to Livewire's {@code Livewire::test()}, and the point is that it pulls
 * behaviour <em>out of the browser</em>. It mounts the developer's own {@code @LievitComponent}
 * through the <strong>real</strong> wire pipeline (codec → registry → dispatcher → template adapter
 * → the {@code POST /lievit/{id}/call} HTTP edge, over {@code MockMvc}), carries the real signed
 * snapshot across calls internally, and returns a fluent tester. The developer writes intent
 * (mount → model → call → assert); the JSON-map / snapshot-juggling / string-grep plumbing the
 * old hand-rolled {@code *RoundtripIT} forced on them is the harness's job.
 *
 * <pre>{@code
 * import static com.iambilotta.lievit.test.Lievit.test;
 *
 * @LievitTest
 * class CounterComponentTest {
 *     @Test void increments_over_the_wire() {
 *         test(CounterComponent.class)
 *             .mount()
 *             .assertWire("count", 0)
 *             .assertSee(">0<")
 *             .call("increment")
 *             .assertWire("count", 1)
 *             .assertSee(">1<")
 *             .assertSnapshotRotated();
 *     }
 * }
 * }</pre>
 *
 * <p>Requires the test class to carry {@link LievitTest} (which binds the live Spring context the
 * static entry point reads). All state lives on the returned {@link LievitTester}; this class is a
 * stateless façade.
 */
public final class Lievit {

    private Lievit() {}

    /**
     * Opens a fluent tester for a component, over the real wire pipeline.
     *
     * @param component the {@code @LievitComponent} class to test
     * @param <T> the component type (so {@code assertWireMatches} gets a typed instance)
     * @return a tester; call {@link LievitTester#mount()} first
     * @throws IllegalStateException if the test class is not annotated {@link LievitTest}
     * @throws IllegalArgumentException if the class is not a {@code @LievitComponent}
     */
    public static <T> LievitTester<T> test(Class<T> component) {
        if (!component.isAnnotationPresent(LievitComponent.class)) {
            throw new IllegalArgumentException(
                    component.getName()
                            + " is not a @LievitComponent: Lievit.test() drives the real wire"
                            + " pipeline, which only mounts @LievitComponent classes.");
        }
        return new LievitTester<>(component, LievitTestContext.current());
    }
}
