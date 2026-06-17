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
 * Marks an {@code @LievitAction} method as renderless: after it runs, lievit skips the re-render and
 * sends no HTML patch, leaving the DOM untouched (ADR-0031, Livewire {@code #[Renderless]} /
 * {@code BaseRenderless} parity).
 *
 * <p>Use it for an action that mutates only server state the client does not display (incrementing a
 * view counter, logging, firing an event) so the round trip skips the wasted render + morph. It is
 * the declarative form of the imperative {@code skipRender()} seam: the {@link
 * io.lievit.component.LifecyclePhase#RENDER} phase observes the annotation on the invoked action and
 * marks the context render-skipped.
 *
 * <p>If a call invokes several actions and any one is renderless, the render is still skipped only
 * when every invoked action is renderless (Livewire skips render when no rendering action ran); a
 * mix re-renders. The annotation is on the method, so a component can have both rendering and
 * renderless actions.
 *
 * <p>Adding {@code @LievitRenderless} is governed by ADR-0031.
 */
@Documented
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface LievitRenderless {
}
