/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;

import io.lievit.kit.Color;
import io.lievit.kit.support.EvaluationContext;
import io.lievit.kit.support.EvaluationContext.Operation;

/**
 * Specifies the non-input display components (the filament-schemas Placeholder / Text / Html /
 * Callout): they render content (constant or computed from the live state) but bind no state path,
 * never dehydrate, and never validate, so they are transparent passengers in the engine.
 */
class StaticDisplayComponentsTest {

    private static EvaluationContext ctx(Map<String, Object> state) {
        return EvaluationContext.readOnly(null, null, Operation.CREATE, state);
    }

    /**
     * @spec.given a Placeholder whose content is computed from a sibling field
     * @spec.when  the content is resolved against the live state
     * @spec.then  it reads the sibling, binds no state path, and is not dehydrated
     */
    @Test
    void placeholder_renders_computed_content_and_never_dehydrates() {
        Placeholder placeholder =
                Placeholder.make("Total").content(c -> "EUR " + c.getString("amount"));

        assertThat(placeholder.label()).isEqualTo("Total");
        assertThat(placeholder.statePath()).isNull();
        assertThat(placeholder.resolveContent(ctx(Map.of("amount", "42")))).isEqualTo("EUR 42");
        assertThat(placeholder.isDehydrated(ctx(Map.of()))).isFalse();
    }

    /**
     * @spec.given a Placeholder with constant content
     * @spec.when  the content is resolved
     * @spec.then  the constant is returned regardless of state
     */
    @Test
    void placeholder_supports_constant_content() {
        Placeholder placeholder = Placeholder.make("Note").content("read only");

        assertThat(placeholder.resolveContent(ctx(Map.of()))).isEqualTo("read only");
    }

    /**
     * @spec.given a Text run with a weight and color
     * @spec.when  its accessors are read
     * @spec.then  it carries the literal content, weight, and color and never dehydrates
     */
    @Test
    void text_carries_literal_content_with_emphasis() {
        Text text = Text.make("Heads up").weight(Text.Weight.BOLD).color(Color.WARNING);

        assertThat(text.content()).isEqualTo("Heads up");
        assertThat(text.weight()).isEqualTo(Text.Weight.BOLD);
        assertThat(text.color()).isEqualTo(Color.WARNING);
        assertThat(text.isDehydrated(ctx(Map.of()))).isFalse();
    }

    /**
     * @spec.given an Html fragment
     * @spec.when  its markup is read
     * @spec.then  the trusted markup is carried verbatim and never dehydrates
     */
    @Test
    void html_carries_trusted_markup_verbatim() {
        Html html = Html.make("<strong>x</strong>");

        assertThat(html.markup()).isEqualTo("<strong>x</strong>");
        assertThat(html.isDehydrated(ctx(Map.of()))).isFalse();
    }

    /**
     * @spec.given a Callout with a body, icon, and danger color
     * @spec.when  its accessors are read
     * @spec.then  it carries the heading/body/icon/color and never dehydrates
     */
    @Test
    void callout_carries_a_colored_boxed_message() {
        Callout callout =
                Callout.make("Careful").body("This cannot be undone.").icon("warning").color(Color.DANGER);

        assertThat(callout.heading()).isEqualTo("Careful");
        assertThat(callout.body()).isEqualTo("This cannot be undone.");
        assertThat(callout.icon()).isEqualTo("warning");
        assertThat(callout.color()).isEqualTo(Color.DANGER);
        assertThat(callout.isDehydrated(ctx(Map.of()))).isFalse();
    }

    /**
     * @spec.given a SchemaForm mixing inputs with a Placeholder and a Text
     * @spec.when  the form dehydrates
     * @spec.then  only the inputs contribute to the persisted data (display components are omitted)
     */
    @Test
    void display_components_do_not_contribute_to_form_state() {
        SchemaForm form =
                SchemaForm.create()
                        .components(
                                TextInput.make("name"),
                                Placeholder.make("Hint").content("x"),
                                Text.make("note"));
        SchemaState state = SchemaState.of(Map.of("name", "Ada"));

        Map<String, Object> persisted = form.dehydrate(state);

        assertThat(persisted).containsOnlyKeys("name");
    }
}
