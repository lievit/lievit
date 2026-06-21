/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * RENDER gate for the lievit-kit canonical dashboard-WIDGET renders (kit/widget/{stat,chart,account,
 * grid}.jte). The twin of KitTableChromeRenderTest: the precompile smoke proves the templates COMPILE
 * against io.lievit.kit + the lievit-ui partials; it cannot prove the widget chrome actually RENDERS.
 * This does: it builds real StatWidget / ChartWidget / AccountWidget fixtures from the kit models,
 * source-renders each kit/widget/*.jte on the fly (the same gg.jte 3.2.4 compiler, ContentType.Html,
 * DirectoryCodeResolver over the staged target/jte-src tree), and asserts the widget markup lands.
 */
package io.lievit.kit.jtecompile;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import gg.jte.ContentType;
import gg.jte.TemplateEngine;
import gg.jte.output.StringOutput;
import gg.jte.resolve.DirectoryCodeResolver;
import io.lievit.kit.AccountWidget;
import io.lievit.kit.BarChartWidget;
import io.lievit.kit.ChartWidget;
import io.lievit.kit.Color;
import io.lievit.kit.ColumnSpan;
import io.lievit.kit.DashboardWidget;
import io.lievit.kit.Icon;
import io.lievit.kit.IconPosition;
import io.lievit.kit.LineChartWidget;
import io.lievit.kit.PieChartWidget;
import io.lievit.kit.StatWidget;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class KitWidgetRenderTest {

    /** The staged template tree: kit/widget/*.jte + the lievit/* partials, under target/jte-src. */
    private static final Path JTE_DIR = Path.of("target", "jte-src");

    private static final TemplateEngine ENGINE =
            TemplateEngine.create(new DirectoryCodeResolver(JTE_DIR), ContentType.Html);

    private String render(String template, Map<String, Object> model) {
        StringOutput out = new StringOutput();
        ENGINE.render(template, model, out);
        return out.toString();
    }

    private String renderStat(StatWidget stat) {
        Map<String, Object> model = new HashMap<>();
        model.put("stat", stat);
        return render("kit/widget/stat.jte", model);
    }

    private String renderChart(ChartWidget chart) {
        Map<String, Object> model = new HashMap<>();
        model.put("chart", chart);
        return render("kit/widget/chart.jte", model);
    }

    private String renderAccount(AccountWidget account) {
        Map<String, Object> model = new HashMap<>();
        model.put("account", account);
        return render("kit/widget/account.jte", model);
    }

    private String renderGrid(List<DashboardWidget> widgets) {
        Map<String, Object> model = new HashMap<>();
        model.put("widgets", widgets);
        return render("kit/widget/grid.jte", model);
    }

    // ---- A bar chart fixture (a thin BarChartWidget over a fixed dataset). ----
    static final class SalesChart extends BarChartWidget {
        @Override
        public ChartData data() {
            return new ChartData(
                    List.of("Jan", "Feb", "Mar"),
                    List.of(new Dataset("Closed", List.of(3, 7, 5))));
        }
    }

    static final class PipelinePie extends PieChartWidget {
        @Override
        public ChartData data() {
            return new ChartData(
                    List.of("New", "Won", "Lost"),
                    List.of(new Dataset("Stage", List.of(4, 2, 1))));
        }
    }

    static final class LeadsLine extends LineChartWidget {
        @Override
        public ChartData data() {
            return new ChartData(
                    List.of("W1", "W2", "W3", "W4"),
                    List.of(new Dataset("Leads", List.of(10, 14, 9, 18))));
        }
    }

    @Test
    void renders_a_stat_widget_as_a_kpi_card_with_value_description_and_trend() {
        StatWidget stat = StatWidget.create("Active listings", "142")
                .description("+12 this week")
                .descriptionIcon(Icon.of("trending-up"), IconPosition.BEFORE)
                .icon(Icon.of("home"))
                .color(Color.SUCCESS);

        String html = renderStat(stat);

        assertTrue(html.contains("data-slot=\"stat-card\""), "stat-card surface missing:\n" + html);
        assertTrue(html.contains("Active listings"), "heading missing");
        assertTrue(html.contains("142"), "value missing");
        assertTrue(html.contains("+12 this week"), "description missing");
        // the success color tints the card (mapped to a --lv-color-* var, never a hex).
        assertTrue(html.contains("var(--lv-color-success)"), "color tint missing:\n" + html);
        assertFalse(html.contains("<script"), "stat card must be CSP-clean (no inline script)");
    }

    @Test
    void renders_a_stat_widget_as_a_whole_card_link_with_a_sparkline() {
        StatWidget stat = StatWidget.create("Revenue", "EUR 42k")
                .url("/admin/revenue")
                .chart(List.of(3, 5, 4, 7, 9))
                .color(Color.PRIMARY);

        String html = renderStat(stat);

        // whole-card stretched-link: a single always-present <a> (never a tag-split per branch).
        assertTrue(html.contains("data-slot=\"stat-card-link\""), "card link missing:\n" + html);
        assertTrue(html.contains("/admin/revenue"), "link href missing");
        // the sparkline is a server-pure SVG line chart in the card's chart slot.
        assertTrue(html.contains("data-slot=\"stat-card-chart\""), "sparkline slot missing");
        assertTrue(html.contains("data-slot=\"chart-line\""), "sparkline SVG line missing:\n" + html);
    }

    @Test
    void renders_a_bar_chart_widget_as_a_server_pure_svg_in_a_section_card() {
        ChartWidget chart = (ChartWidget) new SalesChart()
                .heading("Listings closed")
                .description("last quarter")
                .color(Color.INFO);

        String html = renderChart(chart);

        assertTrue(html.contains("data-slot=\"kit-widget-chart\""), "chart card missing:\n" + html);
        assertTrue(html.contains("Listings closed"), "chart heading missing");
        assertTrue(html.contains("last quarter"), "chart description missing");
        // server-pure SVG: bars, no canvas, no script.
        assertTrue(html.contains("data-slot=\"chart-bar\""), "svg bars missing:\n" + html);
        assertFalse(html.contains("<canvas"), "chart must be server-pure SVG (no canvas)");
        assertFalse(html.contains("<script"), "chart must be CSP-clean (no inline script)");
        // the data checksum rides the card (the Filament patch-in-place fact).
        assertTrue(html.contains("data-checksum="), "data checksum missing");
    }

    @Test
    void renders_a_pie_chart_widget_with_a_legend_and_a_filter_dropdown() {
        ChartWidget chart = (ChartWidget) new PipelinePie()
                .heading("Pipeline by stage")
                .filter("q1", "Q1")
                .filter("q2", "Q2")
                .applyFilter("q2");

        String html = renderChart(chart);

        assertTrue(html.contains("data-slot=\"chart-slice\""), "pie slices missing:\n" + html);
        assertTrue(html.contains("data-slot=\"chart-legend\""), "pie legend missing");
        // the after-header filter dropdown lists the filters, the active one marked.
        assertTrue(html.contains("data-slot=\"dropdown-menu\""), "filter dropdown missing");
        assertTrue(html.contains("Q2"), "active filter label missing:\n" + html);
    }

    @Test
    void renders_a_line_chart_widget_through_the_line_geometry() {
        String html = renderChart((ChartWidget) new LeadsLine().heading("Leads"));

        assertTrue(html.contains("data-slot=\"chart-line\""), "svg line missing:\n" + html);
        assertTrue(html.contains("data-slot=\"chart-point\""), "svg points missing");
    }

    @Test
    void renders_an_account_widget_with_avatar_greeting_name_and_profile_menu() {
        AccountWidget account = AccountWidget.of("Francesco Bilotta")
                .greeting("Welcome back")
                .profileUrl("/admin/profile");

        String html = renderAccount(account);

        assertTrue(html.contains("data-slot=\"kit-widget-account\""), "account card missing:\n" + html);
        assertTrue(html.contains("data-slot=\"avatar\""), "avatar missing");
        assertTrue(html.contains("Welcome back"), "greeting missing");
        assertTrue(html.contains("Francesco Bilotta"), "name missing");
        // the profile quick-links dropdown with a real <a href>.
        assertTrue(html.contains("data-slot=\"dropdown-menu\""), "profile menu missing");
        assertTrue(html.contains("/admin/profile"), "profile href missing");
    }

    @Test
    void grid_lays_widgets_in_order_dispatching_each_to_its_render_and_honouring_span() {
        StatWidget stat = StatWidget.create("KPI", "9");
        AccountWidget account = AccountWidget.of("Ada");
        // a full-width bar chart spans every column.
        ChartWidget fullChart = new BarChartWidget() {
            @Override
            public ColumnSpan columnSpan() {
                return ColumnSpan.full();
            }

            @Override
            public ChartData data() {
                return new ChartData(
                        List.of("A", "B"), List.of(new Dataset("Wide", List.of(2, 5))));
            }
        };
        fullChart.heading("Wide");

        String html = renderGrid(List.of(stat, account, fullChart));

        assertTrue(html.contains("data-slot=\"kit-widget-grid\""), "grid wrapper missing:\n" + html);
        // each widget type dispatched to its own render.
        assertTrue(html.contains("data-slot=\"stat-card\""), "stat not dispatched");
        assertTrue(html.contains("data-slot=\"kit-widget-account\""), "account not dispatched");
        assertTrue(html.contains("data-slot=\"kit-widget-chart\""), "chart not dispatched");
        // a full-span cell spans the 4 default columns.
        assertTrue(html.contains("grid-column:span 4"), "full column-span not applied:\n" + html);
    }

    @Test
    void grid_filters_out_a_widget_that_cannot_be_viewed() {
        StatWidget shown = StatWidget.create("Shown", "1");
        DashboardWidget hidden = new DashboardWidget() {
            @Override
            public boolean canView() {
                return false;
            }
        };

        String html = renderGrid(List.of(shown, hidden));

        assertTrue(html.contains("Shown"), "viewable widget missing:\n" + html);
        // exactly one cell renders (the hidden widget is filtered out).
        int cells = html.split("data-slot=\"kit-widget-grid-cell\"", -1).length - 1;
        assertTrue(cells == 1, "hidden widget should not render a cell, got " + cells + " cells:\n" + html);
    }
}
