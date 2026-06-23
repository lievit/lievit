/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.LinkedHashMap;
import java.util.Map;

import org.jspecify.annotations.Nullable;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.LievitComputed;
import io.lievit.LievitFormObject;
import io.lievit.LievitMount;
import io.lievit.LievitProperty;
import io.lievit.LievitRender;
import io.lievit.LievitUrl;
import io.lievit.Wire;

/**
 * The reflected shape of a {@link LievitComponent} class: its {@code @Wire} fields (each with its
 * {@code @LievitProperty} flags), its {@code @LievitAction} methods, its optional
 * {@code @LievitMount} / {@code @LievitRender} lifecycle hooks, and its {@code @LievitComputed}
 * methods (ADR-0001, ADR-0002, ADR-0015, ADR-0016, ADR-0017).
 *
 * <p>A {@code @Wire} field whose type implements {@link LievitFormObject} additionally carries a
 * {@link FormObjectMetadata} entry: the dispatcher can then hydrate and dehydrate the nested form
 * fields via dotted paths in {@code _updates} and a nested map in the snapshot {@code wire}
 * (ADR-0017).
 *
 * <p>Pure Java reflection, zero Spring (ADR-0007). Built once per component class and reused; the
 * wire layer reads field state and invokes actions through it. Only fields and methods declared on
 * the component class itself are bound (not inherited members), matching the snapshot-carries-state
 * contract.
 */
public final class ComponentMetadata {

    private final Class<?> type;
    private final String template;
    private final Map<String, WireField> wireFields;
    /** Form-object metadata keyed by the @Wire field name; present only for form-object fields. */
    private final Map<String, FormObjectMetadata> formObjects;
    private final Map<String, Method> actions;
    private final Map<String, Method> computed;
    private final @Nullable Method mount;
    private final @Nullable Method render;
    private final @Nullable String modelableField;

    private ComponentMetadata(
            Class<?> type,
            String template,
            Map<String, WireField> wireFields,
            Map<String, FormObjectMetadata> formObjects,
            Map<String, Method> actions,
            Map<String, Method> computed,
            @Nullable Method mount,
            @Nullable Method render,
            @Nullable String modelableField) {
        this.type = type;
        this.template = template;
        this.wireFields = wireFields;
        this.formObjects = formObjects;
        this.actions = actions;
        this.computed = computed;
        this.mount = mount;
        this.render = render;
        this.modelableField = modelableField;
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
        String modelable = null;
        for (Field field : type.getDeclaredFields()) {
            if (!field.isAnnotationPresent(Wire.class)) {
                continue;
            }
            field.setAccessible(true);
            LievitProperty property = field.getAnnotation(LievitProperty.class);
            boolean serialize = property == null || property.serialize();
            boolean locked = property != null && property.locked();
            boolean isModelable = property != null && property.modelable();
            if (isModelable && locked) {
                throw new IllegalArgumentException(
                        type.getName()
                                + "."
                                + field.getName()
                                + " is both @LievitProperty(modelable) and (locked): a"
                                + " server-owned field cannot be a parent two-way bind (ADR-0016)");
            }
            if (isModelable) {
                if (modelable != null) {
                    throw new IllegalArgumentException(
                            type.getName()
                                    + " declares more than one @LievitProperty(modelable) field ("
                                    + modelable
                                    + ", "
                                    + field.getName()
                                    + "): a component has at most one parent-bound value"
                                    + " (ADR-0016)");
                }
                modelable = field.getName();
            }
            UrlBinding url = urlBindingOf(field);
            fields.put(
                    field.getName(),
                    new WireField(field.getName(), field, serialize, locked, isModelable, url));

            // If the field type is a LievitFormObject, build (and cache) its form metadata.
            // The form object's own fields will be bound via dotted paths (ADR-0017).
            if (LievitFormObject.class.isAssignableFrom(field.getType())) {
                formObjects.put(field.getName(), FormObjectMetadata.of(field.getType()));
            }
        }

        Map<String, Method> methods = new LinkedHashMap<>();
        Map<String, Method> computedMethods = new LinkedHashMap<>();
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
            if (method.isAnnotationPresent(LievitComputed.class)) {
                if (method.getParameterCount() != 0) {
                    throw new IllegalArgumentException(
                            "@LievitComputed method " + method.getName()
                                    + " on " + type.getName() + " must be no-arg");
                }
                if (method.getReturnType() == void.class) {
                    throw new IllegalArgumentException(
                            "@LievitComputed method " + method.getName()
                                    + " on " + type.getName() + " must return a value (not void)");
                }
                method.setAccessible(true);
                computedMethods.put(method.getName(), method);
            }
        }

