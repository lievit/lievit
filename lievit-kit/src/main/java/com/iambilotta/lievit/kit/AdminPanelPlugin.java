/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

/**
 * The third-party extension point of the admin layer: the same {@code getId / register / boot} shape
 * Filament's {@code Plugin} uses (filament-internals.md "this is the right size").
 *
 * <p>A plugin gets the {@link AdminPanel} at register and boot time and may add resources, pages,
 * render hooks, or navigation. {@link #register(AdminPanel)} runs while the panel is being assembled;
 * {@link #boot(AdminPanel)} runs once the panel is fully assembled (so a plugin can react to what
 * other plugins registered). This is the clean extension path for library authors, in place of
 * Filament's {@code Macroable} which bypasses type safety.
 */
public interface AdminPanelPlugin {

    /**
     * @return the stable, unique plugin id (used to look the plugin up on the panel)
     */
    String getId();

    /**
     * Registers the plugin's contributions while the panel is being assembled.
     *
     * @param panel the panel being assembled
     */
    void register(AdminPanel panel);

    /**
     * Runs once the panel is fully assembled. Default no-op: most plugins only need
     * {@link #register(AdminPanel)}.
     *
     * @param panel the assembled panel
     */
    default void boot(AdminPanel panel) {}
}
