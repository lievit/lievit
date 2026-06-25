/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The forms / schemas engine of lievit-kit (the filament v4 unified {@code schemas} package carried
 * over): the data-authoring surface, built on the {@link dev.lievit.kit.support} foundations.
 *
 * <p><strong>The state engine</strong> is the core every component sits on:
 * {@link dev.lievit.kit.schema.SchemaState} is the path-addressable (dot-path, nested into repeaters)
 * state; {@link dev.lievit.kit.schema.StateCast} (+ {@link dev.lievit.kit.schema.StateCasts}) are the
 * typed boundary conversions applied on hydrate/dehydrate;
 * {@link dev.lievit.kit.schema.SchemaComponent} is the shared base carrying statePath, casts,
 * defaults, conditional visibility/disabling (over the closure engine), the reactivity hooks
 * ({@code afterStateUpdated}/{@code afterStateHydrated}/{@code beforeStateDehydrated}, the
 * {@link dev.lievit.kit.schema.LiveMode} binding modifiers), and the dehydration flags;
 * {@link dev.lievit.kit.schema.MutableEvaluationContext} is the writable context the
 * {@code afterStateUpdated} hooks mutate siblings through.
 * {@link dev.lievit.kit.schema.SchemaForm} is the top-level engine that ties a component tree to a
 * state and drives hydrate / validate / dehydrate across nested containers as one whole.
 *
 * <p><strong>Layout</strong>: {@link dev.lievit.kit.schema.Layout} (the container base),
 * {@link dev.lievit.kit.schema.Section}, {@link dev.lievit.kit.schema.Grid},
 * {@link dev.lievit.kit.schema.Fieldset}, {@link dev.lievit.kit.schema.Flex},
 * {@link dev.lievit.kit.schema.Tabs}, {@link dev.lievit.kit.schema.Wizard} (with a per-step validation
 * gate).
 *
 * <p><strong>Fields</strong>: {@link dev.lievit.kit.schema.SchemaField} (the input base: label,
 * helper-text/hint/affixes, rule set), {@link dev.lievit.kit.schema.TextInput} (type / length / mask
 * / datalist / revealable / icon affixes), {@link dev.lievit.kit.schema.Textarea} (rows / autosize /
 * readOnly / length / trim), {@link dev.lievit.kit.schema.Checkbox} (inline / accepted / declined),
 * {@link dev.lievit.kit.schema.Toggle} (boolean switch: on/off icon + color, accepted / declined),
 * {@link dev.lievit.kit.schema.Radio}, {@link dev.lievit.kit.schema.CheckboxList},
 * {@link dev.lievit.kit.schema.Select} (searchable / multiple / reactive options / disableOptionWhen),
 * {@link dev.lievit.kit.schema.FileUpload}, {@link dev.lievit.kit.schema.KeyValue} (ordered map),
 * {@link dev.lievit.kit.schema.Repeater} (a repeated sub-schema with indexed per-item validation),
 * {@link dev.lievit.kit.schema.RichEditor} / {@link dev.lievit.kit.schema.MarkdownEditor}, and the
 * specialized inputs {@link dev.lievit.kit.schema.DateTimePicker},
 * {@link dev.lievit.kit.schema.TimePicker}, {@link dev.lievit.kit.schema.ColorPicker},
 * {@link dev.lievit.kit.schema.TagsInput}, {@link dev.lievit.kit.schema.Slider},
 * {@link dev.lievit.kit.schema.ToggleButtons}, {@link dev.lievit.kit.schema.Hidden},
 * {@link dev.lievit.kit.schema.OneTimeCodeInput}.
 *
 * <p><strong>Static display</strong> (non-input, never dehydrated, never validated):
 * {@link dev.lievit.kit.schema.Placeholder} (computed read-only value),
 * {@link dev.lievit.kit.schema.Text}, {@link dev.lievit.kit.schema.Html},
 * {@link dev.lievit.kit.schema.Callout}.
 *
 * <p><strong>Infolists</strong>: the read-only View-page surface lives in the
 * {@link dev.lievit.kit.schema.infolist} subpackage.
 *
 * <p><strong>Validation</strong>: {@link dev.lievit.kit.schema.Rule} +
 * {@link dev.lievit.kit.schema.Rules} (the {@code CanBeValidated} surface decomposed: the conditional
 * {@code requiredIf} family, cross-field comparisons, {@code unique}-ignores-current-record-on-edit,
 * the custom-rule escape hatch) collected into a {@link dev.lievit.kit.schema.RuleSet} per field
 * (with {@code mutateStateForValidation} and a custom validation attribute).
 */
@NullMarked
package dev.lievit.kit.schema;

import org.jspecify.annotations.NullMarked;
