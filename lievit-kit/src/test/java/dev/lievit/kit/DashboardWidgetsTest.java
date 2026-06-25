/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;

/**
 * Specifies the dashboard + widget family: StatWidget presentation slots (#309), ChartWidget bridge
 * + subclasses (#311), TableWidget (#315), the Dashboard responsive grid + WidgetConfiguration
 * (#307), and the ColumnSpan value type. Pure tests — no Spring context.
 */
class DashboardWidgetsTest {

    // ── StatWidget extension (#309) ─────────────────────────────────────────────────────────────

    /**
     * @spec.given a stat widget with icon, color, description icon, sparkline, and a url
     * @spec.when  the new slots are read
     * @spec.then  each returns the configured value
     */
    @Test
    void stat_widget_carries_icon_color_description_icon_chart_and_url() {
        StatWidget stat =
                StatWidget.create("Active listings", "142")
                        .icon(Icon.of("nav.resource"))
                        .color(Color.SUCCESS)
                        .descriptionIcon(Icon.of("trend.up"), IconPosition.AFTER)
                        .chart(List.of(3, 5, 4, 7, 9))
                        .url("/admin/listings", true);

        assertThat(stat.icon()).contains(Icon.of("nav.resource"));
        assertThat(stat.color()).contains(Color.SUCCESS);
        assertThat(stat.descriptionIcon()).contains(Icon.of("trend.up"));
        assertThat(stat.descriptionIconPosition()).isEqualTo(IconPosition.AFTER);
        assertThat(stat.chart()).contains(List.of(3, 5, 4, 7, 9));
        assertThat(stat.url()).contains("/admin/listings");
        assertThat(stat.opensInNewTab()).isTrue();
    }

    /**
     * @spec.given a plain stat widget
     * @spec.when  the new slots are read
     * @spec.then  they are all empty and it remains a grid widget with a default single span
     */
    @Test
    void stat_widget_new_slots_default_to_empty_and_it_is_a_dashboard_widget() {
        StatWidget stat = StatWidget.create("Total", "0");

        assertThat(stat.icon()).isEmpty();
        assertThat(stat.color()).isEmpty();
        assertThat(stat.url()).isEmpty();
        assertThat(stat).isInstanceOf(DashboardWidget.class);
        assertThat(((DashboardWidget) stat).columnSpan().at(ColumnSpan.DEFAULT_BREAKPOINT)).isEqualTo(1);
    }

    // ── ChartWidget (#311) ──────────────────────────────────────────────────────────────────────

    static final class SalesChart extends BarChartWidget {
        SalesChart() {
            heading("Sales");
            filter("2025", "2025");
            filter("2026", "2026");
        }

        @Override
        public ChartData data() {
            String year = activeFilter().orElse("2026");
            int base = year.equals("2026") ? 10 : 1;
            return new ChartData(
                    List.of("Q1", "Q2"),
                    List.of(new Dataset("Revenue", List.of(base, base + 5))));
        }
    }

    /**
     * @spec.given a bar chart subclass with a heading and data
     * @spec.when  its type, data, and heading are read
     * @spec.then  the type is the chart.js bar type and the data carries labels + a dataset
     */
    @Test
    void chart_widget_renders_type_data_and_heading() {
        SalesChart chart = new SalesChart();

        assertThat(chart.type()).isEqualTo(ChartWidget.ChartType.BAR);
        assertThat(chart.type().jsName()).isEqualTo("bar");
        assertThat(chart.heading()).contains("Sales");
        assertThat(chart.data().labels()).containsExactly("Q1", "Q2");
        assertThat(chart.data().datasets()).hasSize(1);
        assertThat(chart.data().datasets().get(0).label()).isEqualTo("Revenue");
    }

    /**
     * @spec.given a chart with a filter dropdown
     * @spec.when  a filter value is applied
     * @spec.then  the data re-queries with the active filter (different values)
     */
    @Test
    void chart_widget_filter_changes_the_data() {
        SalesChart chart = new SalesChart();
        List<Number> before = chart.data().datasets().get(0).values();

        chart.applyFilter("2025");
        List<Number> after = chart.data().datasets().get(0).values();

        assertThat(before).isNotEqualTo(after);
        assertThat(chart.activeFilter()).contains("2025");
    }

