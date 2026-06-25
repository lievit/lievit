/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;

/**
 * Specifies the widget layer: {@link StatWidget} (the concrete v0.1 widget) and
 * {@link WidgetPage} (the dashboard page abstraction). Tests stay pure — no Spring context.
 */
class WidgetTest {

    // ── StatWidget ────────────────────────────────────────────────────────────

    /**
     * @spec.given a StatWidget created with a constant heading and value
     * @spec.when  heading() and value() are called
     * @spec.then  they return the declared strings
     */
    @Test
    void stat_widget_exposes_heading_and_eager_value() {
        StatWidget widget = StatWidget.create("Active listings", "142");

        assertThat(widget.heading()).isEqualTo("Active listings");
        assertThat(widget.value()).isEqualTo("142");
    }

    /**
     * @spec.given a StatWidget with no description set
     * @spec.when  description() is called
     * @spec.then  an empty Optional is returned
     */
    @Test
    void stat_widget_description_is_absent_by_default() {
        StatWidget widget = StatWidget.create("Total", "0");

        assertThat(widget.description()).isEmpty();
    }

    /**
     * @spec.given a StatWidget with a description set
     * @spec.when  description() is called
     * @spec.then  an Optional containing the description is returned
     */
    @Test
    void stat_widget_carries_a_description_when_set() {
        StatWidget widget = StatWidget.create("Active listings", "142").description("+12 this week");

        assertThat(widget.description()).contains("+12 this week");
    }

    /**
     * @spec.given a StatWidget created with a lazy Supplier value
     * @spec.when  value() is called
     * @spec.then  the supplier is invoked and its result returned
     */
    @Test
    void stat_widget_evaluates_lazy_value_supplier_on_each_call() {
        AtomicInteger counter = new AtomicInteger(0);
        StatWidget widget = StatWidget.create("Counter", () -> String.valueOf(counter.incrementAndGet()));

        assertThat(widget.value()).isEqualTo("1");
        assertThat(widget.value()).isEqualTo("2");  // supplier called again
    }

    /**
     * @spec.given a StatWidget
     * @spec.when  its type is checked against the Widget interface
     * @spec.then  it implements Widget
     */
    @Test
    void stat_widget_implements_widget_interface() {
        Widget widget = StatWidget.create("Total", "99");

        assertThat(widget).isInstanceOf(Widget.class);
        assertThat(widget.heading()).isEqualTo("Total");
        assertThat(widget.value()).isEqualTo("99");
        assertThat(widget.description()).isEmpty();
    }

    // ── WidgetPage ────────────────────────────────────────────────────────────

    static final class DashboardPage extends WidgetPage {

        private final List<Widget> widgets;

        DashboardPage(List<Widget> widgets) {
            this.widgets = widgets;
        }

        @Override
        public String slug() {
            return "dashboard";
        }

        @Override
        public String label() {
            return "Dashboard";
        }

        @Override
        public List<Widget> widgets() {
            return widgets;
        }
    }

    /**
     * @spec.given a WidgetPage implementation with two stat widgets
     * @spec.when  slug(), label(), and widgets() are called
     * @spec.then  each returns the declared value
     */
    @Test
    void widget_page_exposes_slug_label_and_widget_list() {
        List<Widget> widgets = List.of(
                StatWidget.create("Listings", "142"),
                StatWidget.create("Agents", "8"));
        WidgetPage page = new DashboardPage(widgets);

        assertThat(page.slug()).isEqualTo("dashboard");
        assertThat(page.label()).isEqualTo("Dashboard");
        assertThat(page.widgets()).hasSize(2);
        assertThat(page.widgets()).extracting(Widget::heading)
                .containsExactly("Listings", "Agents");
    }

    // ── Panel integration ─────────────────────────────────────────────────────

    /**
     * @spec.given a Panel with a WidgetPage registered
     * @spec.when  pages() is called
     * @spec.then  the page appears in the list (first-class peer of resources)
     */
    @Test
    void panel_registers_a_widget_page_as_a_first_class_page() {
        WidgetPage dashboardPage = new DashboardPage(
                List.of(StatWidget.create("Active", "1")));

        Panel panel = Panel.create("admin").page(dashboardPage);

        assertThat(panel.pages()).containsExactly(dashboardPage);
    }

    /**
     * @spec.given a Panel with no pages registered
     * @spec.when  pages() is called
     * @spec.then  an empty list is returned
     */
    @Test
    void panel_returns_empty_page_list_when_none_are_registered() {
        Panel panel = Panel.create("admin");

        assertThat(panel.pages()).isEmpty();
    }

    /**
     * @spec.given a Panel with a WidgetPage registered
     * @spec.when  the caller tries to add to the returned pages list
     * @spec.then  the list is unmodifiable
     */
    @Test
    void panel_pages_list_is_unmodifiable() {
        WidgetPage page = new DashboardPage(List.of());
        Panel panel = Panel.create("admin").page(page);

        assertThat(panel.pages()).hasSize(1);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> panel.pages().add(page))
                .isInstanceOf(UnsupportedOperationException.class);
    }
}
