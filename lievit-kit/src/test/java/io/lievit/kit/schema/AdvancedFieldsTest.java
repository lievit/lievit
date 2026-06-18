/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import io.lievit.kit.SelectOption;
import io.lievit.kit.support.EvaluationContext;
import io.lievit.kit.support.EvaluationContext.Operation;

/**
 * Specifies the P1 field palette beyond the spine: KeyValue (ordered map), RichEditor /
 * MarkdownEditor (content + toolbar), the specialized inputs (DateTime/Time/Color/Tags/Slider/
 * ToggleButtons/Hidden/OneTimeCode), and the TextInput affix/mask/length extensions. Each binds a
 * state path, round-trips through its cast, and enforces its rules.
 */
class AdvancedFieldsTest {

    private static EvaluationContext ctx(Map<String, Object> state) {
        return EvaluationContext.readOnly(null, null, Operation.CREATE, state);
    }

    // ── KeyValue ───────────────────────────────────────────────────────────────

    /**
     * @spec.given a KeyValue with custom labels
     * @spec.when  a raw map is read back and the labels are inspected
     * @spec.then  the ordered map round-trips and the custom labels are exposed
     */
    @Test
    void key_value_binds_an_ordered_string_map() {
        KeyValue field =
                KeyValue.make("meta")
                        .keyLabel("Attribute")
                        .valueLabel("Setting")
                        .addActionLabel("Add attribute")
                        .reorderable();

        assertThat(field.keyLabel()).isEqualTo("Attribute");
        assertThat(field.valueLabel()).isEqualTo("Setting");
        assertThat(field.addActionLabel()).isEqualTo("Add attribute");
        assertThat(field.isReorderable()).isTrue();

        Map<String, Object> raw = new java.util.LinkedHashMap<>();
        raw.put("color", "blue");
        raw.put("size", "L");
        Map<String, String> read = field.read(SchemaState.of(Map.of("meta", raw)));
        assertThat(read).containsExactly(Map.entry("color", "blue"), Map.entry("size", "L"));
    }

    /**
     * @spec.given a KeyValue holding a map
     * @spec.when  the field dehydrates through a form
     * @spec.then  an ordered key->value map persists at the field path
     */
    @Test
    void key_value_dehydrates_an_ordered_map() {
        SchemaForm form = SchemaForm.create().components(KeyValue.make("meta"));
        Map<String, Object> raw = new java.util.LinkedHashMap<>();
        raw.put("a", "1");
        SchemaState state = SchemaState.of(Map.of("meta", raw));

        assertThat(form.dehydrate(state)).containsKey("meta");
    }

    // ── RichEditor / MarkdownEditor ──────────────────────────────────────────────

    /**
     * @spec.given a RichEditor with two toolbar buttons disabled
     * @spec.when  the toolbar and attachments are configured
     * @spec.then  the default toolbar minus the disabled buttons remains and attachments wire a disk
     */
    @Test
    void rich_editor_configures_toolbar_and_attachments() {
        RichEditor field =
                RichEditor.make("body")
                        .disableToolbarButtons(List.of("codeBlock", "blockquote"))
                        .fileAttachmentsDisk("media");

        assertThat(field.toolbarButtons()).contains("bold").doesNotContain("codeBlock", "blockquote");
        assertThat(field.hasFileAttachments()).isTrue();
        assertThat(field.fileAttachmentsDisk()).isEqualTo("media");
    }

    /**
     * @spec.given a MarkdownEditor with a replaced toolbar and preview disabled
     * @spec.when  its accessors are read
     * @spec.then  the toolbar is exactly the replacement and preview is off
     */
    @Test
    void markdown_editor_replaces_toolbar_and_toggles_preview() {
        MarkdownEditor field =
                MarkdownEditor.make("notes").toolbarButtons(List.of("bold", "italic")).disablePreview();

        assertThat(field.toolbarButtons()).containsExactly("bold", "italic");
        assertThat(field.isPreviewable()).isFalse();
    }

