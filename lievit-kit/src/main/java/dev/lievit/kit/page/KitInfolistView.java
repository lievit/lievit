/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.page;

import dev.lievit.kit.AdminViewView;
import java.util.Objects;

/**
 * The render-time bundle the kit infolist template ({@code kit/infolist.jte}) reads: the bounded
 * {@link AdminViewView} (the pure projection of heading / sections / resolved tree / header actions
 * the {@link ViewPageDriver} produces) PLUS the render-only facts the pure view-model deliberately
 * does not know. The View (detail) page is the read-only counterpart of the table chrome, so the
 * bundle is the infolist analogue of {@link KitTableView}: ONE typed object the canonical Filament
 * {@code ViewRecord} chrome needs.
 *
 * <p>Unlike the table, the detail page carries no pagination / sort / selection, so the only
 * render-time fact beyond the projection is the {@link #backHref() back-to-list href} the empty
 * toolbar falls back to when the resource declared no header actions of its own. Everything else the
 * template paints (heading, the resolved {@link AdminViewView#tree() node tree}, the header-action
 * buttons with their already-resolved URLs) lives in the {@link AdminViewView}.
 *
 * <p>A host (a {@code @LievitComponent}, or {@link KitInfolistComponent}) builds it with
 * {@link #of(AdminViewView)} and layers the back href on with {@link #withBackHref(String)}.
 *
 * @param view the bounded detail projection (heading, sections, resolved tree, header actions)
 * @param backHref the GET href the implicit back link targets when no header action carries one;
 *     empty hides the implicit back link
 */
public record KitInfolistView(AdminViewView view, String backHref) {

    /** Compact constructor: defends the view and never-nulls the href. */
    public KitInfolistView {
        Objects.requireNonNull(view, "view");
        backHref = backHref == null ? "" : backHref;
    }

    /**
     * The minimal bundle: just the projection, no implicit back link. The host layers the back href
     * on with {@link #withBackHref(String)}.
     *
     * @param view the bounded detail projection
     * @return the bundle
     */
    public static KitInfolistView of(AdminViewView view) {
        return new KitInfolistView(view, "");
    }

    /**
     * @param backHref the back-to-list href
     * @return a copy carrying the implicit back-link href
     */
    public KitInfolistView withBackHref(String backHref) {
        return new KitInfolistView(view, backHref);
    }

    /** @return whether an implicit back link renders (a back href is set) */
    public boolean hasBackHref() {
        return !backHref.isBlank();
    }
}