        String template = component.template();
        rejectAmbiguousRender(type, template, renderHook);

        return new ComponentMetadata(
                type,
                template,
                Map.copyOf(fields),
                Map.copyOf(formObjects),
                Map.copyOf(methods),
                Map.copyOf(computedMethods),
                mountHook,
                renderHook,
                modelable);
    }

    /**
     * Rejects the undefined single-file-vs-multi-file render combination at reflect time (startup),
     * so the adapter never has to silently pick a winner.
     *
     * <p>The two render modes are mutually exclusive (ADR-0001, {@link LievitRender}):
     * <ul>
     *   <li><b>multi-file</b>: {@code @LievitComponent(template="...")} names a template; a
     *       {@code @LievitRender} method, if any, is a {@code void} prepare-hook (its return is
     *       ignored by {@code invokeHook}).
     *   <li><b>single-file</b>: an empty {@code template} plus a {@code @LievitRender} method that
     *       <em>returns markup</em> (a non-{@code void} return) which IS the render.
     * </ul>
     *
     * <p>A non-empty template AND a markup-returning {@code @LievitRender} is the illegal combo: the
     * named template would render one thing and the returned markup another, and which wins is
     * adapter-dependent (undefined). Fail fast with a message that names both halves and the fix.
     */
    private static void rejectAmbiguousRender(
            Class<?> type, String template, @Nullable Method renderHook) {
        if (template.isEmpty() || renderHook == null) {
            return; // single-file, or multi-file without a render hook: unambiguous.
        }
        if (renderHook.getReturnType() != void.class) {
            throw new IllegalArgumentException(
                    type.getName()
                            + " declares both @LievitComponent(template=\""
                            + template
                            + "\") and a markup-returning @LievitRender method ("
                            + renderHook.getName()
                            + " returns "
                            + renderHook.getReturnType().getSimpleName()
                            + "): which renders is undefined. Use either a named template with a"
                            + " void @LievitRender prepare-hook (multi-file), or an empty template"
                            + " with a markup-returning @LievitRender (single-file), not both"
                            + " (ADR-0001).");
        }
    }

    /**
     * Resolves a field's {@code @LievitUrl} binding, if any. The query-parameter key is the {@code
     * as} / {@code key} alias when set, otherwise the field name; declaring both aliases at once is a
     * configuration error caught here, not at runtime.
     */
    private static @Nullable UrlBinding urlBindingOf(Field field) {
        LievitUrl url = field.getAnnotation(LievitUrl.class);
        if (url == null) {
            return null;
        }
        String as = url.as().strip();
        String key = url.key().strip();
        if (!as.isEmpty() && !key.isEmpty() && !as.equals(key)) {
            throw new IllegalArgumentException(
                    "@LievitUrl on field '"
                            + field.getName()
                            + "' sets both as=\""
                            + as
                            + "\" and key=\""
                            + key
                            + "\"; set at most one");
        }
        String alias = !as.isEmpty() ? as : key;
        String resolved = alias.isEmpty() ? field.getName() : alias;
        return new UrlBinding(resolved, url.keepEmpty(), url.history());
    }

    /**
     * @return the {@code @Wire} fields that also carry a {@code @LievitUrl} binding, in declaration
     *     order; empty if the component reflects no field into the URL
     */
    public Map<String, WireField> urlBoundFields() {
        Map<String, WireField> bound = new LinkedHashMap<>();
        for (WireField field : wireFields.values()) {
            if (field.isUrlBound()) {
                bound.put(field.name(), field);
            }
        }
        return bound;
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
     * @return the {@code @LievitComputed} methods by name, in declaration order (ADR-0015)
     */
    public Map<String, Method> computedMethods() {
        return computed;
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

    /**
     * The name of this component's modelable {@code @Wire} field, if it has one: the field that
     * two-way-binds to a parent property when this component is mounted as a child (ADR-0016,
     * Livewire {@code #[Modelable]} parity). A component declares at most one (enforced at reflect
     * time).
     *
     * @return the modelable field name, or {@code null} if the component has no modelable field
     */
    public @Nullable String modelableField() {
        return modelableField;
    }
}
