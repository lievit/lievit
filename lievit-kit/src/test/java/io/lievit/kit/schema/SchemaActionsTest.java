/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * Specifies the schema-embedded actions (#219, the filament-schemas {@code Actions} +
 * {@code HasHeaderActions}/{@code HasFooterActions} + field affix actions): inline action buttons
 * placed inside a form that run a closure over the LIVE state, a section toolbar of header/footer
 * actions, and a clickable action button as a field affix. Built additively on the schema engine:
 * {@link Actions} is a non-input passenger, {@link SchemaAction} runs over the mutable context.
 */
class SchemaActionsTest {

    private static SchemaState state(Map<String, Object> seed) {
        return SchemaState.of(seed);
    }

    /**
     * @spec.given an Actions row with a "Generate" action that writes a sibling field
     * @spec.when  the action runs over the live mutable context
     * @spec.then  the buttons render inline and the closure mutates the sibling field
     */
    @Test
    void actions_render_inline_buttons_and_run_over_the_live_state() {
        SchemaAction generate =
                SchemaAction.make("generate")
                        .label("Generate")
                        .action(ctx -> ctx.set("slug", ctx.getString("title").toLowerCase().replace(' ', '-')));
        Actions row = Actions.make(generate).alignment(Actions.Alignment.END);

        assertThat(row.actions()).extracting(SchemaAction::label).containsExactly("Generate");
        assertThat(row.alignment()).isEqualTo(Actions.Alignment.END);
        // an Actions row is a non-input passenger: it never dehydrates
        assertThat(row.isDehydrated(io.lievit.kit.support.EvaluationContext.of(null))).isFalse();

        SchemaState s = state(new java.util.LinkedHashMap<>(Map.of("title", "Hello World")));
        MutableEvaluationContext mctx =
                MutableEvaluationContext.over(null, null, io.lievit.kit.support.EvaluationContext.Operation.CREATE, s);
        generate.run(mctx);
        assertThat(s.getString("slug")).isEqualTo("hello-world");
    }

    /**
     * @spec.given a disabled schema action
     * @spec.when  it runs over the live context
     * @spec.then  it is a no-op: a disabled action never touches the state
     */
    @Test
    void a_disabled_schema_action_is_a_no_op() {
        boolean[] ran = {false};
        SchemaAction action = SchemaAction.make("x").action(ctx -> ran[0] = true).disabled(true);

        action.run(io.lievit.kit.support.EvaluationContext.of(null));

        assertThat(action.isDisabled()).isTrue();
        assertThat(ran[0]).isFalse();
    }

    /**
     * @spec.given a Section with header and footer actions
     * @spec.when  the section's action toolbars are read
     * @spec.then  the header and footer carry their actions in declaration order
     */
    @Test
    void section_supports_header_and_footer_actions() {
        Section section =
                Section.make("Billing")
                        .headerActions(List.of(SchemaAction.make("sync").label("Sync now")))
                        .footerActions(List.of(SchemaAction.make("export").label("Export")));

        assertThat(section.headerActions()).extracting(SchemaAction::label).containsExactly("Sync now");
        assertThat(section.footerActions()).extracting(SchemaAction::label).containsExactly("Export");
    }

    /**
     * @spec.given a TextInput with a clickable suffix action button
     * @spec.when  the suffix action is read and run over the live context
     * @spec.then  the field carries the affix action and the closure mutates the field state
     */
    @Test
    void field_affix_supports_a_clickable_action_button() {
        TextInput field =
                TextInput.make("password")
                        .suffixAction(
                                SchemaAction.make("generate")
                                        .icon("arrow-path")
                                        .variant(SchemaAction.Variant.ICON_BUTTON)
                                        .action(ctx -> ctx.set("password", "s3cret")));

        assertThat(field.prefixAction()).isNull();
        assertThat(field.suffixAction()).isNotNull();
        assertThat(field.suffixAction().variant()).isEqualTo(SchemaAction.Variant.ICON_BUTTON);

        SchemaState s = state(new java.util.LinkedHashMap<>());
        MutableEvaluationContext mctx =
                MutableEvaluationContext.over(null, null, io.lievit.kit.support.EvaluationContext.Operation.CREATE, s);
        field.suffixAction().run(mctx);
        assertThat(s.getString("password")).isEqualTo("s3cret");
    }
}
