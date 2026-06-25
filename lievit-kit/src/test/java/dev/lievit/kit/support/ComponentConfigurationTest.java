/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.support;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Specifies the component configuration manager: configureUsing global defaults applied at
 * construction, subclass inheritance of a parent's defaults, the important tier winning, and the
 * scoped {@code during} form.
 */
class ComponentConfigurationTest {

    /** A test stand-in for a configurable kit component. */
    static class Widget {
        int maxLength = 0;
        String color = "";
    }

    /** A subclass to prove parent defaults flow down. */
    static final class EmailWidget extends Widget {}

    /**
     * @spec.given a default registered for Widget
     * @spec.when  a fresh Widget is configured
     * @spec.then  the default is applied to it
     */
    @Test
    void a_global_default_is_applied_to_every_instance() {
        ComponentConfiguration config = new ComponentConfiguration();
        config.configureUsing(Widget.class, w -> w.maxLength = 255);

        Widget w = config.configure(new Widget());

        assertThat(w.maxLength).isEqualTo(255);
    }

    /**
     * @spec.given a default registered on the parent Widget
     * @spec.when  a subclass instance is configured
     * @spec.then  the subclass receives the parent's default too
     */
    @Test
    void a_subclass_receives_its_parents_default() {
        ComponentConfiguration config = new ComponentConfiguration();
        config.configureUsing(Widget.class, w -> w.maxLength = 100);

        EmailWidget w = config.configure(new EmailWidget());

        assertThat(w.maxLength).isEqualTo(100);
    }

    /**
     * @spec.given a normal default and an important default that conflict
     * @spec.when  an instance is configured
     * @spec.then  the important default wins (runs last)
     */
    @Test
    void an_important_default_wins_over_a_normal_one() {
        ComponentConfiguration config = new ComponentConfiguration();
        config.configureUsing(Widget.class, w -> w.color = "blue");
        config.configureImportant(Widget.class, w -> w.color = "red");

        Widget w = config.configure(new Widget());

        assertThat(w.color).isEqualTo("red");
    }

    /**
     * @spec.given a default registered via the scoped during form
     * @spec.when  components are configured inside and after the block
     * @spec.then  the default applies only inside the block, then is removed
     */
    @Test
    void the_scoped_during_form_applies_only_inside_the_block() {
        ComponentConfiguration config = new ComponentConfiguration();
        Widget[] inside = new Widget[1];

        config.during(Widget.class, w -> w.maxLength = 50, () -> inside[0] = config.configure(new Widget()));
        Widget after = config.configure(new Widget());

        assertThat(inside[0].maxLength).isEqualTo(50);
        assertThat(after.maxLength).isEqualTo(0);
    }

    /**
     * @spec.given a registered default with its unregister handle
     * @spec.when  the handle is invoked then an instance is configured
     * @spec.then  the default no longer applies
     */
    @Test
    void an_unregister_handle_removes_the_default() {
        ComponentConfiguration config = new ComponentConfiguration();
        ComponentConfiguration.Registration handle =
                config.configureUsing(Widget.class, w -> w.maxLength = 9);

        handle.unregister();
        Widget w = config.configure(new Widget());

        assertThat(w.maxLength).isEqualTo(0);
    }
}
