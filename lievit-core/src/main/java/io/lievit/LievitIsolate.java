/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a {@code @LievitComponent} as isolated (issue #61, Livewire {@code #[Isolate]} /
 * {@code SupportIsolating} parity): its wire updates are sent as their own network request instead of
 * being bundled into a shared multi-component commit. Use it for an expensive or independent
 * component so its latency is not coupled to the rest of the page's batch.
 *
 * <p>The flag rides the component's <strong>snapshot memo</strong> (the reserved {@code @memo} bag the
 * dispatcher round-trips): an {@code IsolateListener} writes {@code isolate: true} on dehydrate, so the
 * client reads it off the snapshot and excludes the component from the shared commit. This keeps the
 * server stateless and the snapshot schema unchanged (composition / behavior lives in the memo, not a
 * new wire field), exactly as locale pinning (ADR-0037) does.
 *
 * <p>Adding {@code @LievitIsolate} is governed by ADR-0075.
 */
@Documented
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface LievitIsolate {}
