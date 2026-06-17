/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a standalone admin page: a first-class peer of {@link Resource}, not a second-class
 * escape hatch (the explicit filament-internals.md correction of Filament's "everything is a
 * Resource" rigidity).
 *
 * <p>A {@code @Page} is placed on a lievit component class (one that also carries
 * {@code @LievitComponent}); the panel mounts it at {@link #slug()} with the admin layout
 * (navigation + render hooks) wrapped around the component's own body. This is the clean path for
 * dashboards, settings, and one-off tools that do not map to "table of records + form to edit one".
 */
@Documented
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface Page {

    /**
     * @return the url slug under the panel (for example {@code "dashboard"} -&gt; {@code /admin/dashboard})
     */
    String slug();

    /**
     * @return the human label shown in navigation; empty means derive it from the slug
     */
    String label() default "";
}
