/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Schema-driven settings pages (the Filament {@code spatie/laravel-settings} settings page, mapped
 * onto the kit's own {@link io.lievit.kit.schema schema engine} rather than a Spatie port).
 *
 * <p>A {@link io.lievit.kit.settings.SettingsPage} is a first-class page (parallel to a {@code
 * WidgetPage}) whose form is a {@link io.lievit.kit.schema.SchemaForm}: it hydrates the form from a
 * {@link io.lievit.kit.settings.SettingsStore}, validates the submitted state through the schema, and
 * persists the dehydrated values back to the store. The store is the persistence-agnostic port
 * (default {@link io.lievit.kit.settings.InMemorySettingsStore}); an adopter wires a JDBC- or
 * property-backed store.
 *
 * <p>This is the same hydrate → validate → dehydrate lifecycle the resource forms use, so settings
 * reuse the whole field palette (text, select, toggle, ...) for free.
 */
@NullMarked
package io.lievit.kit.settings;

import org.jspecify.annotations.NullMarked;
