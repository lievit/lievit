/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;

import dev.lievit.kit.Color;

/**
 * Specifies the boolean Toggle field, the Checkbox accepted/declined consent gates, and the
 * schema-engine Textarea the audit's {@code Toggle}, {@code Checkbox}, and {@code Textarea} rows ask
 * for. Each drives the REAL engine (cast round-trip on hydrate, rule evaluation through
 * {@link SchemaForm#validate}, the trim transform through {@link SchemaForm#dehydrate}) and asserts
 * the resolved behaviour, not the presence of a setter.
 */
class BooleanAndTextareaFieldsTest {

    // ── Toggle ─────────────────────────────────────────────────────────────────

    /**
     * @spec.given a Toggle with on/off icons and colors and a wire "true" value
     * @spec.when  the field hydrates through its boolean cast and its config is read
     * @spec.then  the wire string round-trips to a real boolean and the on/off icon + color carry
     *     (the single boolean Toggle field, distinct from the segmented ToggleButtons)
     */
    @Test
    void toggle_binds_a_boolean_and_carries_on_off_icon_and_color() {
        Toggle field =
                Toggle.make("active")
                        .onIcon("check")
                        .offIcon("x")
                        .onColor(new Color("success"))
                        .offColor(new Color("danger"))
                        .inline();

        assertThat(field.read(SchemaState.of(Map.of("active", "true")))).isTrue();
        assertThat(field.read(SchemaState.of(Map.of("active", "0")))).isFalse();
        assertThat(field.onIcon()).isEqualTo("check");
        assertThat(field.offIcon()).isEqualTo("x");
        assertThat(field.onColor()).isEqualTo(new Color("success"));
        assertThat(field.offColor()).isEqualTo(new Color("danger"));
        assertThat(field.isInline()).isTrue();
    }

    /**
     * @spec.given a Toggle marked accepted() inside a form
     * @spec.when  the form validates with the toggle off then on
     * @spec.then  the consent gate fails while off and passes while on (the filament accepted)
     */
    @Test
    void toggle_accepted_requires_the_switch_on() {
        SchemaForm form = SchemaForm.create().components(Toggle.make("terms").accepted());

        assertThat(form.validate(SchemaState.of(Map.of("terms", "false")))).containsKey("terms");
        assertThat(form.validate(SchemaState.of(Map.of("terms", "true")))).doesNotContainKey("terms");
    }

    /**
     * @spec.given a Toggle marked declined() inside a form
     * @spec.when  the form validates with the toggle on then off
     * @spec.then  the inverse gate fails while on and passes while off (the filament declined)
     */
    @Test
    void toggle_declined_requires_the_switch_off() {
        SchemaForm form = SchemaForm.create().components(Toggle.make("optOut").declined());

        assertThat(form.validate(SchemaState.of(Map.of("optOut", "true")))).containsKey("optOut");
        assertThat(form.validate(SchemaState.of(Map.of("optOut", "false")))).doesNotContainKey("optOut");
    }

    // ── Checkbox accepted / declined / inline ──────────────────────────────────

    /**
     * @spec.given a Checkbox marked accepted() and laid out inline
     * @spec.when  the form validates with the box unticked then ticked
     * @spec.then  the must-agree gate fails while unticked and passes while ticked, and inline carries
     */
    @Test
    void checkbox_accepted_is_the_must_agree_gate() {
        Checkbox box = Checkbox.make("agree").accepted().inline();
        SchemaForm form = SchemaForm.create().components(box);

        assertThat(box.isInline()).isTrue();
        assertThat(form.validate(SchemaState.of(Map.of("agree", "false")))).containsKey("agree");
        assertThat(form.validate(SchemaState.of(Map.of("agree", "true")))).doesNotContainKey("agree");
    }

    // ── Textarea ───────────────────────────────────────────────────────────────

    /**
     * @spec.given a schema-engine Textarea with rows, autosize, readOnly, and length constraints
     * @spec.when  the config is read and a too-short value validates through the form
     * @spec.then  the textarea-specific surface carries and the length rule fires (the schema-engine
     *     Textarea, not the legacy TextareaField outside the engine)
     */
    @Test
    void textarea_carries_rows_autosize_readonly_and_length() {
        Textarea field = Textarea.make("bio").rows(6).autosize().readOnly().minLength(10).maxLength(500);
        SchemaForm form = SchemaForm.create().components(field);

        assertThat(field.rows()).isEqualTo(6);
        assertThat(field.isAutosize()).isTrue();
        assertThat(field.isReadOnly()).isTrue();
        assertThat(form.validate(SchemaState.of(Map.of("bio", "short")))).containsKey("bio");
        assertThat(form.validate(SchemaState.of(Map.of("bio", "a long enough biography"))))
                .doesNotContainKey("bio");
    }

    /**
     * @spec.given a Textarea with trim() inside a form, holding a padded value
     * @spec.when  the form dehydrates through the real engine
     * @spec.then  the PERSISTED value is trimmed (trim is wired through dehydrateStateUsing, so it
     *     changes what is stored, not just the display)
     */
    @Test
    void textarea_trim_normalizes_the_persisted_value() {
        SchemaForm form = SchemaForm.create().components(Textarea.make("note").trim());
        SchemaState state = SchemaState.of(Map.of("note", "  hello world  "));

        Map<String, Object> persisted = form.dehydrate(state);

        assertThat(persisted).containsEntry("note", "hello world");
    }
}
