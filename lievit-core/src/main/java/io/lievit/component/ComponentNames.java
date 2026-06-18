/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import java.util.Locale;

/**
 * The component naming convention (issue #183, Livewire's {@code Finder} name&lt;-&gt;path mapping):
 * the rules that turn a dotted component <em>name</em> ({@code "foo.bar"}, as written in a
 * {@code <lievit:foo.bar>} tag or a route) into a default <em>template path</em> ({@code "foo/bar"})
 * and back. Pure functions, zero Spring, so the convention is one shared, tested place rather than
 * scattered string-munging.
 *
 * <p>The dotted name is the authoring identity; the slashed path is the on-disk template location
 * (the JTE template name for the primary adapter, ADR-0004). Livewire's {@code Finder} does the same
 * dot-to-slash conversion; lievit mirrors it so {@code <lievit:admin.users.table>} resolves to the
 * {@code admin/users/table} template by convention, with no per-component configuration.
 *
 * <p>A component's <em>name</em> is derived from its simple class name: a trailing {@code Component}
 * suffix is dropped and the head is decapitalised ({@code UserTableComponent -> userTable}). The name
 * is the component's identity and must be unique. The <em>template</em> is a separate concern (the
 * view path): a component may declare one with {@code @LievitComponent(template = ...)}, and TWO
 * components are allowed to share the same template (e.g. create + edit rendering one form view),
 * because identity comes from the class, not the view. This mirrors Livewire, where the component
 * name comes from the class and {@code render()} returns a view independently.
 */
public final class ComponentNames {

    private ComponentNames() {}

    /**
     * The dotted name for a component class: the decapitalised simple class name with a
     * {@code Component} suffix stripped. Independent of any declared template, so two components that
     * share a template still get distinct names.
     *
     * @param type the component class
     * @return the dotted component name (never blank)
     */
    public static String nameFor(Class<?> type) {
        String simple = type.getSimpleName();
        if (simple.endsWith("Component") && simple.length() > "Component".length()) {
            simple = simple.substring(0, simple.length() - "Component".length());
        }
        if (simple.isEmpty()) {
            return type.getSimpleName().toLowerCase(Locale.ROOT);
        }
        return Character.toLowerCase(simple.charAt(0)) + simple.substring(1);
    }

    /**
     * The default template path for a dotted name: dots become slashes ({@code "foo.bar"} →
     * {@code "foo/bar"}). The lievit analogue of Livewire's {@code Finder} view-path convention.
     *
     * @param name the dotted component name
     * @return the slashed template path
     */
    public static String nameToPath(String name) {
        return name.replace('.', '/');
    }

    /**
     * The dotted name for a template path: slashes become dots ({@code "foo/bar"} → {@code "foo.bar"};
     * a backslash is also treated as a separator for robustness).
     *
     * @param path the template path
     * @return the dotted name
     */
    public static String pathToName(String path) {
        return path.replace('\\', '/').replace('/', '.');
    }
}
