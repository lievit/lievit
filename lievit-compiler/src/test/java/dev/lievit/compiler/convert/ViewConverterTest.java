/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.compiler.convert;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Optional;

import org.junit.jupiter.api.Test;

/**
 * Spec for the whole-component source transform {@link ViewConverter} (issue #141, ADR-0072): the
 * facade the CLI {@code convert} command drives. It detects a component's authoring shape from its
 * source, transforms the Java class and the template across the SFC&lt;-&gt;MFC boundary through the
 * neutral {@link ViewNode} AST, and reports warn-and-skip notes. The two directions are exact
 * inverses on a faithful component, so a double-convert is idempotent (the round-trip property the
 * issue requires).
 */
class ViewConverterTest {

    private final ViewConverter converter = new ViewConverter();

    private static final String SFC =
            """
            package com.example.app;

            import static dev.lievit.dsl.H.*;

            import dev.lievit.LievitAction;
            import dev.lievit.LievitComponent;
            import dev.lievit.LievitRender;
            import dev.lievit.Wire;
            import dev.lievit.dsl.Html;

            @LievitComponent
            public class Counter {

                @Wire int count;

                @LievitAction
                void increment() {
                    count++;
                }

                @LievitRender
                Html view() {
                    return div(
                            button(text("-")).wireClick("decrement"),
                            span(text(count)),
                            button(text("+")).wireClick("increment"));
                }
            }
            """;

    /**
     * @spec.given a single-file Counter (no template, an @LievitRender returning Html with the DSL)
     * @spec.when  it is converted to multi-file
     * @spec.then  the class gains template="counter", loses the render method and the DSL imports, and
     *     a JTE template is produced with a @param header derived from the @Wire fields and the wired
     *     markup, faithfully (no warnings)
     * @spec.adr   ADR-0072
     */
    @Test
    void converts_single_file_to_multi_file() {
        ConvertResult result = converter.toMultiFile(SFC, "Counter");

        assertThat(result.isFaithful()).isTrue();
        assertThat(result.classSource()).contains("@LievitComponent(template = \"counter\")");
        assertThat(result.classSource()).doesNotContain("@LievitRender");
        assertThat(result.classSource()).doesNotContain("import static dev.lievit.dsl.H");
        assertThat(result.classSource()).doesNotContain("dev.lievit.dsl.Html");
        // the action and field survive untouched
        assertThat(result.classSource()).contains("void increment()");
        assertThat(result.classSource()).contains("@Wire int count;");
        // no dangling whitespace-only line and no triple blank line left by the method removal
        assertThat(result.classSource()).doesNotContain("\n    \n");
        assertThat(result.classSource()).doesNotContain("\n\n\n");
        Optional<String> template = result.template();
        assertThat(template).isPresent();
        assertThat(template.orElseThrow()).contains("@param int count");
        assertThat(template.orElseThrow()).contains("l:click=\"increment\"");
        assertThat(template.orElseThrow()).contains("${count}");
    }

    /**
     * @spec.given the multi-file Counter produced by the forward convert, plus its template
     * @spec.when  it is converted back to single-file
     * @spec.then  the class regains the @LievitRender Html view() returning the DSL tree and the DSL
     *     imports, loses the template attribute, and the template is dropped (single-file colocates)
     * @spec.adr   ADR-0072
     */
    @Test
    void converts_multi_file_back_to_single_file() {
        ConvertResult forward = converter.toMultiFile(SFC, "Counter");
        ConvertResult back =
                converter.toSingleFile(forward.classSource(), forward.template().orElseThrow());

        assertThat(back.isFaithful()).isTrue();
        assertThat(back.classSource()).contains("@LievitRender");
        assertThat(back.classSource()).contains("Html view()");
        assertThat(back.classSource()).contains("import static dev.lievit.dsl.H.*;");
        assertThat(back.classSource()).doesNotContain("template =");
        assertThat(back.template()).isEmpty();
    }

    /**
     * @spec.given a single-file Counter
     * @spec.when  it is converted to multi-file and back to single-file
     * @spec.then  the round-trip class re-parses to the same view AST as the original (idempotent)
     * @spec.adr   ADR-0072
     */
    @Test
    void round_trip_is_idempotent_on_the_view() {
        ParsedView original = new DslViewParser().parse(extractRenderExpr(SFC));

        ConvertResult forward = converter.toMultiFile(SFC, "Counter");
        ConvertResult back =
                converter.toSingleFile(forward.classSource(), forward.template().orElseThrow());
        ParsedView roundTripped = new DslViewParser().parse(extractRenderExpr(back.classSource()));

        assertThat(roundTripped.root()).isEqualTo(original.root());
    }

    /**
     * @spec.given the shape of a component source
     * @spec.when  detectShape is asked
     * @spec.then  a no-template @LievitRender-returning-Html class is SINGLE_FILE, a template= class is
     *     MULTI_FILE
     * @spec.adr   ADR-0072
     */
    @Test
    void detects_the_authoring_shape() {
        assertThat(converter.detectShape(SFC)).isEqualTo(ViewConverter.Shape.SINGLE_FILE);
        assertThat(
                        converter.detectShape(
                                "@LievitComponent(template = \"counter\")\npublic class Counter {}"))
                .isEqualTo(ViewConverter.Shape.MULTI_FILE);
    }

    // Test helper: pull the render expression out of a class source for the round-trip assertion.
    private static String extractRenderExpr(String classSource) {
        int ret = classSource.indexOf("return ");
        int semi = classSource.indexOf(';', ret);
        return classSource.substring(ret + "return ".length(), semi);
    }
}
