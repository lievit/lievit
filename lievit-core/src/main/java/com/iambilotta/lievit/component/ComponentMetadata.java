/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.component;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.LinkedHashMap;
import java.util.Map;

import org.jspecify.annotations.Nullable;

import com.iambilotta.lievit.LievitAction;
import com.iambilotta.lievit.LievitComponent;
import com.iambilotta.lievit.LievitFormObject;
import com.iambilotta.lievit.LievitMount;
import com.iambilotta.lievit.LievitProperty;
import com.iambilotta.lievit.LievitRender;
import com.iambilotta.lievit.Wire;

/**
 * The reflected shape of a {@link LievitComponent} class: its {@code @Wire} fields (each with its
 * {@code @LievitProperty} flags), its {@code @LievitAction} methods, and its optional
 * {@code @LievitMount} / {@code @LievitRender} lifecycle hooks (ADR-0001, ADR-0002).
 *
 * <p>A {@code @Wire} field whose type implements {@link LievitFormObject} additionally carries a
 * {@link FormObjectMetadata} entry: the dispatcher can then hydrate and dehydrate the nested form
 * fields via dotted paths in {@code _updates} and a nested map in the snapshot {@code wire}
 * (ADR-0015).
 *
 * <p>Pure Java reflection, zero Spring (ADR-0007). Built once per component class and reused; the
 * wire layer reads field state and invokes actions through it. Only fields declared on the
 * component class itself are bound (not inherited fields), matching the snapshot-carries-state
 * contract.
 */
public final class ComponentMetadata {

    private final Class<?> type;
    private final String template;
    private final Map<String, WireField> wireFields;
    /** Form-object metadata keyed by the @Wire field name; present only for form-object fields. */
    private final Map<String, FormObjectMetadata> formObjects;
    private final Map<String, Method> actions;
    private final @Nullable Method mount;
    private final @Nullable Method render;

    private ComponentMetadata(
            Class<?> type,
            String template,
            Map<String, WireField> wireFields,
            Map<String, FormObjectMetadata> formObjects,
            Map<String, Method> actions,
            @Nullable Method mount,
            @Nullable Method render) {
        this.type = type;
        this.template = template;
        this.wireFields = wireFields;
        this.formObjects = formObjects;
        this.actions = actions;
        this.mount = mount;
        this.render = render;
    }

    /**
     * Reflects a {@code @LievitComponent} class into its wire metadata.
     *
     * @param type the component class (must carry {@link LievitComponent})
     * @return the reflected metadata
     * @throws IllegalArgumentException if the class is not a {@code @LievitComponent}
     */
    public static ComponentMetadata of(Class<?> type) {
        LievitComponent component = type.getAnnotation(LievitComponent.class);
        if (component == null) {
            throw new IllegalArgumentException(
                    type.getName() + " is not annotated with @LievitComponent");
        }

        Map<String, WireField> fields = new LinkedHashMap<>();
        Map<String, FormObjectMetadata> formObjects = new LinkedHashMap<>();
        for (Field field : type.getDeclaredFields()) {
            if (!field.isAnnotationPresent(Wire.class)) {
                continue;
            }
            field.setAccessible(true);
            LievitProperty property = field.getAnnotation(LievitProperty.class);
            boolean serialize = property == null || property.serialize();
            boolean locked = property != null && property.locked();
            fields.put(field.getName(), new WireField(field.getName(), field, serialize, locked));

            // If the field type is a LievitFormObject, build (and cache) its form metadata.
            // The form object's own fields will be bound via dotted paths (ADR-0015).
            if (LievitFormObject.class.isAssignableFrom(field.getType())) {
                formObjects.put(field.getName(), FormObjectMetadata.of(field.getType()));
            }
        }

        Map<String, Method> methods = new LinkedHashMap<>();
        Method mountHook = null;
        Method renderHook = null;
        for (Method method : type.getDeclaredMethods()) {
            if (method.isAnnotationPresent(LievitAction.class)) {
                method.setAccessible(true);
                methods.put(method.getName(), method);
            }
            if (method.isAnnotationPresent(LievitMount.class)) {
                method.setAccessible(true);
                mountHook = method;
            }
            if (method.isAnnotationPresent(LievitRender.class)) {
                method.setAccessible(true);
                renderHook = method;
            }
        }

        return new ComponentMetadata(
                type,
                component.template(),
                Map.copyOf(fields),
                Map.copyOf(formObjects),
                Map.copyOf(methods),
                mountHook,
                renderHook);
    }

    /**
     * @return the component class
     */
    public Class<?> type() {
        return type;
    }

    /**
     * @return the fully-qualified class name, the snapshot {@code cls}
     */
    public String className() {
        return type.getName();
    }

    /**
     * @return the declared template name (empty for single-file render)
     */
    public String template() {
        return template;
    }

    /**
     * @return the {@code @Wire} fields by name, in declaration order
     */
    public Map<String, WireField> wireFields() {
        return wireFields;
    }

    /**
     * Returns the {@link FormObjectMetadata} for the named {@code @Wire} field, when that field is
     * a {@link LievitFormObject}.
     *
     * @param wireFieldName the {@code @Wire} field name on the component
     * @return the form object metadata, or {@code null} if the field is not a form object
     */
    public @Nullable FormObjectMetadata formObject(String wireFieldName) {
        return formObjects.get(wireFieldName);
    }

    /**
     * @return the form-object metadata keyed by {@code @Wire} field name (immutable; may be empty)
     */
    public Map<String, FormObjectMetadata> formObjects() {
        return formObjects;
    }

    /**
     * Looks up an action method by name.
     *
     * @param name the action method name (from the client {@code _calls})
     * @return the method, or {@code null} if no such {@code @LievitAction} exists
     */
    public @Nullable Method action(String name) {
        return actions.get(name);
    }

    /**
     * @return the {@code @LievitMount} hook, or {@code null} if the component has none
     */
    public @Nullable Method mount() {
        return mount;
    }

    /**
     * @return the {@code @LievitRender} hook, or {@code null} if the component has none
     */
    public @Nullable Method render() {
        return render;
    }
}