    /**
     * @spec.given a chart with stable data
     * @spec.when  the data checksum is computed twice without change, then after a filter change
     * @spec.then  the checksum is stable for unchanged data and changes when the data changes
     */
    @Test
    void chart_widget_checksum_is_stable_until_data_changes() {
        SalesChart chart = new SalesChart();
        String first = chart.dataChecksum();

        assertThat(chart.dataChecksum()).isEqualTo(first);

        chart.applyFilter("2025");
        assertThat(chart.dataChecksum()).isNotEqualTo(first);
    }

    /**
     * @spec.given a chart with options, maxHeight, color, collapsible, and a polling interval
     * @spec.when  the presentation slots are read
     * @spec.then  each returns the configured value
     */
    @Test
    void chart_widget_carries_presentation_and_polling_config() {
        SalesChart chart = new SalesChart();
        chart.maxHeight(300).color(Color.PRIMARY).collapsible(true).pollingInterval(Duration.ofSeconds(30));

        assertThat(chart.maxHeight()).contains(300);
        assertThat(chart.color()).contains(Color.PRIMARY);
        assertThat(chart.isCollapsible()).isTrue();
        assertThat(chart.pollingInterval()).contains(Duration.ofSeconds(30));
    }

    /**
     * @spec.given the four common chart subclasses
     * @spec.when  their fixed type is read
     * @spec.then  each maps to its chart.js type string
     */
    @Test
    void chart_subclasses_fix_their_chart_js_type() {
        assertThat(new LineChartWidget() {
            @Override
            public ChartData data() {
                return new ChartData(List.of(), List.of());
            }
        }.type().jsName()).isEqualTo("line");
        assertThat(new PieChartWidget() {
            @Override
            public ChartData data() {
                return new ChartData(List.of(), List.of());
            }
        }.type().jsName()).isEqualTo("pie");
        assertThat(new DoughnutChartWidget() {
            @Override
            public ChartData data() {
                return new ChartData(List.of(), List.of());
            }
        }.type().jsName()).isEqualTo("doughnut");
        assertThat(new PolarAreaChartWidget() {
            @Override
            public ChartData data() {
                return new ChartData(List.of(), List.of());
            }
        }.type().jsName()).isEqualTo("polarArea");
    }

    // ── TableWidget (#315) ──────────────────────────────────────────────────────────────────────

    static final class RecentListingsTableWidget extends TableWidget<String> {
        @Override
        public Table<String> table() {
            return Table.<String>create().column("Value", s -> s);
        }

        @Override
        public RecordRepository<String> repository() {
            return new RecordRepository<>() {
                @Override
                public Page<String> page(Query query) {
                    List<String> all = List.of("a", "b", "c", "d", "e", "f", "g");
                    int to = Math.min(query.offset() + query.limit(), all.size());
                    return Page.of(all.subList(query.offset(), to), all.size());
                }

                @Override
                public Optional<String> findById(String id) {
                    return Optional.of(id);
                }

                @Override
                public String create(String record) {
                    return record;
                }

                @Override
                public String update(String id, String record) {
                    return record;
                }

                @Override
                public void delete(String id) {}
            };
        }
    }

    /**
     * @spec.given a table widget over seven rows with the default page size
     * @spec.when  its rows and heading are read
     * @spec.then  it shows only the first page and derives a heading from the class name
     */
    @Test
    void table_widget_shows_a_simple_page_and_derives_its_heading() {
        RecentListingsTableWidget widget = new RecentListingsTableWidget();

        assertThat(widget.rows()).containsExactly("a", "b", "c", "d", "e");
        assertThat(widget.resolvedHeading()).isEqualTo("Recent Listings");
        assertThat(widget.table().columns()).hasSize(1);
        assertThat(widget.columnSpan().isFull()).isTrue();
    }

