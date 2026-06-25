/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import dev.lievit.LievitAction;
import dev.lievit.LievitComponent;
import dev.lievit.Wire;
import dev.lievit.wire.PayloadGuard;
import dev.lievit.wire.synth.SynthesizerRegistry;

/**
 * Pins {@code with()} extra view data (ADR-0041, #65, Livewire {@code SupportWithMethod} parity): a
 * component method named {@code with()} returning a {@code Map} contributes derived view variables
 * that reach the template model without being persisted {@code @Wire} state, and an entry whose key
 * collides with a public property takes precedence over it.
 */
class WithMethodTest {

    @LievitComponent
    static class Catalog {
        @Wire int page = 1;
        @Wire String title = "from-property";

        @LievitAction
        void next() {
            this.page++;
        }

        Map<String, Object> with() {
            // "rows" is derived (not @Wire); "title" deliberately collides with the property.
            return Map.of("rows", List.of("a", "b", "c"), "title", "from-with");
        }
    }

    @LievitComponent
    static class Plain {
        @Wire int n;

        @LievitAction
        void inc() {
            this.n++;
        }
    }

    private WireDispatcher dispatcher() {
        return new WireDispatcher(
                new PayloadGuard(), NoOpFieldValidator.INSTANCE, new SynthesizerRegistry(),
                new LifecycleBus());
    }

    /**
     * @spec.given a component with a with() method returning a derived "rows" entry
     * @spec.when  the component mounts and the render runs
     * @spec.then  "rows" rides the WireCall view data (it is not @Wire state in the snapshot)
     * @spec.adr   ADR-0041
     */
    @Test
    void with_data_rides_the_render_but_is_not_wire_state() {
        ComponentMetadata meta = ComponentMetadata.of(Catalog.class);

        WireCall mounted = dispatcher().mount(meta, new Catalog());

        assertThat(mounted.viewData()).containsEntry("rows", List.of("a", "b", "c"));
        assertThat(mounted.wire()).doesNotContainKey("rows");
    }

    /**
     * @spec.given a with() entry whose key collides with a public property "title"
     * @spec.when  the wire call resolves the view data alongside the @Wire state
     * @spec.then  the with() value takes precedence over the same-named property
     * @spec.adr   ADR-0041
     */
    @Test
    void with_data_overrides_a_same_named_property() {
        ComponentMetadata meta = ComponentMetadata.of(Catalog.class);

        WireCall result = dispatcher()
                .call(meta, new Catalog(), Map.of("page", 1, "title", "from-property"),
                        Map.of(), List.of("next"));

        assertThat(result.wire()).containsEntry("title", "from-property");
        assertThat(result.viewData()).containsEntry("title", "from-with");
    }

    /**
     * @spec.given a component with no with() method
     * @spec.when  it mounts
     * @spec.then  the view data is empty (the with() seam is opt-in, a leaf is unchanged)
     * @spec.adr   ADR-0041
     */
    @Test
    void a_component_without_with_has_empty_view_data() {
        ComponentMetadata meta = ComponentMetadata.of(Plain.class);

        WireCall mounted = dispatcher().mount(meta, new Plain());

        assertThat(mounted.viewData()).isEmpty();
    }
}
