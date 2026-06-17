/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.component;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.LinkedHashMap;
import java.util.Map;

import com.iambilotta.lievit.LievitFormObject;

/**
 * The reflected shape of a {@link LievitFormObject} class: its bindable fields (ADR-0015).
 *
 * <p>All non-static, non-transient fields declared directly on the form object class are
 * reflected as {@link FormField}s and made accessible. Inherited fields are excluded (only
 * the fields declared on the concrete class bind — mirroring the policy for top-level
 * {@link WireField}s in {@link ComponentMetadata}).
 *
 * <p>Built once per form-object class and cached by {@link ComponentMetadata}; reused across
 * every wire call. Pure Java reflection, zero Spring (ADR-0007).
 */
public final class FormObjectMetadata {

    private final Class<? extends LievitFormObject> type;
    private final Map<String, FormField> fields;

    private FormObjectMetadata(
            Class<? extends LievitFormObject> type, Map<String, FormField> fields) {
        this.type = type;
        this.fields = fields;
    }

    /**
     * Reflects a {@link LievitFormObject} class into its form metadata.
     *
     * @param type the form object class
     * @return the reflected metadata
     */
    @SuppressWarnings("unchecked")
    public static FormObjectMetadata of(Class<?> type) {
        Map<String, FormField> fields = new LinkedHashMap<>();
        for (Field field : type.getDeclaredFields()) {
            int mods = field.getModifiers();
            // Bind all non-static, non-transient fields (public and package-private alike).
            // Static and transient are explicitly excluded: static is class-level state, transient
            // marks "do not serialize" by Java convention.
            if (Modifier.isStatic(mods) || Modifier.isTransient(mods)) {
                continue;
            }
            // Reject nested form objects (bounded depth, ADR-0015 §Security).
            if (LievitFormObject.class.isAssignableFrom(field.getType())) {
                throw new IllegalArgumentException(
                        "form object field '"
                                + field.getName()
                                + "' on "
                                + type.getName()
                                + " is itself a LievitFormObject: nested form objects are"
                                + " not supported (max depth 1, ADR-0015)");
            }
            field.setAccessible(true);
            fields.put(field.getName(), new FormField(field.getName(), field));
        }
        return new FormObjectMetadata((Class<? extends LievitFormObject>) type, Map.copyOf(fields));
    }

    /**
     * @return the form object class
     */
    public Class<? extends LievitFormObject> type() {
        return type;
    }

    /**
     * @return the bindable fields by name, in declaration order
     */
    public Map<String, FormField> fields() {
        return fields;
    }

    /**
     * Creates a new instance of the form object class using its no-arg constructor.
     *
     * @return a fresh form object instance (fields at their declared defaults)
     * @throws IllegalStateException if the form object class has no accessible no-arg constructor
     */
    public LievitFormObject newInstance() {
        try {
            return type.getDeclaredConstructor().newInstance();
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(
                    "LievitFormObject "
                            + type.getName()
                            + " must have an accessible no-arg constructor",
                    e);
        }
    }
}
