/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import java.lang.reflect.Method;
import java.util.List;

import org.jspecify.annotations.Nullable;

/**
 * Interpolates {@code {dotted.path}} placeholders in a name template (an {@code @LievitOn} event
 * name or a {@code @LievitSession} key) against a component instance's {@code @Wire} state (ADR-0030,
 * ADR-0031). The root segment names a {@code @Wire} field; one further segment reads a nested
 * property (record accessor, getter, or field). An unresolvable placeholder is left as its literal
 * text, so a misconfigured name simply fails to match rather than throwing.
 */
final class PlaceholderNames {

    private PlaceholderNames() {}

    /**
     * Interpolates every {@code {dotted.path}} placeholder in the template against the instance.
     *
     * @param template the name template (may contain zero or more placeholders)
     * @param instance the component instance (read for placeholder values)
     * @return the interpolated name
     */
    static String interpolate(String template, Object instance) {
        if (template.indexOf('{') < 0) {
            return template;
        }
        ComponentMetadata metadata = ComponentMetadata.of(instance.getClass());
        StringBuilder out = new StringBuilder();
        int i = 0;
        while (i < template.length()) {
            char c = template.charAt(i);
            if (c == '{') {
                int close = template.indexOf('}', i);
                if (close < 0) {
                    out.append(template.substring(i));
                    break;
                }
                String path = template.substring(i + 1, close).strip();
                out.append(resolvePath(path, instance, metadata));
                i = close + 1;
            } else {
                out.append(c);
                i++;
            }
        }
        return out.toString();
    }

    private static String resolvePath(String path, Object instance, ComponentMetadata metadata) {
        int dot = path.indexOf('.');
        String rootName = dot < 0 ? path : path.substring(0, dot);
        WireField root = metadata.wireFields().get(rootName);
        if (root == null) {
            return "{" + path + "}"; // unresolved: leave literal
        }
        Object value = root.read(instance);
        if (dot < 0 || value == null) {
            return String.valueOf(value);
        }
        return String.valueOf(readNested(value, path.substring(dot + 1)));
    }

    /** Reads one nested property (record accessor / getter / field) for the {root.prop} form. */
    private static @Nullable Object readNested(Object target, String property) {
        Class<?> type = target.getClass();
        for (String candidate : List.of(
                property,
                "get" + Character.toUpperCase(property.charAt(0)) + property.substring(1))) {
            try {
                Method m = type.getMethod(candidate);
                m.setAccessible(true);
                return m.invoke(target);
            } catch (ReflectiveOperationException ignored) {
                // try next
            }
        }
        try {
            java.lang.reflect.Field f = type.getDeclaredField(property);
            f.setAccessible(true);
            return f.get(target);
        } catch (ReflectiveOperationException e) {
            return null;
        }
    }
}
