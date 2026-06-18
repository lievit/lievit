/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring;

import java.util.Map;

import io.lievit.component.PageComponent;

/**
 * Renders a full-page lievit component as a complete HTML document (issue #63/#181, ADR-0033): it
 * mounts the component (seeding the route-bound props), reads its {@code @LievitLayout} /
 * {@code @LievitTitle} via {@link PageComponent}, and wraps the rendered HTML in the resolved layout
 * via the {@link LayoutRenderer}. This is the lievit analogue of Livewire's {@code LivewirePageController}
 * + {@code SupportPageComponents}: one shared renderer that turns a route-target component into a page.
 *
 * <p>The component is stamped with its wire markers by {@link LievitWireService#mountStamped}, so the
 * client hydrates the page-level component and drives its wire calls (the per-component endpoint).
 * The layout / title declarations are reflected once and cached by {@link PageComponent}.
 */
public final class LievitPageRenderer {

    private final LievitWireService wireService;
    private final LayoutRenderer layoutRenderer;

    /**
     * @param wireService the wire orchestrator (mounts + stamps the component)
     * @param layoutRenderer the layout wrapper (the host's app shell, or the default minimal document)
     */
    public LievitPageRenderer(LievitWireService wireService, LayoutRenderer layoutRenderer) {
        this.wireService = wireService;
        this.layoutRenderer = layoutRenderer;
    }

    /**
     * Renders the full page for a route-target component.
     *
     * @param componentType the full-page {@code @LievitComponent} class
     * @param props the route-bound props (path variables) seeded onto the component before mount
     * @return the complete HTML document (layout + component, titled)
     */
    public String renderPage(Class<?> componentType, Map<String, Object> props) {
        PageComponent page = PageComponent.of(componentType);
        // Bind the request's resolved locale (ADR-0037) so the mount captures it into the snapshot
        // memo; the first wire update then restores it instead of reverting to the request default.
        // LocaleContextHolder is already populated by Spring for this MVC request.
        io.lievit.component.LocaleListener.bind(SpringLocaleSource.INSTANCE);
        WireCallResult mounted;
        try {
            mounted = wireService.mountStamped(componentType.getName(), props);
        } finally {
            io.lievit.component.LocaleListener.clear();
        }
        return layoutRenderer.render(page.layout(), page.title(), mounted.html());
    }
}