    // ── DateTime / Time pickers ───────────────────────────────────────────────────

    /**
     * @spec.given a DateTimePicker with min/max bounds and a step
     * @spec.when  a raw ISO datetime is read back
     * @spec.then  the datetime cast hydrates it and the bounds are exposed
     */
    @Test
    void date_time_picker_binds_a_local_date_time() {
        DateTimePicker field =
                DateTimePicker.make("starts_at")
                        .minDate(LocalDateTime.parse("2026-01-01T00:00"))
                        .maxDate(LocalDateTime.parse("2026-12-31T23:59"))
                        .step(15)
                        .twelveHour();

        assertThat(field.step()).isEqualTo(15);
        assertThat(field.isTwentyFourHour()).isFalse();
        assertThat(field.read(SchemaState.of(Map.of("starts_at", "2026-06-15T14:30"))))
                .isEqualTo(LocalDateTime.parse("2026-06-15T14:30"));
    }

    /**
     * @spec.given a TimePicker
     * @spec.when  a raw ISO time is read back
     * @spec.then  the time cast hydrates it to a LocalTime
     */
    @Test
    void time_picker_binds_a_local_time() {
        TimePicker field = TimePicker.make("opens_at").minTime(LocalTime.parse("08:00"));

        assertThat(field.read(SchemaState.of(Map.of("opens_at", "09:30"))))
                .isEqualTo(LocalTime.parse("09:30"));
    }

    // ── ColorPicker ───────────────────────────────────────────────────────────────

    /**
     * @spec.given a hex ColorPicker
     * @spec.when  a malformed then a well-formed hex value is validated
     * @spec.then  the format rule rejects the bad value and accepts the good one
     */
    @Test
    void color_picker_validates_its_format() {
        ColorPicker field = ColorPicker.make("brand");

        assertThat(field.validate(SchemaState.of(Map.of("brand", "blue")), ctx(Map.of()))).isPresent();
        assertThat(field.validate(SchemaState.of(Map.of("brand", "#1d4ed8")), ctx(Map.of()))).isEmpty();
    }

    /**
     * @spec.given a ColorPicker switched to rgb format after make
     * @spec.when  an rgb value is validated
     * @spec.then  the dynamic format rule accepts it (no stale hex rule remains)
     */
    @Test
    void color_picker_format_switch_does_not_leave_a_stale_rule() {
        ColorPicker field = ColorPicker.make("brand").rgb();

        assertThat(field.format()).isEqualTo(ColorPicker.Format.RGB);
        assertThat(field.validate(SchemaState.of(Map.of("brand", "rgb(1,2,3)")), ctx(Map.of()))).isEmpty();
    }

    // ── TagsInput ─────────────────────────────────────────────────────────────────

    /**
     * @spec.given a TagsInput with suggestions and a separator
     * @spec.when  a comma-joined wire value is read back
     * @spec.then  the multi-value cast hydrates it to a list and the config is exposed
     */
    @Test
    void tags_input_binds_a_string_array() {
        TagsInput field =
                TagsInput.make("tags").suggestions(List.of("java", "spring")).separator(",");

        assertThat(field.suggestions()).containsExactly("java", "spring");
        assertThat(field.separator()).isEqualTo(",");
        assertThat(field.read(SchemaState.of(Map.of("tags", "a,b,c")))).containsExactly("a", "b", "c");
    }

    // ── Slider ────────────────────────────────────────────────────────────────────

    /**
     * @spec.given a Slider over [10, 20]
     * @spec.when  an out-of-range then an in-range value is validated
     * @spec.then  the range adds server-side min/max validation and the number cast hydrates a Long
     */
    @Test
    void slider_enforces_its_range_server_side() {
        Slider field = Slider.make("volume").range(10, 20).step(2);

        assertThat(field.read(SchemaState.of(Map.of("volume", "12")))).isEqualTo(12L);
        assertThat(field.validate(SchemaState.of(Map.of("volume", "5")), ctx(Map.of()))).isPresent();
        assertThat(field.validate(SchemaState.of(Map.of("volume", "15")), ctx(Map.of()))).isEmpty();
    }

