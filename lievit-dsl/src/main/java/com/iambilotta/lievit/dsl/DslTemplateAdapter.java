/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.dsl;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Map;

import com.iambilotta.lievit.component.ComponentMetadata;
import com.iambilotta.lievit.render.TemplateAdapter;

/**
 * The single-file DSL template adapter: renders a component that has no template by invoking its
 * {@code @LievitRender} method and serializing the {@link Html} tree it returns (ADR-0003, ADR-0018).
 * It is a peer of the JTE / Thymeleaf / ... adapters behind the same {@link TemplateAdapter} SPI
 * (ADR-0004), so a single-file-DSL component flows through mount, the wire call, effects, and the
 * morph exactly like a template component: the dispatcher and codec do not know which adapter
 * rendered the HTML.
 *
 * <p>Two contracts the adapter enforces so the DSL output is wire-compatible with a template's:
 *
 * <ul>
 *   <li><strong>One root element.</strong> The {@code @LievitRender} method must return a single
 *       {@link Element} (not a bare {@link TextNode} / {@link Fragment}): the wire stamps and morphs
 *       one component root. A non-{@code Element} return is an {@link IllegalStateException}.
 *   <li><strong>The root carries {@code data-lievit-component}.</strong> The adapter injects the
 *       component's FQN as {@code data-lievit-component} on the root if the author did not, so the
 *       client binds the same marker a JTE template stamps by hand ({@code counter.jte}). The wire
 *       attributes ({@code l:click}, {@code l:model}) are authored on the tree via {@link
 *       Element#wireClick}/{@link Element#wireModel}/{@code attr} and emitted escaped.
 * </ul>
 *
 * <p>The one reflective call is the same {@code @LievitRender} invocation the core {@code
 * WireDispatcher} already performs (it discards the return; this adapter consumes it). No new runtime
 * reflection is introduced, so the GraalVM-native posture is unchanged (ADR-0006). Pure Java, zero
 * Spring (ADR-0007); depends only on {@code lievit-core}.
 */
public final class DslTemplateAdapter implements TemplateAdapter {

    static final String COMPONENT_ATTR = "data-lievit-component";

    /**
     * Whether a component renders through this adapter: it declares no template and its
     * {@code @LievitRender} method returns an {@link Html}. A component with a template name renders
     * through the engine adapter (JTE primary) instead.
     *
     * @param metadata the component metadata
     * @return true if this is a single-file DSL component
     */
    public static boolean handles(ComponentMetadata metadata) {
        if (!metadata.template().isEmpty()) {
            return false;
        }
        Method render = metadata.render();
        return render != null && Html.class.isAssignableFrom(render.getReturnType());
    }

    @Override
    public String render(ComponentMetadata metadata, Object instance, Map<String, Object> wire) {
        Method render = metadata.render();
        if (render == null || !Html.class.isAssignableFrom(render.getReturnType())) {
            throw new IllegalStateException(
                    "@LievitComponent("
                            + metadata.className()
                            + ") declares no template and no @LievitRender method returning Html;"
                            + " single-file DSL render is not possible");
        }
        Html tree = invokeRender(metadata, instance, render);
        Element root = requireElementRoot(metadata, tree);
        return stampComponentMarker(metadata, root).render();
    }

    private Html invokeRender(ComponentMetadata metadata, Object instance, Method render) {
        try {
            render.setAccessible(true);
            Object result = render.invoke(instance);
            if (result == null) {
                throw new IllegalStateException(
                        "@LievitRender of " + metadata.className() + " returned null");
            }
            return (Html) result;
        } catch (IllegalAccessException e) {
            throw new IllegalStateException(
                    "cannot invoke @LievitRender of " + metadata.className(), e);
        } catch (InvocationTargetException e) {
            Throwable cause = e.getCause();
            if (cause instanceof RuntimeException re) {
                throw re;
            }
            throw new IllegalStateException(
                    "@LievitRender of " + metadata.className() + " threw a checked exception", cause);
        }
    }

    private Element requireElementRoot(ComponentMetadata metadata, Html tree) {
        if (tree instanceof Element element) {
            return element;
        }
        throw new IllegalStateException(
                "@LievitRender of "
                        + metadata.className()
                        + " must return a single root Element (wrap it in div(...)); got "
                        + tree.getClass().getSimpleName());
    }

    /**
     * Injects the {@code data-lievit-component} root marker if the author did not already set it, so
     * the rendered root matches what the client binds for a template component.
     */
    private Element stampComponentMarker(ComponentMetadata metadata, Element root) {
        boolean alreadyStamped =
                root.attributes().stream().anyMatch(a -> a.name().equals(COMPONENT_ATTR));
        if (alreadyStamped) {
            return root;
        }
        return root.attr(COMPONENT_ATTR, metadata.className());
    }
}
