/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationContext;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.function.RouterFunction;
import org.springframework.web.servlet.function.RouterFunctions;
import org.springframework.web.servlet.function.ServerResponse;

import io.lievit.LievitComponent;
import io.lievit.LievitPage;
import io.lievit.component.PageComponent;

/**
 * Builds the {@link RouterFunction} that maps each {@code @LievitPage} component to a route on the
 * shared full-page handler (issue #181, ADR-0033, Livewire {@code Route::livewire} +
 * {@code LivewirePageController}). It scans the {@code @LievitComponent} beans, and for every one that
 * also carries {@code @LievitPage}, registers a {@code GET} route at the declared URI.
 *
 * <p>The handler extracts the route's path variables and passes them as props to
 * {@link LievitPageRenderer}, which seeds them onto the component's same-named {@code @Wire} fields
 * before mount: the lievit analogue of Laravel's implicit route-model binding. The rendered page is
 * returned as {@code text/html}.
 */
final class LievitPageRoutes {

    // {name} path-variable tokens in a Spring route pattern.
    private static final Pattern PATH_VAR = Pattern.compile("\\{([a-zA-Z][\\w]*)}");

    private final ApplicationContext context;
    private final LievitPageRenderer renderer;
    private final boolean cspEnabled;
    private final String nonceAttribute;

    LievitPageRoutes(ApplicationContext context, LievitPageRenderer renderer) {
        this(context, renderer, true, "lievit.csp-nonce");
    }

    LievitPageRoutes(
            ApplicationContext context,
            LievitPageRenderer renderer,
            boolean cspEnabled,
            String nonceAttribute) {
        this.context = context;
        this.renderer = renderer;
        this.cspEnabled = cspEnabled;
        this.nonceAttribute = nonceAttribute;
    }

    RouterFunction<ServerResponse> build() {
        RouterFunctions.Builder builder = RouterFunctions.route();
        boolean any = false;
        for (String beanName : context.getBeanNamesForAnnotation(LievitComponent.class)) {
            Class<?> type = context.getType(beanName);
            if (type == null) {
                continue;
            }
            PageComponent page = PageComponent.of(type);
            String route = page.route();
            if (route == null) {
                continue;
            }
            registerRoute(builder, type, route);
            any = true;
        }
        if (!any) {
            // RouterFunctions.Builder.build() throws when empty; an app with no @LievitPage component
            // gets a router that matches nothing, so the bean is harmless.
            return request -> java.util.Optional.empty();
        }
        return builder.build();
    }

    private void registerRoute(RouterFunctions.Builder builder, Class<?> type, String route) {
        // The set of path-variable names declared in the route pattern, so the handler binds exactly
        // those (an extra request attribute or query param is not seeded as a prop).
        java.util.List<String> varNames = pathVariableNames(route);
        builder.GET(
                route,
                request -> {
                    Map<String, Object> props = new LinkedHashMap<>();
                    Map<String, String> vars = request.pathVariables();
                    for (String name : varNames) {
                        String value = vars.get(name);
                        if (value != null) {
                            props.put(name, value);
                        }
                    }
                    String html =
                            renderer.renderPage(
                                    type, props, csrfToken(request), cspNonce(request));
                    // (nonce read below honours lievit.csp.* config, issue #127)
                    return ServerResponse.ok().contentType(MediaType.TEXT_HTML).body(html);
                });
    }

    private static java.util.List<String> pathVariableNames(String route) {
        java.util.List<String> names = new java.util.ArrayList<>();
        Matcher m = PATH_VAR.matcher(route);
        while (m.find()) {
            names.add(m.group(1));
        }
        return names;
    }

    /**
     * Reads the Spring Security CSRF token (issue #121) off the request without a hard dependency on
     * spring-security: the token is exposed as a request attribute under the well-known
     * {@code org.springframework.security.web.csrf.CsrfToken} name, and its value carries a
     * {@code getToken()} accessor read reflectively. Returns {@code null} when the app runs without
     * CSRF (no such attribute), so the runtime simply ships without a {@code data-csrf}.
     */
    private static @Nullable String csrfToken(
            org.springframework.web.servlet.function.ServerRequest request) {
        Object token =
                request
                        .servletRequest()
                        .getAttribute("org.springframework.security.web.csrf.CsrfToken");
        if (token == null) {
            return null;
        }
        try {
            Object value = token.getClass().getMethod("getToken").invoke(token);
            return value == null ? null : value.toString();
        } catch (ReflectiveOperationException ignored) {
            return null;
        }
    }

    /**
     * Reads a CSP nonce off the request (issue #121/#127, the strict-CSP posture of ADR-0019/0062): a
     * host using a nonce-based CSP exposes it as the configured {@code lievit.csp.nonce-attribute}
     * request attribute (default {@code lievit.csp-nonce}), falling back to the Spring Security 6.2+
     * {@code org.springframework.security.web.csp.nonce}. Returns {@code null} when CSP-mode is
     * disabled ({@code lievit.csp.enabled=false}) or no nonce is in play, so the injected tag carries
     * no spurious nonce attribute.
     */
    private @Nullable String cspNonce(
            org.springframework.web.servlet.function.ServerRequest request) {
        if (!cspEnabled) {
            return null;
        }
        Object nonce = request.servletRequest().getAttribute(nonceAttribute);
        if (nonce == null) {
            nonce =
                    request
                            .servletRequest()
                            .getAttribute("org.springframework.security.web.csp.nonce");
        }
        return nonce == null ? null : nonce.toString();
    }
}
