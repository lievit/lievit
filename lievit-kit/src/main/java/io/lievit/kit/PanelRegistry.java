/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * The multi-panel registry (the Filament {@code PanelRegistry} + {@code FilamentManager}
 * current-panel resolution): holds several {@link Panel}s keyed by id, resolves the default panel,
 * and resolves the current panel for a request path by matching its route prefix. A real install
 * commonly runs an {@code admin} panel plus a customer portal; the single-panel assumption does not
 * cover that, so the registry is the seam that does.
 *
 * <p>Invariants enforced here: ids are unique (a duplicate id is rejected); at most one panel is
 * marked default (a second default is rejected); paths are unique (two panels cannot share a route
 * prefix, which would make current-panel resolution ambiguous).
 */
public final class PanelRegistry {

    private final Map<String, Panel> byId = new LinkedHashMap<>();
    private final Map<String, Panel> byPath = new LinkedHashMap<>();
    private Panel defaultPanel;

    private PanelRegistry() {}

    /**
     * @return a new, empty registry
     */
    public static PanelRegistry create() {
        return new PanelRegistry();
    }

    /**
     * Registers a panel.
     *
     * @param panel the panel
     * @return this registry
     * @throws IllegalStateException if its id or path collides, or it is a second default panel
     */
    public PanelRegistry register(Panel panel) {
        Objects.requireNonNull(panel, "panel");
        if (byId.containsKey(panel.id())) {
            throw new IllegalStateException("a panel with id '" + panel.id() + "' is already registered");
        }
        if (byPath.containsKey(panel.path())) {
            throw new IllegalStateException(
                    "a panel with path '" + panel.path() + "' is already registered");
        }
        if (panel.isDefault() && defaultPanel != null) {
            throw new IllegalStateException(
                    "panel '" + panel.id() + "' cannot be default: '" + defaultPanel.id()
                            + "' already is");
        }
        byId.put(panel.id(), panel);
        byPath.put(panel.path(), panel);
        if (panel.isDefault()) {
            defaultPanel = panel;
        }
        return this;
    }

    /**
     * @param id the panel id
     * @return the panel with that id, or empty
     */
    public Optional<Panel> get(String id) {
        return Optional.ofNullable(byId.get(Objects.requireNonNull(id, "id")));
    }

    /**
     * Resolves the default panel. If exactly one panel is registered it is the default even without
     * an explicit {@link Panel#makeDefault()}; otherwise an explicit default is required.
     *
     * @return the default panel
     * @throws IllegalStateException if none is registered, or several are without one marked default
     */
    public Panel getDefault() {
        if (defaultPanel != null) {
            return defaultPanel;
        }
        if (byId.isEmpty()) {
            throw new IllegalStateException("no panel is registered");
        }
        if (byId.size() == 1) {
            return byId.values().iterator().next();
        }
        throw new IllegalStateException(
                "several panels are registered but none is marked default; call makeDefault() on one");
    }

    /**
     * Resolves the panel that owns a request path by matching its route prefix
     * ({@code /<path>/...}). The longest matching prefix wins, so a panel at {@code "admin/users"}
     * is preferred over one at {@code "admin"} for {@code /admin/users/1}.
     *
     * @param requestPath the request path (for example {@code "/admin/listings"})
     * @return the owning panel, or empty if no panel's prefix matches
     */
    public Optional<Panel> resolveForPath(String requestPath) {
        Objects.requireNonNull(requestPath, "requestPath");
        String normalized = requestPath.startsWith("/") ? requestPath.substring(1) : requestPath;
        Panel best = null;
        int bestLen = -1;
        for (Panel panel : byPath.values()) {
            String prefix = panel.path();
            if ((normalized.equals(prefix) || normalized.startsWith(prefix + "/"))
                    && prefix.length() > bestLen) {
                best = panel;
                bestLen = prefix.length();
            }
        }
        return Optional.ofNullable(best);
    }

    /**
     * @return all registered panels, in registration order, as an unmodifiable snapshot
     */
    public Collection<Panel> panels() {
        return Collections.unmodifiableCollection(byId.values());
    }
}
