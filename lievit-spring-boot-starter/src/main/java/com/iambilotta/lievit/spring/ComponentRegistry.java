/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.spring;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.ObjectProvider;

import com.iambilotta.lievit.component.ComponentMetadata;
import com.iambilotta.lievit.wire.WireError;
import com.iambilotta.lievit.wire.WireException;

/**
 * Resolves a snapshot's {@code cls} (a fully-qualified class name) to a freshly-built component
 * instance plus its cached {@link ComponentMetadata} (ADR-0001, wire-protocol.md section 2).
 *
 * <p>The wire carries the class <em>name</em>, never code: the server owns the class and looks it
 * up here. A name that resolves to no registered {@code @LievitComponent} is a {@link
 * WireError#UNKNOWN_COMPONENT} (410 Gone): the build moved on and the snapshot names a component
 * that is gone.
 *
 * <p>Each wire call gets a <em>fresh</em> instance (the components are prototype-scoped beans), so
 * no component state leaks between stateless calls; the snapshot is the only carrier of state.
 */
public final class ComponentRegistry {

    private final ObjectProvider<Object> componentBeans;
    private final Map<String, ComponentMetadata> byClassName = new HashMap<>();
    private final Map<String, String> beanNameByClassName = new HashMap<>();
    private final org.springframework.beans.factory.BeanFactory beanFactory;

    /**
     * @param beanFactory the Spring bean factory (used to mint fresh prototype instances)
     * @param componentBeans the discovered {@code @LievitComponent} beans
     * @param beanNamesToTypes bean name -&gt; component class, for the FQN lookup table
     */
    public ComponentRegistry(
            org.springframework.beans.factory.BeanFactory beanFactory,
            ObjectProvider<Object> componentBeans,
            Map<String, Class<?>> beanNamesToTypes) {
        this.beanFactory = beanFactory;
        this.componentBeans = componentBeans;
        for (Map.Entry<String, Class<?>> entry : beanNamesToTypes.entrySet()) {
            Class<?> type = entry.getValue();
            ComponentMetadata metadata = ComponentMetadata.of(type);
            byClassName.put(type.getName(), metadata);
            beanNameByClassName.put(type.getName(), entry.getKey());
        }
    }

    /**
     * Resolves a component class name to its metadata.
     *
     * @param className the snapshot {@code cls}
     * @return the metadata
     * @throws WireException {@link WireError#UNKNOWN_COMPONENT} if no such component is registered
     */
    public ComponentMetadata metadata(String className) {
        ComponentMetadata metadata = byClassName.get(className);
        if (metadata == null) {
            throw new WireException(
                    WireError.UNKNOWN_COMPONENT, "no @LievitComponent matches the snapshot class");
        }
        return metadata;
    }

    /**
     * Mints a fresh component instance for a wire call.
     *
     * @param className the snapshot {@code cls}
     * @return a new instance, with Spring dependencies injected
     * @throws WireException {@link WireError#UNKNOWN_COMPONENT} if no such component is registered
     */
    public Object freshInstance(String className) {
        String beanName = beanNameByClassName.get(className);
        if (beanName == null) {
            throw new WireException(
                    WireError.UNKNOWN_COMPONENT, "no @LievitComponent matches the snapshot class");
        }
        // Prototype scope: every getBean is a new instance, so no state survives between calls.
        return beanFactory.getBean(beanName);
    }

    /**
     * @return whether any components are registered (used by the smoke / health checks)
     */
    public boolean isEmpty() {
        return byClassName.isEmpty() && componentBeans.stream().findAny().isEmpty();
    }
}
