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
 * Marks a method callable from the template.
 *
 * <p>An action is invoked by a client directive ({@code l:click}, {@code l:submit},
 * {@code l:keydown.enter}). The wire call collects the current snapshot and any pending field
 * updates, rehydrates the component, then invokes the named action; the action may mutate
 * {@link Wire}-bound state, after which the component re-renders (ADR-0001, wire-protocol.md).
 *
 * <p>An action runs within the protocol action timeout (5 s in v0.1); exceeding it is a
 * {@code 504}. One of the seven public annotations (ADR-0002).
 */
@Documented
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface LievitAction {
}
