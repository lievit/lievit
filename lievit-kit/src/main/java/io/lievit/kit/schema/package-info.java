/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The forms / schemas engine of lievit-kit (the filament v4 unified {@code schemas} package carried
 * over): the data-authoring surface, built on the {@link io.lievit.kit.support} foundations.
 *
 * <p><strong>The state engine</strong> is the core every component sits on:
 * {@link io.lievit.kit.schema.SchemaState} is the path-addressable (dot-path, nested into repeaters)
 * state; {@link io.lievit.kit.schema.StateCast} (+ {@link io.lievit.kit.schema.StateCasts}) are the
 * typed boundary conversions applied on hydrate/dehydrate;
 * {@link io.lievit.kit.schema.SchemaComponent} is the shared base carrying statePath, casts,
 * defaults, conditional visibility/disabling (over the closure engine), the reactivity hooks
 * ({@code afterStateUpdated}/{@code afterStateHydrated}/{@code beforeStateDehydrated}, the
 * {@link io.lievit.kit.schema.LiveMode} binding modifiers), and the dehydration flags;
 * {@link io.lievit.kit.schema.MutableEvaluationContext} is the writable context the
 * {@code afterStateUpdated} hooks mutate siblings through.
 * {@link io.lievit.kit.schema.SchemaForm} is the top-level engine that ties a component tree to a
 * state and drives hydrate / validate / dehydrate across nested containers as one whole.
 *
 * <p><strong>Layout</strong>: {@link io.lievit.kit.schema.Layout} (the container base),
 * {@link io.lievit.kit.schema.Section}, {@link io.lievit.kit.schema.Grid},
 * {@link io.lievit.kit.schema.Fieldset}, {@link io.lievit.kit.schema.Flex},
 * {@link io.lievit.kit.schema.Tabs}, {@link io.lievit.kit.schema.Wizard} (with a per-step validation
 * gate).
 *
 * <p><strong>Fields</strong>: {@link io.lievit.kit.schema.SchemaField} (the input base: label,
 * helper-text/hint/affixes, rule set), {@link io.lievit.kit.schema.TextInput},
 * {@link io.lievit.kit.schema.Checkbox}, {@link io.lievit.kit.schema.Radio},
 * {@link io.lievit.kit.schema.CheckboxList}, {@link io.lievit.kit.schema.Select} (searchable /
 * multiple / reactive options), {@link io.lievit.kit.schema.FileUpload}.
 *
 * <p><strong>Validation</strong>: {@link io.lievit.kit.schema.Rule} +
 * {@link io.lievit.kit.schema.Rules} (the {@code CanBeValidated} surface decomposed: the conditional
 * {@code requiredIf} family, cross-field comparisons, {@code unique}-ignores-current-record-on-edit,
 * the custom-rule escape hatch) collected into a {@link io.lievit.kit.schema.RuleSet} per field
 * (with {@code mutateStateForValidation} and a custom validation attribute).
 */
@NullMarked
package io.lievit.kit.schema;

import org.jspecify.annotations.NullMarked;
