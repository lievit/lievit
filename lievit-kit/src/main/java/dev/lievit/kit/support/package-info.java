/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The cross-cutting support engine of lievit-kit (the filament {@code support} package carried
 * over): the foundations the rest of the kit sits on, decided once here so no feature reinvents
 * them.
 *
 * <ul>
 *   <li><strong>closure-injection</strong>: {@link dev.lievit.kit.support.ValueOrClosure} +
 *       {@link dev.lievit.kit.support.EvaluationContext} are the typed-context replacement for
 *       Filament's reflective {@code EvaluatesClosures}: every "a value OR a closure" setter resolves
 *       through one code path, the closure reading the live form state by named accessor.
 *   <li><strong>icon registry</strong>: {@link dev.lievit.kit.support.IconManager} maps semantic
 *       aliases ({@code actions.delete}) to Heroicon names, app-overridable.
 *   <li><strong>color system</strong>: {@link dev.lievit.kit.support.ColorManager} +
 *       {@link dev.lievit.kit.support.Color} bind semantic names ({@code primary}, {@code danger}) to
 *       shade ramps and emit the stable name-to-CSS-class mapping.
 *   <li><strong>shared enums</strong>: {@link dev.lievit.kit.support.Size},
 *       {@link dev.lievit.kit.support.Width}, {@link dev.lievit.kit.support.Alignment},
 *       {@link dev.lievit.kit.support.IconPosition}: one CSS token vocabulary across components.
 *   <li><strong>asset pipeline</strong>: {@link dev.lievit.kit.support.AssetManager} +
 *       {@link dev.lievit.kit.support.Asset} ({@link dev.lievit.kit.support.Css},
 *       {@link dev.lievit.kit.support.Js}, {@link dev.lievit.kit.support.Font},
 *       {@link dev.lievit.kit.support.Theme}): package-scoped, versioned (content-hash) CSS/JS/font
 *       registration with theme-replaces-core semantics and boot script-data / CSS-variable
 *       injection.
 *   <li><strong>component configuration</strong>:
 *       {@link dev.lievit.kit.support.ComponentConfiguration} is the {@code configureUsing} global
 *       defaults manager (subclass-inherited, important tier, scoped {@code during}).
 * </ul>
 */
@NullMarked
package dev.lievit.kit.support;

import org.jspecify.annotations.NullMarked;
