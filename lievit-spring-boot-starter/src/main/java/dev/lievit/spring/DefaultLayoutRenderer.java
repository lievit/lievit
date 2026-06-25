/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring;

import org.jspecify.annotations.Nullable;

/**
 * The default {@link LayoutRenderer} (issue #63/#181, ADR-0033): wraps a full-page component in a
 * minimal, valid HTML5 document with the component HTML in the {@code <body>} and {@code @LievitTitle}
 * as the {@code <title>}. Used when the host application wires no layout of its own.
 *
 * <p>It honours the declared layout name only as the {@code data-lievit-layout} attribute marker (so
 * the rendered page records which layout was requested) but does not resolve an application template
 * file: a host that wants its real app shell provides its own {@link LayoutRenderer} bean. The
 * default keeps a full-page component reachable and correctly titled out of the box (Livewire's
 * default layout fallback).
 *
 * <p>The title is HTML-escaped so a component-declared title cannot inject markup into the head.
 */
public final class DefaultLayoutRenderer implements LayoutRenderer {

    @Override
    public String render(@Nullable String layout, @Nullable String title, String componentHtml) {
        StringBuilder out = new StringBuilder(componentHtml.length() + 256);
        out.append("<!doctype html><html><head><meta charset=\"utf-8\">");
        out.append("<title>").append(escape(title == null ? "" : title)).append("</title>");
        out.append("</head><body");
        if (layout != null) {
            out.append(" data-lievit-layout=\"").append(escape(layout)).append('"');
        }
        out.append('>');
        out.append(componentHtml);
        out.append("</body></html>");
        return out.toString();
    }

    private static String escape(String value) {
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
