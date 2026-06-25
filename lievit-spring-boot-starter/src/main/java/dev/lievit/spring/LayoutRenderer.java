/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring;

import org.jspecify.annotations.Nullable;

/**
 * Wraps a full-page component's rendered HTML in a layout document (issue #63/#181, ADR-0033). The
 * full-page renderer mounts the component, then asks the {@link LayoutRenderer} to produce the final
 * HTML document, injecting the component HTML under the layout's content slot and setting the
 * {@code <title>}.
 *
 * <p>This is an SPI so the host application can render its own layout template (a JTE/Thymeleaf
 * layout with the app shell, nav, asset tags) via its own view engine; the starter ships a
 * {@link DefaultLayoutRenderer} that produces a minimal valid HTML5 document when no application
 * layout is wired. The component is adapter-agnostic: the layout is the host's concern, the
 * component HTML is lievit's.
 */
public interface LayoutRenderer {

    /**
     * Renders the full HTML page: the layout document with the component HTML in its content slot and
     * {@code title} as the {@code <title>}.
     *
     * @param layout the resolved layout template name ({@code @LievitLayout}), or {@code null} to use
     *     the renderer's default layout
     * @param title the resolved page title ({@code @LievitTitle} / fluent), or {@code null} for none
     * @param componentHtml the mounted component's HTML (already stamped with its wire markers)
     * @return the complete HTML document
     */
    String render(@Nullable String layout, @Nullable String title, String componentHtml);
}
