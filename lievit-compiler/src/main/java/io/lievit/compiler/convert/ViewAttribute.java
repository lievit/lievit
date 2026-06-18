/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.compiler.convert;

import java.util.Optional;

import org.jspecify.annotations.Nullable;

/**
 * One attribute on a {@link ViewNode.Element} in the engine-neutral convert AST (issue #141). It
 * carries the attribute name, an optional value, and whether the value is dynamic (an expression to
 * interpolate) or literal (text), so both writers can render it in their own syntax:
 *
 * <ul>
 *   <li>a literal value {@code label="Name"} writes as a DSL {@code .attr("label", "Name")} and a JTE
 *       {@code label="Name"};
 *   <li>a dynamic value {@code title=${user.name()}} writes as a DSL {@code .attr("title",
 *       user.name())} and a JTE {@code title="${user.name()}"};
 *   <li>a value-less boolean attribute {@code disabled} writes as a DSL {@code .attr("disabled")} and
 *       a JTE bare {@code disabled}.
 * </ul>
 *
 * <p>The wire directives ({@code l:click}, {@code l:model}, ...) are ordinary literal-valued
 * attributes here; the writers recognize them only to pick the fluent DSL helper ({@code wireClick})
 * when one exists, which keeps the DSL output idiomatic without changing the AST.
 *
 * @param name the attribute name (e.g. {@code class}, {@code l:click}, {@code disabled})
 * @param value the value, or empty for a boolean attribute
 * @param dynamic whether {@link #value} is an expression to interpolate (true) or literal text
 *     (false); always false when {@link #value} is empty
 */
public record ViewAttribute(String name, Optional<String> value, boolean dynamic) {

    public ViewAttribute {
        value = value == null ? Optional.empty() : value;
    }

    /** A literal-valued attribute: {@code name="value"}. */
    public static ViewAttribute literal(String name, @Nullable String value) {
        return new ViewAttribute(name, Optional.ofNullable(value), false);
    }

    /** A dynamic-valued attribute: the value is an expression to interpolate. */
    public static ViewAttribute dynamic(String name, String expression) {
        return new ViewAttribute(name, Optional.of(expression), true);
    }

    /** A boolean (value-less) attribute: {@code name}. */
    public static ViewAttribute bool(String name) {
        return new ViewAttribute(name, Optional.empty(), false);
    }
}
