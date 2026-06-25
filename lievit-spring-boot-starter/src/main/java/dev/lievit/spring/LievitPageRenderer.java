/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring;

import java.util.Map;

import org.jspecify.annotations.Nullable;

import dev.lievit.component.PageComponent;

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
 *
 * <p>When an {@link LievitAssetInjector} is configured (issue #121, ADR-0039), the runtime assets are
 * injected into the rendered page so a host needs no manual script/style tags. The page renderer is
 * always invoked from a mounted {@code @LievitPage} component, so "a component rendered" is true by
 * construction here; non-lievit routes never reach this renderer and stay clean. Injection is skipped
 * when no injector is wired (auto-injection disabled via {@code lievit.assets.enabled=false}).
 */
public final class LievitPageRenderer {

    private final LievitWireService wireService;
    private final LayoutRenderer layoutRenderer;
    private final @Nullable LievitAssetInjector assetInjector;

    /**
     * @param wireService the wire orchestrator (mounts + stamps the component)
     * @param layoutRenderer the layout wrapper (the host's app shell, or the default minimal document)
     * @param assetInjector the runtime-asset injector, or {@code null} to inject nothing
     *     (auto-injection disabled)
     */
    public LievitPageRenderer(
            LievitWireService wireService,
            LayoutRenderer layoutRenderer,
            @Nullable LievitAssetInjector assetInjector) {
        this.wireService = wireService;
        this.layoutRenderer = layoutRenderer;
        this.assetInjector = assetInjector;
    }

    /**
     * Renders the full page for a route-target component, with no asset injection (the request-less
     * form, used where no CSRF token or CSP nonce is available).
     *
     * @param componentType the full-page {@code @LievitComponent} class
     * @param props the route-bound props (path variables) seeded onto the component before mount
     * @return the complete HTML document (layout + component, titled)
     */
    public String renderPage(Class<?> componentType, Map<String, Object> props) {
        return renderPage(componentType, props, null, null);
    }

    /**
     * Renders the full page for a route-target component and auto-injects the runtime assets when an
     * injector is configured (issue #121).
     *
     * @param componentType the full-page {@code @LievitComponent} class
     * @param props the route-bound props (path variables) seeded onto the component before mount
     * @param csrfToken the CSRF token to stamp on the injected runtime script, or {@code null}
     * @param nonce the CSP nonce for the injected script/style, or {@code null}
     * @return the complete HTML document (layout + component, titled, runtime injected when enabled)
     */
    public String renderPage(
            Class<?> componentType,
            Map<String, Object> props,
            @Nullable String csrfToken,
            @Nullable String nonce) {
        PageComponent page = PageComponent.of(componentType);
        // Bind the request's resolved locale (ADR-0037) so the mount captures it into the snapshot
        // memo; the first wire update then restores it instead of reverting to the request default.
        // LocaleContextHolder is already populated by Spring for this MVC request.
        dev.lievit.component.LocaleListener.bind(SpringLocaleSource.INSTANCE);
        WireCallResult mounted;
        try {
            mounted = wireService.mountStamped(componentType.getName(), props);
        } finally {
            dev.lievit.component.LocaleListener.clear();
        }
        // Auto-inject the runtime assets when an injector is configured (issue #121).
        String html = layoutRenderer.render(page.layout(), page.title(), mounted.html());
        if (assetInjector == null) {
            return html;
        }
        return assetInjector.inject(html, csrfToken, nonce);
    }
}