    /**
     * @spec.given a table widget with an explicit heading and page size
     * @spec.when  the overrides are read
     * @spec.then  they win over the derived defaults
     */
    @Test
    void table_widget_honours_explicit_heading_and_page_size() {
        RecentListingsTableWidget widget = new RecentListingsTableWidget();
        widget.heading("Latest").pageSize(2);

        assertThat(widget.resolvedHeading()).isEqualTo("Latest");
        assertThat(widget.rows()).containsExactly("a", "b");
    }

    // ── ColumnSpan ──────────────────────────────────────────────────────────────────────────────

    /**
     * @spec.given a responsive span with default and md breakpoints
     * @spec.when  the span is resolved at md, an unknown breakpoint, and a full span
     * @spec.then  md uses its value, unknown falls back to default, full reports isFull
     */
    @Test
    void column_span_resolves_responsively_with_a_default_fallback() {
        ColumnSpan responsive = ColumnSpan.responsive(Map.of("default", 1, "md", 2));

        assertThat(responsive.at("md")).isEqualTo(2);
        assertThat(responsive.at("xl")).isEqualTo(1);
        assertThat(ColumnSpan.full().isFull()).isTrue();
    }

    // ── Dashboard grid (#307) ───────────────────────────────────────────────────────────────────

    static final class HomeDashboard extends Dashboard {
        private final List<DashboardWidget> widgets;

        HomeDashboard(List<DashboardWidget> widgets) {
            this.widgets = widgets;
        }

        @Override
        public int columns() {
            return 3;
        }

        @Override
        public List<DashboardWidget> widgets() {
            return widgets;
        }
    }

    static final class HiddenWidget implements DashboardWidget {
        @Override
        public boolean canView() {
            return false;
        }
    }

    /**
     * @spec.given a dashboard with three stat widgets declared out of order, one hidden
     * @spec.when  the visible widgets are read
     * @spec.then  the hidden one is filtered and the rest are sorted ascending by sort key
     */
    @Test
    void dashboard_filters_hidden_widgets_and_sorts_by_sort_key() {
        StatWidget c = StatWidget.create("C", "3").sort(30);
        StatWidget a = StatWidget.create("A", "1").sort(10);
        StatWidget b = StatWidget.create("B", "2").sort(20);
        Dashboard dashboard = new HomeDashboard(List.of(c, a, b, new HiddenWidget()));

        assertThat(dashboard.visibleWidgets())
                .containsExactly(a, b, c);
    }

    /**
     * @spec.given a 3-column dashboard and a full-width widget plus a 5-wide widget
     * @spec.when  the effective span is computed at the default breakpoint
     * @spec.then  full fills the grid and an over-wide span is clamped to the grid width
     */
    @Test
    void dashboard_clamps_effective_span_to_the_grid_width() {
        Dashboard dashboard = new HomeDashboard(List.of());
        DashboardWidget full = new DashboardWidget() {
            @Override
            public ColumnSpan columnSpan() {
                return ColumnSpan.full();
            }
        };
        DashboardWidget overWide = new DashboardWidget() {
            @Override
            public ColumnSpan columnSpan() {
                return ColumnSpan.of(5);
            }
        };

        assertThat(dashboard.effectiveSpan(full, ColumnSpan.DEFAULT_BREAKPOINT)).isEqualTo(3);
        assertThat(dashboard.effectiveSpan(overWide, ColumnSpan.DEFAULT_BREAKPOINT)).isEqualTo(3);
    }

    /**
     * @spec.given a widget configuration overriding span and sort
     * @spec.when  the configured widget's span and sort are read
     * @spec.then  the overrides win over the wrapped widget's own values
     */
    @Test
    void widget_configuration_overrides_span_and_sort() {
        StatWidget stat = StatWidget.create("X", "1").sort(99);
        WidgetConfiguration configured = WidgetConfiguration.make(stat).columnSpan(2).sort(5);

        assertThat(configured.sort()).isEqualTo(5);
        assertThat(configured.columnSpan().at(ColumnSpan.DEFAULT_BREAKPOINT)).isEqualTo(2);
        assertThat(configured.widget()).isSameAs(stat);
    }
}
