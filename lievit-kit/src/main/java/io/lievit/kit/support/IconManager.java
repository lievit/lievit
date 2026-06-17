/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.support;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * The kit icon registry (the filament-app {@code FilamentIcon} / icon registry carried over): a
 * catalog of icon NAMES (the Heroicon set the kit uses, referenced by their canonical
 * {@code heroicon-o-*} / {@code heroicon-s-*} names) plus a layer of semantic ALIASES the kit and
 * plugins resolve through, so a component asks for {@code "actions.create"} and the app can rebind
 * that one alias to a different glyph without touching the component.
 *
 * <p>Two-layer lookup (the Filament contract): {@link #resolve(String)} first checks the alias
 * table (a semantic key like {@code "actions.delete"}); if the name is not an alias it is taken as
 * a literal icon name and returned as-is, so a caller can pass either a semantic alias or a raw
 * {@code heroicon-o-trash}. An app overrides an alias with {@link #alias(String, String)}.
 */
public final class IconManager {

    private final Map<String, String> aliases = new LinkedHashMap<>();

    /** Builds a manager pre-loaded with the kit's default semantic aliases. */
    public IconManager() {
        // Action aliases used by the built-in Create / Edit / Delete actions and the toolbar.
        alias("actions.create", "heroicon-o-plus");
        alias("actions.edit", "heroicon-o-pencil-square");
        alias("actions.delete", "heroicon-o-trash");
        alias("actions.view", "heroicon-o-eye");
        // Field affixes and status glyphs.
        alias("field.search", "heroicon-o-magnifying-glass");
        alias("field.calendar", "heroicon-o-calendar");
        alias("field.check", "heroicon-o-check");
        alias("field.x", "heroicon-o-x-mark");
        // Notification status glyphs.
        alias("notification.success", "heroicon-o-check-circle");
        alias("notification.danger", "heroicon-o-x-circle");
        alias("notification.warning", "heroicon-o-exclamation-triangle");
        alias("notification.info", "heroicon-o-information-circle");
    }

    /**
     * Binds (or overrides) a semantic alias to an icon name. Last write wins.
     *
     * @param alias the semantic key ({@code "actions.delete"})
     * @param iconName the icon the alias resolves to ({@code "heroicon-o-trash"})
     * @return this manager
     */
    public IconManager alias(String alias, String iconName) {
        aliases.put(
                Objects.requireNonNull(alias, "alias"),
                Objects.requireNonNull(iconName, "iconName"));
        return this;
    }

    /**
     * Resolves a name to its concrete icon: a registered alias is mapped, any other name is taken
     * as a literal icon name and returned unchanged (so callers can pass either form).
     *
     * @param name an alias key or a literal icon name
     * @return the concrete icon name to render
     */
    public String resolve(String name) {
        Objects.requireNonNull(name, "name");
        return aliases.getOrDefault(name, name);
    }

    /**
     * @param alias the semantic key
     * @return {@code true} if a semantic alias is registered under that key
     */
    public boolean hasAlias(String alias) {
        return aliases.containsKey(alias);
    }
}
