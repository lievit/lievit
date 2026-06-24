/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.ui.jtemodels;

import static org.junit.jupiter.api.Assertions.assertTrue;

import gg.jte.Content;
import gg.jte.generated.precompiled.StaticTemplates;
import gg.jte.generated.precompiled.Templates;
import gg.jte.models.runtime.JteModel;
import org.junit.jupiter.api.Test;

/**
 * Proves the jte-models typed facade for the lievit-ui registry partials is real and usable.
 *
 * <p>This is the compile-checked half of the harness. The {@code generate} goal (configured in
 * this project's pom with {@code gg.jte.models.generator.ModelExtension}) emits {@code
 * gg.jte.generated.precompiled.Templates} -- a typed interface with one method per registry
 * partial, each parameter list derived from the partial's {@code @param} signature -- plus the
 * {@link StaticTemplates} (precompiled, production) implementation. Every call below is checked by
 * javac against those generated signatures, so this test will NOT compile if a partial's {@code
 * @param} contract drifts from what an adopter codes against. That is the whole point: the
 * vitest golden suite asserts on partial SOURCE TEXT, this asserts on the TYPED API a Java
 * adopter actually consumes.
 *
 * <p>An adopter consumes exactly this facade: they copy the partials into their own {@code
 * src/main/jte}, run the same plugin block (see README.md), and their IDE indexes {@code
 * Templates} from the jar -- {@code templates.lievitButton(..)} autocompletes and compile-checks, the
 * "javadoc-equivalent" for the components.
 */
class TypedFacadeTest {

    /** Production path: the precompiled facade backed by the generated template classes. */
    private final Templates templates = new StaticTemplates();

    /**
     * @spec.given the typed Templates facade for the lievit-ui registry partials
     * @spec.when  a button is resolved through the typed {@code button(..)} method and rendered
     * @spec.then  the call compiles against the generated signature and renders the button markup
     */
    @Test
    void resolves_a_button_through_the_typed_facade() {
        // The button's label is a Content slot; a lambda is the JTE-canonical way to pass one.
        Content label = output -> output.writeContent("Save");

        JteModel model =
                templates.lievitButton(
                        "primary", // variant
                        "md", // size
                        false, // iconOnly
                        "button", // type
                        null, // href
                        false, // disabled
                        null, // ariaLabel
                        false, // loading
                        "", // cssClass
                        "", // attrs (trusted static)
                        java.util.Map.of(), // dataAttrs (safe dynamic)
                        null, // wireClick (safe wire action name)
                        java.util.Map.of(), // wireArgs (escaped per-row args)
                        label // content
                        );

        String html = model.render();

        assertTrue(
                html.contains("data-slot=\"button\""),
                () -> "expected the button markup, got: " + html);
        assertTrue(html.contains("Save"), () -> "expected the button label, got: " + html);
    }

    /**
     * @spec.given the typed Templates facade for the lievit-ui registry partials
     * @spec.when  a status badge is resolved through the typed {@code badge(..)} method and rendered
     * @spec.then  the call compiles against the generated signature and renders the status pill
     */
    @Test
    void resolves_a_badge_through_the_typed_facade() {
        String html =
                templates
                        .lievitBadge(
                                "success", // variant
                                "Attivo", // label
                                false, // dot
                                null, // leading
                                null, // content
                                null, // href
                                "md", // size
                                "", // cssClass
                                "", // attrs
                                java.util.Map.of() // dataAttrs
                                )
                        .render();

        assertTrue(html.contains("lv-badge"), () -> "expected the badge markup, got: " + html);
        assertTrue(html.contains("Attivo"), () -> "expected the badge label, got: " + html);
    }

    /**
     * @spec.given the typed Templates facade for the lievit-ui registry partials
     * @spec.when  a removable chip is resolved through the typed {@code chip(..)} method and rendered
     * @spec.then  the call compiles against the generated signature and renders the chip markup
     */
    @Test
    void resolves_a_chip_through_the_typed_facade() {
        String html =
                templates
                        .lievitChip(
                                "neutral", // variant
                                "Roma", // label
                                null, // leading
                                null, // content
                                "/filters/clear", // removeHref
                                "Remove Roma", // removeLabel
                                "md", // size
                                "", // cssClass
                                "", // attrs
                                java.util.Map.of() // dataAttrs
                                )
                        .render();

        assertTrue(html.contains("lv-chip"), () -> "expected the chip markup, got: " + html);
    }
}
