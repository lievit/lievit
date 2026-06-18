/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The design-system component view-models (the kit-level seam for issue #317): the shared rendering
 * layer every action, notification, action group, and widget resolves its button / icon-button /
 * badge / link / dropdown / modal / section markup through, so each surface does not re-derive the
 * same color + icon + size classes inconsistently. This is the JTE-idiom equivalent of Filament's
 * {@code support} Blade components.
 *
 * <p>A view-model is a small builder that carries the component's intent (label, color name, size,
 * icon alias, the modal close flags) and resolves it to the stable CSS classes + icon names a JTE
 * partial emits, through the {@link io.lievit.kit.support.ColorManager} and {@link
 * io.lievit.kit.support.IconManager}. It deliberately stops at the seam: it does not own the JTE
 * markup or rewrite the lievit-ui components, it gives the kit's surfaces one composable place to ask
 * "what classes does a primary large button get?". {@link io.lievit.kit.component.ComponentViews}
 * dogfoods it by rendering an {@link io.lievit.kit.AdminAction} and an {@link
 * io.lievit.kit.AdminNotification} through these views.
 */
@org.jspecify.annotations.NullMarked
package io.lievit.kit.component;
