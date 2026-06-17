/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a Java class as a server-side lievit component.
 *
 * <p>A component is a typed class whose {@link Wire}-bound fields carry the only mutable state on
 * the wire, and whose {@link LievitAction} methods are callable from the template. The annotated
 * class is implicitly a Spring {@code @Component}. Its fully-qualified name is what the wire
 * snapshot's {@code cls} field resolves to at unwrap time (ADR-0001, wire-protocol.md).
 *
 * <p>One of the seven public annotations (ADR-0002).
 */
@Documented
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface LievitComponent {

    /**
     * The template this component renders with (the JTE template name for the primary adapter, for
     * example {@code "counter"}). Empty means the component renders itself via a {@link
     * LievitRender} method (single-file mode).
     *
     * @return the template name, or empty for single-file render
     */
    String template() default "";
}
