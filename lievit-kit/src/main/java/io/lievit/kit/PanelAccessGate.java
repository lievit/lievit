/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import org.jspecify.annotations.Nullable;

/**
 * The panel-access gate (the Filament {@code canAccessPanel} / {@code FilamentUser} contract,
 * mapped to a functional seam): decides whether a given principal may reach a {@link Panel} at all,
 * before any per-resource authorization runs. A self-serve customer portal and an internal admin
 * panel in the same app gate access differently; this is where that decision lives.
 *
 * <p>The default {@link #permitAll()} lets anyone in (so the skeleton runs); a real deployment
 * supplies a gate bound to the host's authorization. Filament's posture is default-deny outside
 * dev; an adopter encodes that by replacing the default with a deny-by-default gate.
 */
@FunctionalInterface
public interface PanelAccessGate {

    /**
     * @param principal the authenticated principal, or {@code null} if anonymous
     * @return {@code true} to admit the principal to the panel
     */
    boolean canAccess(@Nullable Object principal);

    /**
     * @return a gate that admits everyone (the v0.1 default)
     */
    static PanelAccessGate permitAll() {
        return principal -> true;
    }

    /**
     * @return a gate that admits only an authenticated (non-null) principal
     */
    static PanelAccessGate authenticated() {
        return principal -> principal != null;
    }
}
