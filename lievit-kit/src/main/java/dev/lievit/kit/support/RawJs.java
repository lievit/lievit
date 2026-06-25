/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.support;

import java.util.Objects;

/**
 * A string marked as a raw JavaScript expression (the filament-support {@code RawJs} carried over):
 * the templating layer emits it VERBATIM where a JS expression is expected (a client-side visibility
 * rule, an {@code afterStateUpdatedJs} hook), instead of escaping it as text.
 *
 * <p>It gates client-side reactivity: a field whose visibility is {@code RawJs.of("$state.role ===
 * 'admin'")} ships that expression into the island unescaped, where a plain string would be quoted
 * and inert. The wrapper makes "this is code, not data" explicit at the type level, so a renderer
 * never has to guess whether to escape.
 *
 * <p>The expression is emitted unescaped only into a JS slot. When a {@code RawJs} would instead
 * land inside HTML markup, render it through {@link #htmlEscaped()} so it can never break out of its
 * attribute or element. The kit never executes the expression; it carries it to the island.
 */
public final class RawJs {

    private final String expression;

    private RawJs(String expression) {
        this.expression = Objects.requireNonNull(expression, "expression");
    }

    /**
     * @param expression a JavaScript expression, emitted verbatim into a JS slot
     * @return a raw-JS wrapper over the expression
     */
    public static RawJs of(String expression) {
        return new RawJs(expression);
    }

    /**
     * @return the JS expression verbatim (the JS-slot form; never escaped)
     */
    public String expression() {
        return expression;
    }

    /**
     * @return the expression with HTML special characters escaped, for the rare case it is rendered
     *     into markup rather than a JS slot (so a RawJs can never break out into HTML)
     */
    public String htmlEscaped() {
        StringBuilder out = new StringBuilder(expression.length());
        for (int i = 0; i < expression.length(); i++) {
            char c = expression.charAt(i);
            switch (c) {
                case '&' -> out.append("&amp;");
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                case '"' -> out.append("&quot;");
                case '\'' -> out.append("&#39;");
                default -> out.append(c);
            }
        }
        return out.toString();
    }

    @Override
    public String toString() {
        return expression;
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof RawJs other && expression.equals(other.expression);
    }

    @Override
    public int hashCode() {
        return expression.hashCode();
    }
}
