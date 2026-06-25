/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/**
 * Specifies {@link ComponentExtensions}: the type-safe, Java-idiomatic replacement for Filament's
 * dynamic {@code Macroable}. Java has no runtime method injection, so instead of {@code __call}
 * dispatch the kit offers a named-extension registry a plugin registers helpers in and invokes
 * fluently, returning the same component so the call chains, plus a {@code mixin} that registers a
 * bundle of helpers at once.
 */
class ComponentExtensionsTest {

    /** A stand-in fluent kit component (a field) the plugin extends. */
    static final class TextField {
        int maxLength = 0;
        boolean required = false;

        TextField maxLength(int n) {
            this.maxLength = n;
            return this;
        }
    }

    /**
     * @spec.given a plugin registers a named extension that sets a fluent default on TextField
     * @spec.when  the extension is invoked on an instance
     * @spec.then  the instance is mutated and returned, so the call chains like a native method
     */
    @Test
    void a_plugin_extension_chains_on_the_component() {
        ComponentExtensions ext = new ComponentExtensions();
        ext.macro(TextField.class, "slug", (TextField f, Object[] args) -> f.maxLength(64));

        TextField field = new TextField();
        TextField returned = ext.invoke(field, "slug").maxLength(64);

        assertThat(returned).isSameAs(field);
        assertThat(field.maxLength).isEqualTo(64);
    }

    /**
     * @spec.given a named extension that reads its arguments
     * @spec.when  it is invoked with an argument
     * @spec.then  the argument reaches the extension function
     */
    @Test
    void an_extension_receives_its_arguments() {
        ComponentExtensions ext = new ComponentExtensions();
        ext.macro(
                TextField.class,
                "cap",
                (TextField f, Object[] args) -> f.maxLength((int) args[0]));

        TextField field = new TextField();
        ext.invoke(field, "cap", 128);

        assertThat(field.maxLength).isEqualTo(128);
    }

    /**
     * @spec.given a mixin bundling several named extensions
     * @spec.when  the mixin is registered and its helpers invoked
     * @spec.then  every helper in the bundle is available (the Filament {@code mixin(object)})
     */
    @Test
    void a_mixin_registers_a_bundle_of_helpers() {
        ComponentExtensions ext = new ComponentExtensions();
        ext.mixin(
                TextField.class,
                m -> {
                    m.macro("title", (TextField f, Object[] a) -> f.maxLength(255));
                    m.macro("flag", (TextField f, Object[] a) -> {
                        f.required = true;
                        return f;
                    });
                });

        TextField field = new TextField();
        ext.invoke(field, "title");
        ext.invoke(field, "flag");

        assertThat(field.maxLength).isEqualTo(255);
        assertThat(field.required).isTrue();
    }

    /**
     * @spec.given no extension registered for a name
     * @spec.when  it is invoked
     * @spec.then  it is rejected (unlike PHP's silent __call, the miss is explicit)
     */
    @Test
    void an_unknown_extension_is_rejected() {
        ComponentExtensions ext = new ComponentExtensions();

        assertThatThrownBy(() -> ext.invoke(new TextField(), "missing"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(ext.hasMacro(TextField.class, "missing")).isFalse();
    }
}
