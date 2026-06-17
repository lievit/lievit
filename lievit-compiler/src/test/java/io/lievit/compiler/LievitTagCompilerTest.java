/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.compiler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/**
 * Spec for the {@code <lievit:...>} tag compiler (ADR-0023, issue #175): a tag is parsed into a
 * {@link CompiledTag} mount declaration with the component name (kebab tag), bound ({@code :attr})
 * vs literal attributes, attribute-name kebab->camel, the explicit key ({@code wire:key} /
 * {@code l:key} / {@code key}), the reserved params ({@code lazy}, {@code defer}, {@code wire:ref}),
 * the dynamic-component form ({@code :is}), and the {@code <lievit:styles>} / {@code <lievit:scripts>}
 * asset shortcuts. The compiler is the parse step only; it never mounts or evaluates expressions.
 */
class LievitTagCompilerTest {

    private final LievitTagCompiler compiler = new LievitTagCompiler();

    /**
     * @spec.given a self-closing tag with a literal and a bound attribute and an explicit key
     * @spec.when  it is compiled
     * @spec.then  the component name, the bound vs literal split, kebab->camel, and the key are parsed
     * @spec.adr   ADR-0023
     */
    @Test
    void parses_a_self_closing_tag_into_a_mount_declaration() {
        CompiledTag tag =
                compiler.compile(
                        "<lievit:user-row :user-id=\"u.id\" label=\"Name\" wire:key=\"k1\" />");

        assertThat(tag.componentName()).isEqualTo("user-row");
        assertThat(tag.selfClosing()).isTrue();
        assertThat(tag.literalAttributes()).containsEntry("label", "Name");
        // kebab -> camel on the @Wire field name.
        assertThat(tag.boundAttributes()).containsEntry("userId", "u.id");
        assertThat(tag.explicitKey()).contains("k1");
    }

    /**
     * @spec.given an opening tag (slot form) with no explicit key
     * @spec.when  it is compiled
     * @spec.then  it is not self-closing and carries no explicit key (a deterministic one is generated
     *     downstream)
     * @spec.adr   ADR-0023
     */
    @Test
    void parses_an_opening_slot_tag() {
        CompiledTag tag = compiler.compile("<lievit:panel title=\"Hello\">");

        assertThat(tag.componentName()).isEqualTo("panel");
        assertThat(tag.selfClosing()).isFalse();
        assertThat(tag.explicitKey()).isEmpty();
    }

    /**
     * @spec.given reserved params lazy + defer + a wire:ref alongside ordinary attributes
     * @spec.when  the tag is compiled
     * @spec.then  the reserved params are recognized and NOT mixed into the props attributes
     * @spec.adr   ADR-0023
     */
    @Test
    void recognizes_reserved_params_and_keeps_them_out_of_props() {
        CompiledTag tag =
                compiler.compile("<lievit:chart lazy defer wire:ref=\"main\" title=\"T\" />");

        assertThat(tag.lazy()).isTrue();
        assertThat(tag.defer()).isTrue();
        assertThat(tag.ref()).contains("main");
        assertThat(tag.literalAttributes()).containsOnlyKeys("title");
        assertThat(tag.boundAttributes()).isEmpty();
    }

    /**
     * @spec.given the dynamic-component form (:is="expr")
     * @spec.when  the tag is compiled
     * @spec.then  it is flagged dynamic and the :is expression is captured, not treated as a prop
     * @spec.adr   ADR-0023
     */
    @Test
    void parses_the_dynamic_component_is_form() {
        CompiledTag tag = compiler.compile("<lievit:dynamic-component :is=\"widgetClass\" />");

        assertThat(tag.dynamic()).isTrue();
        assertThat(tag.isExpression()).contains("widgetClass");
        assertThat(tag.boundAttributes()).doesNotContainKey("is");
    }

    /**
     * @spec.given the asset shortcut tags
     * @spec.when  they are compiled
     * @spec.then  they map to the styles / scripts asset-directive kinds, not a component mount
     * @spec.adr   ADR-0023
     */
    @Test
    void maps_asset_shortcut_tags() {
        assertThat(compiler.compile("<lievit:styles />").assetDirective())
                .contains(CompiledTag.AssetKind.STYLES);
        assertThat(compiler.compile("<lievit:scripts />").assetDirective())
                .contains(CompiledTag.AssetKind.SCRIPTS);
    }

    /**
     * @spec.given a closing tag
     * @spec.when  it is compiled
     * @spec.then  it is recognized as a closing tag for its component (the slot-end marker)
     * @spec.adr   ADR-0023
     */
    @Test
    void parses_a_closing_tag() {
        CompiledTag tag = compiler.compile("</lievit:panel>");

        assertThat(tag.closing()).isTrue();
        assertThat(tag.componentName()).isEqualTo("panel");
    }

    /**
     * @spec.given a tag whose attribute value tries to break out of its quotes
     * @spec.when  it is compiled and the literal value is read back
     * @spec.then  the value is captured verbatim for the render layer to escape; the compiler never
     *     emits an unescaped attribute itself (no early HTML emission here)
     * @spec.adr   ADR-0023
     */
    @Test
    void captures_attribute_values_verbatim_for_downstream_escaping() {
        CompiledTag tag = compiler.compile("<lievit:row label=\"a&quot;b\" />");

        // The raw value as authored; the render layer / DSL escapes on emit (ADR-0018 rules).
        assertThat(tag.literalAttributes().get("label")).isEqualTo("a&quot;b");
    }

    /**
     * @spec.given text that is not a lievit tag
     * @spec.when  it is compiled
     * @spec.then  it is rejected: the compiler only parses lievit tags
     * @spec.adr   ADR-0023
     */
    @Test
    void rejects_a_non_lievit_tag() {
        assertThatThrownBy(() -> compiler.compile("<div>not a tag</div>"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
