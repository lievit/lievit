/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Declares the page {@code <title>} a full-page component sets when it is the target of a route
 * (ADR-0031, Livewire {@code #[Title]} parity).
 *
 * <p>Honoured only for a full-page (route-target) render; an embedded component ignores it. The
 * layout reads the resolved title via the page model.
 *
 * <p>Adding {@code @LievitTitle} is governed by ADR-0031.
 */
@Documented
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface LievitTitle {

    /**
     * The page title.
     *
     * @return the title text
     */
    String value();
}
