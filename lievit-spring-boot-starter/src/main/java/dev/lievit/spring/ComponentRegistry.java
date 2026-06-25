/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.ObjectProvider;

import dev.lievit.component.ComponentMetadata;
import dev.lievit.component.ComponentNames;
import dev.lievit.wire.WireError;
import dev.lievit.wire.WireException;

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
    /** Dotted component name -&gt; FQN (issue #183, the Finder name-&gt;class resolution). */
    private final Map<String, String> classNameByName = new HashMap<>();
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
            String name = ComponentNames.nameFor(type);
            String existing = classNameByName.putIfAbsent(name, type.getName());
            if (existing != null && !existing.equals(type.getName())) {
                // Two components resolve to the same dotted name (same simple class name): the
                // resolution would be ambiguous, so fail at startup rather than silently mounting
                // whichever won the map race. Names come from the class, not the template, so two
                // components may share a template but must not share a simple class name.
                throw new IllegalStateException(
                        "two @LievitComponent classes resolve to the same name '" + name + "': "
                                + existing + " and " + type.getName()
                                + " (rename one class so their simple names differ)");
            }
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
     * Resolves a dotted component name ({@code "foo.bar"}, as written in a {@code <lievit:foo.bar>}
     * tag or a route) to its fully-qualified class name (issue #183, the Livewire {@code Finder}
     * name-&gt;class step). The convention is {@link ComponentNames}; a fully-qualified class name is
     * accepted as-is so the wire {@code cls} (always an FQN) flows through unchanged.
     *
     * @param name the dotted component name or a fully-qualified class name
     * @return the resolved fully-qualified class name
     * @throws WireException {@link WireError#UNKNOWN_COMPONENT} if no component resolves to the name
     */
    public String resolveName(String name) {
        if (byClassName.containsKey(name)) {
            return name; // already an FQN
        }
        String className = classNameByName.get(name);
        if (className == null) {
            throw new WireException(
                    WireError.UNKNOWN_COMPONENT, "no @LievitComponent matches the name '" + name + "'");
        }
        return className;
    }

    /**
     * Resolves a dotted component name to its metadata (issue #183): the {@link #resolveName} +
     * {@link #metadata} pair the mount/tag path uses.
     *
     * @param name the dotted component name or a fully-qualified class name
     * @return the metadata
     * @throws WireException {@link WireError#UNKNOWN_COMPONENT} if no component resolves to the name
     */
    public ComponentMetadata metadataByName(String name) {
        return metadata(resolveName(name));
    }

    /**
     * The dotted component name for a fully-qualified class name (issue #183): the inverse of
     * {@link #resolveName}, used to record a {@code ComponentStack} frame's name from the snapshot
     * {@code cls}.
     *
     * @param className the fully-qualified class name (the snapshot {@code cls})
     * @return the dotted component name
     * @throws WireException {@link WireError#UNKNOWN_COMPONENT} if the class is not a registered component
     */
    public String nameOf(String className) {
        ComponentMetadata metadata = metadata(className);
        return ComponentNames.nameFor(metadata.type());
    }

    /**
     * The default template path for a dotted name (issue #183, the Finder view-path convention): the
     * declared {@code @LievitComponent(template)} if any, else the dot-to-slash form of the name.
     *
     * @param name the dotted component name or a fully-qualified class name
     * @return the template path the primary adapter loads
     * @throws WireException {@link WireError#UNKNOWN_COMPONENT} if no component resolves to the name
     */
    public String templatePath(String name) {
        ComponentMetadata metadata = metadataByName(name);
        String declared = metadata.template();
        if (declared != null && !declared.isBlank()) {
            return ComponentNames.nameToPath(ComponentNames.pathToName(declared));
        }
        return ComponentNames.nameToPath(ComponentNames.nameFor(metadata.type()));
    }

    /**
     * @return whether any components are registered (used by the smoke / health checks)
     */
    public boolean isEmpty() {
        return byClassName.isEmpty() && componentBeans.stream().findAny().isEmpty();
    }
}
