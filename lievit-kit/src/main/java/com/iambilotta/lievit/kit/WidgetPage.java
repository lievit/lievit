/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

import java.util.List;

/**
 * A dashboard page that hosts one or more {@link Widget widgets}.
 *
 * <p>A widget page is a first-class admin surface, registered on a {@link Panel} via
 * {@link Panel#page(WidgetPage)}, parallel to {@link Resource}. It differs from a resource in
 * that it has no underlying data table or form; its only concern is aggregating summary widgets
 * (stats, charts, alerts) for a dashboard view.
 *
 * <p>An adopter subclasses {@code WidgetPage}, overrides {@link #slug()}, {@link #label()}, and
 * {@link #widgets()}, and registers the instance on the panel:
 *
 * <pre>
 *   panel.page(new DashboardPage());
 *
 *   class DashboardPage extends WidgetPage {
 *       {@literal @}Override public String slug()  { return "dashboard"; }
 *       {@literal @}Override public String label() { return "Dashboard"; }
 *       {@literal @}Override public List&lt;Widget&gt; widgets() {
 *           return List.of(
 *               StatWidget.create("Active listings", () -> String.valueOf(listingRepo.count()))
 *                         .description("updated live")
 *           );
 *       }
 *   }
 * </pre>
 */
public abstract class WidgetPage {

    /**
     * The url slug for this page (for example {@code "dashboard"} → {@code /admin/dashboard}).
     *
     * @return the slug
     */
    public abstract String slug();

    /**
     * The human label shown in navigation.
     *
     * @return the label
     */
    public abstract String label();

    /**
     * Builds the list of widgets displayed on this page, in display order.
     *
     * @return the widgets (may be empty, never null)
     */
    public abstract List<Widget> widgets();
}
