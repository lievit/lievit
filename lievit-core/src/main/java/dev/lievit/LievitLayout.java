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
 * Declares the layout template a full-page component renders inside when it is the target of a route
 * (ADR-0031, Livewire {@code #[Layout]} parity).
 *
 * <p>A full-page component is a {@code @LievitComponent} mapped directly to a route (not embedded in
 * another template): lievit renders the component, then wraps its HTML in the named layout under a
 * content slot. Absent this annotation, the configured default layout is used.
 *
 * <p>Adding {@code @LievitLayout} is governed by ADR-0031.
 */
@Documented
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface LievitLayout {

    /**
     * The layout template name (adapter-resolved, e.g. {@code "layouts/app"}).
     *
     * @return the layout template name
     */
    String value();
}