    // ── ToggleButtons ─────────────────────────────────────────────────────────────

    /**
     * @spec.given a multiple, grouped ToggleButtons
     * @spec.when  a comma-joined value is read back
     * @spec.then  the multi cast hydrates a list and the layout flags are exposed
     */
    @Test
    void toggle_buttons_supports_multiple_segmented_choice() {
        ToggleButtons field =
                ToggleButtons.make("days")
                        .multiple()
                        .grouped()
                        .options(List.of(SelectOption.of("mon", "Mon"), SelectOption.of("tue", "Tue")));

        assertThat(field.isMultiple()).isTrue();
        assertThat(field.isGrouped()).isTrue();
        assertThat(field.read(SchemaState.of(Map.of("days", "mon,tue")))).isEqualTo(List.of("mon", "tue"));
    }

    // ── Hidden ────────────────────────────────────────────────────────────────────

    /**
     * @spec.given a Hidden field
     * @spec.when  the form dehydrates while the field is not visible
     * @spec.then  the value still persists (dehydratedWhenHidden), unlike a plain hidden input
     */
    @Test
    void hidden_field_still_persists_its_value() {
        Hidden field = Hidden.make("token");

        assertThat(field.isDehydrated(ctx(Map.of()))).isTrue();
        SchemaForm form = SchemaForm.create().components(field);
        assertThat(form.dehydrate(SchemaState.of(Map.of("token", "abc")))).containsEntry("token", "abc");
    }

    // ── OneTimeCodeInput ──────────────────────────────────────────────────────────

    /**
     * @spec.given a default 6-digit OneTimeCodeInput
     * @spec.when  a wrong-length, a non-digit, and a valid code are validated
     * @spec.then  length and digits-only rules fire as expected
     */
    @Test
    void one_time_code_enforces_length_and_digits() {
        OneTimeCodeInput field = OneTimeCodeInput.make("otp");

        assertThat(field.length()).isEqualTo(6);
        assertThat(field.validate(SchemaState.of(Map.of("otp", "123")), ctx(Map.of()))).isPresent();
        assertThat(field.validate(SchemaState.of(Map.of("otp", "12345x")), ctx(Map.of()))).isPresent();
        assertThat(field.validate(SchemaState.of(Map.of("otp", "123456")), ctx(Map.of()))).isEmpty();
    }

    // ── TextInput affix/mask/length extensions ────────────────────────────────────

    /**
     * @spec.given a TextInput with a mask, minLength, datalist, and icon affixes
     * @spec.when  its accessors are read and a too-short value is validated
     * @spec.then  the extensions are carried and minLength enforces the lower bound
     */
    @Test
    void text_input_carries_mask_length_and_icon_affixes() {
        TextInput field =
                TextInput.make("vat")
                        .mask("99.999.999")
                        .minLength(5)
                        .prefixIcon("hash")
                        .datalist(List.of("IT", "FR"))
                        .autocomplete("off");

        assertThat(field.mask()).isEqualTo("99.999.999");
        assertThat(field.minLength()).isEqualTo(5);
        assertThat(field.prefixIcon()).isEqualTo("hash");
        assertThat(field.datalist()).containsExactly("IT", "FR");
        assertThat(field.autocomplete()).isEqualTo("off");
        assertThat(field.validate(SchemaState.of(Map.of("vat", "ab")), ctx(Map.of()))).isPresent();
    }

    /**
     * @spec.given a revealable password TextInput
     * @spec.when  the reveal and type are read
     * @spec.then  the password type and reveal toggle are set
     */
    @Test
    void text_input_password_is_revealable() {
        TextInput field = TextInput.make("password").password().revealable();

        assertThat(field.type()).isEqualTo(TextInput.Type.PASSWORD);
        assertThat(field.isRevealable()).isTrue();
    }
}
