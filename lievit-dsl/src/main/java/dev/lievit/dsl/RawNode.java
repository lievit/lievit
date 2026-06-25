/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.dsl;

/**
 * Pre-trusted markup, emitted verbatim with <strong>no escaping</strong> (ADR-0018). This is the
 * single escape hatch from escape-by-construction, named {@code raw} so it is explicit and grep-able
 * in review: any XSS reachable through the DSL must pass through a {@link H#raw(String)} call, so the
 * audit surface is exactly the set of {@code raw(...)} sites.
 *
 * <p>Use it only for markup whose provenance is the server (a sanitized rich-text field, a constant
 * SVG). Never pass un-sanitized client input to {@code raw}.
 *
 * @param html the trusted markup, emitted as-is
 */
public record RawNode(String html) implements Html {

    /**
     * @param html the trusted markup; must not be {@code null}
     */
    public RawNode {
        if (html == null) {
            throw new IllegalArgumentException("raw html must not be null");
        }
    }

    @Override
    public void renderTo(StringBuilder out) {
        out.append(html);
    }
}
