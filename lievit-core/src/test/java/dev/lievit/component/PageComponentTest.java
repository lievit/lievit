/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import dev.lievit.LievitComponent;
import dev.lievit.LievitLayout;
import dev.lievit.LievitTitle;

/**
 * Pins the full-page component metadata reflection (ADR-0031, #63): {@code @LievitLayout} and
 * {@code @LievitTitle} are read off the component class; their absence means "use the default".
 */
class PageComponentTest {

    @LievitComponent
    @LievitLayout("layouts/app")
    @LievitTitle("Dashboard")
    static class Dashboard {}

    @LievitComponent
    static class Bare {}

    /**
     * @spec.given a component annotated with @LievitLayout and @LievitTitle
     * @spec.when  its page metadata is reflected
     * @spec.then  the layout and title values are captured
     * @spec.adr   ADR-0031
     */
    @Test
    void reflects_the_layout_and_title() {
        PageComponent page = PageComponent.of(Dashboard.class);
        assertThat(page.layout()).isEqualTo("layouts/app");
        assertThat(page.title()).isEqualTo("Dashboard");
    }

    /**
     * @spec.given a component with neither annotation
     * @spec.when  its page metadata is reflected
     * @spec.then  layout and title are null (the starter uses the configured default layout)
     * @spec.adr   ADR-0031
     */
    @Test
    void absent_annotations_mean_use_the_default() {
        PageComponent page = PageComponent.of(Bare.class);
        assertThat(page.layout()).isNull();
        assertThat(page.title()).isNull();
    }
}
