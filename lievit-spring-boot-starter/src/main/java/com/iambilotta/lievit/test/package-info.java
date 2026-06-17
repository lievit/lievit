/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The developer-facing component test harness (ADR-0010): {@code Lievit.test(MyComponent.class)} and
 * the {@code @LievitTest} meta-annotation.
 *
 * <p>This is lievit's answer to Livewire's {@code Livewire::test()}, and its job is to pull the
 * developer's component behaviour <em>out of the browser</em>: it mounts and drives a
 * {@code @LievitComponent} through the real wire pipeline (codec → registry → dispatcher → template
 * adapter → the {@code POST /lievit/{id}/call} HTTP edge over {@code MockMvc}), headless and fast,
 * and exposes typed, boilerplate-free assertions over state ({@link
 * com.iambilotta.lievit.test.LievitTester#assertWire}), re-rendered HTML, the signed-snapshot
 * rotation, and the security boundary — including the locked-field rejection from the attacker's
 * seat and the brute-force rate-limit, the two behaviours Livewire's own component tester cannot
 * reach.
 *
 * <p>It ships in the starter as a documented feature; its dependencies on the Spring test
 * infrastructure are {@code optional} so they never reach an adopter's runtime, only their test
 * classpath. The harness's own tests dogfood it (the Counter roundtrip rewritten on top of it).
 */
@NullMarked
package com.iambilotta.lievit.test;

import org.jspecify.annotations.NullMarked;
