/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.compiler;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import io.lievit.LievitComponent;
import io.lievit.LievitRender;
import io.lievit.Wire;

/**
 * Spec for the single-file component compilation cache (ADR-0023, issue #173): a component compiles
 * to a {@link CompiledComponent} carrying its reflected {@code ComponentMetadata}, the template id
 * used for deterministic keys, and the optional colocated side artifacts (script module, scoped
 * style, placeholder) discovered by convention next to the class on the classpath. The compile is
 * <em>reflect + parse colocated regions + cache</em>, not Java classgen (the JVM compiler already
 * produced the class); the cache is keyed by class + a source-staleness signature.
 */
class ComponentCompilerTest {

    @LievitComponent
    static class DslComp {
        @Wire int count;

        @LievitRender
        Object view() {
            return null;
        }
    }

    @LievitComponent(template = "user/row")
    static class TemplateComp {
        @Wire String name = "";
    }

    private final ComponentCompiler compiler = new ComponentCompiler();

    /**
     * @spec.given a single-file (DSL) component class
     * @spec.when  it is compiled
     * @spec.then  the CompiledComponent carries its metadata and a template id (the FQN) for keys
     * @spec.adr   ADR-0023
     */
    @Test
    void compiles_a_single_file_component_with_its_metadata_and_template_id() {
        CompiledComponent compiled = compiler.compile(DslComp.class);

        assertThat(compiled.metadata().type()).isEqualTo(DslComp.class);
        assertThat(compiled.templateId()).isEqualTo(DslComp.class.getName());
        assertThat(compiled.singleFile()).isTrue();
    }

    /**
     * @spec.given a multi-file component class declaring a JTE template
     * @spec.when  it is compiled
     * @spec.then  the template id is the declared template path (so keys are scoped per template, not
     *     per class) and it is not single-file
     * @spec.adr   ADR-0023
     */
    @Test
    void uses_the_template_path_as_the_key_namespace_for_multi_file_components() {
        CompiledComponent compiled = compiler.compile(TemplateComp.class);

        assertThat(compiled.templateId()).isEqualTo("user/row");
        assertThat(compiled.singleFile()).isFalse();
    }

    /**
     * @spec.given a component compiled twice without any source change
     * @spec.when  it is compiled again
     * @spec.then  the cached instance is returned (idempotent, compile-once)
     * @spec.adr   ADR-0023
     */
    @Test
    void caches_the_compiled_artifact_and_returns_it_on_recompile() {
        CompiledComponent first = compiler.compile(DslComp.class);
        CompiledComponent second = compiler.compile(DslComp.class);

        assertThat(second).isSameAs(first);
    }

    /**
     * @spec.given a component whose source-staleness signature changed (a dev-mode edit)
     * @spec.when  it is compiled with the new signature
     * @spec.then  it recompiles to a fresh artifact (the cache invalidated on staleness)
     * @spec.adr   ADR-0023
     */
    @Test
    void recompiles_when_the_source_staleness_signature_changes() {
        ComponentCompiler stamped = new ComponentCompiler(type -> System.nanoTime());

        CompiledComponent first = stamped.compile(DslComp.class);
        CompiledComponent second = stamped.compile(DslComp.class);

        assertThat(second).isNotSameAs(first);
    }

    /**
     * @spec.given a component with a colocated placeholder resource on the classpath
     * @spec.when  it is compiled
     * @spec.then  the placeholder markup is captured as the lazy-load hook artifact (issue #173)
     * @spec.adr   ADR-0023
     */
    @Test
    void captures_a_colocated_placeholder_artifact() {
        // The fixture resource io/lievit/compiler/PlaceholderFixture.placeholder.html is on the
        // test classpath next to this class's package.
        CompiledComponent compiled = compiler.compile(PlaceholderFixture.class);

        assertThat(compiled.placeholder()).isPresent();
        assertThat(compiled.placeholder().orElseThrow()).contains("Loading");
    }

    /**
     * @spec.given a component with no colocated script/style/placeholder
     * @spec.when  it is compiled
     * @spec.then  the side artifacts are absent (a plain component has no colocated assets)
     * @spec.adr   ADR-0023
     */
    @Test
    void absent_side_artifacts_are_empty() {
        CompiledComponent compiled = compiler.compile(DslComp.class);

        assertThat(compiled.scriptModule()).isEmpty();
        assertThat(compiled.style()).isEmpty();
        assertThat(compiled.placeholder()).isEmpty();
        assertThat(compiled.assets().isEmpty()).isTrue();
    }

    /**
     * @spec.given a component with a colocated {@code .lievit.assets} resource declaring head tags
     * @spec.when  it is compiled
     * @spec.then  the {@code @assets} head tags are captured verbatim, in order, with comment/blank
     *     lines stripped (the once-per-page shared-asset block, issue #119)
     * @spec.adr   ADR-0061
     * @spec.us    US-119-script-and-assets
     */
    @Test
    void captures_at_assets_head_tags_verbatim() {
        CompiledComponent compiled = compiler.compile(AssetsFixture.class);

        assertThat(compiled.assets().isEmpty()).isFalse();
        assertThat(compiled.assets().headTags())
                .containsExactly(
                        "<link rel=\"stylesheet\" href=\"https://cdn.example.com/chart.css\">",
                        "<script src=\"https://cdn.example.com/chart.js\"></script>");
    }

    /**
     * @spec.given two components with the same and with different template identities
     * @spec.when  their {@code @assets} dedup keys are derived
     * @spec.then  the key is deterministic and distinct per component (so the page can dedup a
     *     component's assets across instances yet ship a different component's assets, issue #119)
     * @spec.adr   ADR-0061
     */
    @Test
    void derives_a_deterministic_distinct_assets_key_per_component() {
        String assetsKey = compiler.compile(AssetsFixture.class).assets().key();
        String otherKey = compiler.compile(DslComp.class).assets().key();

        assertThat(assetsKey).startsWith("lw-").endsWith("-assets");
        assertThat(assetsKey).isNotEqualTo(otherKey);
        // Stable across recompiles (the once-per-page dedup depends on it).
        assertThat(compiler.compile(AssetsFixture.class).assets().key()).isEqualTo(assetsKey);
    }
}
