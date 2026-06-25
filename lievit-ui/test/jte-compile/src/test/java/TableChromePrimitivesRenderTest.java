/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * RENDER test for the two table-chrome fidelity touches that live on the lievit-ui
 * PRIMITIVES (Filament fi-ta polish): the first/last data-cell edge gutters
 * (table/cell.jte + table/head.jte) and the empty-state icon-in-a-circle
 * (empty.jte). The vitest golden suite asserts on the partial SOURCE text; it cannot
 * prove the computed `edge`/circle classes actually LAND in the rendered markup. This
 * does: it source-renders the partials with the same gg.jte 3.2.4 over the STAGED
 * `target/jte-src/lievit/**` tree (so `@template.lievit.icon` inside empty.jte resolves
 * exactly as an adopter compiles it) and asserts the gutters + circle render.
 */
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import gg.jte.Content;
import gg.jte.ContentType;
import gg.jte.TemplateEngine;
import gg.jte.output.StringOutput;
import gg.jte.resolve.DirectoryCodeResolver;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class TableChromePrimitivesRenderTest {

    /**
     * The STAGED adopter-layout tree (target/jte-src/lievit/**), built by this module's
     * maven-resources-plugin in generate-sources. Rendering over THIS tree (not the raw
     * registry/jte source) makes the `lievit/` package prefix resolve, so empty.jte's
     * `@template.lievit.icon` include compiles exactly as an adopter would compile it.
     */
    private static final Path JTE_DIR = Path.of("target", "jte-src");

    private static final TemplateEngine ENGINE =
            TemplateEngine.create(new DirectoryCodeResolver(JTE_DIR), ContentType.Html);

    private static Content text(String s) {
        return out -> out.writeContent(s);
    }

    private String render(String template, Map<String, Object> model) {
        StringOutput out = new StringOutput();
        ENGINE.render(template, model, out);
        return out.toString();
    }

    @Test
    void first_and_last_data_cells_get_the_filament_edge_gutters() {
        Map<String, Object> first = new HashMap<>();
        first.put("edge", "first");
        first.put("content", text("Cecchetto"));
        String firstHtml = render("lievit/table/cell.jte", first);
        assertTrue(firstHtml.contains("ps-[var(--lv-space-6)]"),
                "first cell missing the leading edge gutter:\n" + firstHtml);

        Map<String, Object> last = new HashMap<>();
        last.put("edge", "last");
        last.put("content", text("Edit"));
        String lastHtml = render("lievit/table/cell.jte", last);
        assertTrue(lastHtml.contains("pe-[var(--lv-space-6)]"),
                "last cell missing the trailing edge gutter:\n" + lastHtml);

        // An interior cell (default edge) gets NO extra gutter -- only px-4.
        Map<String, Object> mid = new HashMap<>();
        mid.put("content", text("active"));
        String midHtml = render("lievit/table/cell.jte", mid);
        assertFalse(midHtml.contains("ps-[var(--lv-space-6)]"), "interior cell wrongly got a leading gutter:\n" + midHtml);
        assertFalse(midHtml.contains("pe-[var(--lv-space-6)]"), "interior cell wrongly got a trailing gutter:\n" + midHtml);
    }

    @Test
    void first_and_last_header_cells_get_the_filament_edge_gutters() {
        Map<String, Object> first = new HashMap<>();
        first.put("edge", "first");
        first.put("content", text("Name"));
        String firstHtml = render("lievit/table/head.jte", first);
        assertTrue(firstHtml.contains("ps-[var(--lv-space-6)]"),
                "first header missing the leading edge gutter:\n" + firstHtml);

        Map<String, Object> last = new HashMap<>();
        last.put("edge", "last");
        last.put("content", text("Actions"));
        String lastHtml = render("lievit/table/head.jte", last);
        assertTrue(lastHtml.contains("pe-[var(--lv-space-6)]"),
                "last header missing the trailing edge gutter:\n" + lastHtml);
    }

    @Test
    void empty_state_default_icon_sits_in_a_rounded_circle_with_generous_padding() {
        Map<String, Object> model = new HashMap<>();
        model.put("title", "No cities yet");
        model.put("description", "Create the first city to get started.");
        String html = render("lievit/empty.jte", model);

        // Filament fi-ta empty-state: the icon sits inside a rounded-full tinted circle, and the panel
        // breathes with more vertical room (py-10, was py-6).
        assertTrue(html.contains("rounded-full"),
                "empty-state icon is not wrapped in a rounded-full circle:\n" + html);
        assertTrue(html.contains("py-[var(--lv-space-10)]"),
                "empty-state panel lacks the generous vertical padding (py-10):\n" + html);
        // The icon still renders (the circle wraps it, does not replace it).
        assertTrue(html.contains("data-lucide=\"inbox\""),
                "default empty-state icon (inbox) missing inside the circle:\n" + html);
    }

    @Test
    void soft_badge_variants_render_a_light_tint_with_a_dark_foreground() {
        // soft-* family: pale bg + dark fg (the mock's status pills, e.g. bg-sky-100 text-sky-700),
        // driven by the *-subtle token pair, NOT the solid saturated fill the base variants use.
        Map<String, Object> info = new HashMap<>();
        info.put("variant", "soft-info");
        info.put("label", "In corso");
        String infoHtml = render("lievit/badge.jte", info);
        assertTrue(infoHtml.contains("var(--lv-color-info-subtle)"),
                "soft-info badge missing the subtle background tint:\n" + infoHtml);
        assertTrue(infoHtml.contains("var(--lv-color-info-subtle-fg)"),
                "soft-info badge missing the subtle foreground:\n" + infoHtml);

        for (String intent : new String[] {"success", "warning", "danger"}) {
            Map<String, Object> m = new HashMap<>();
            m.put("variant", "soft-" + intent);
            m.put("label", intent);
            String h = render("lievit/badge.jte", m);
            assertTrue(h.contains("var(--lv-color-" + intent + "-subtle)"),
                    "soft-" + intent + " badge missing its subtle background:\n" + h);
            assertTrue(h.contains("var(--lv-color-" + intent + "-subtle-fg)"),
                    "soft-" + intent + " badge missing its subtle foreground:\n" + h);
        }

        // The base solid variant is untouched (still the saturated fill, no -subtle token).
        Map<String, Object> solid = new HashMap<>();
        solid.put("variant", "info");
        solid.put("label", "Solid");
        String solidHtml = render("lievit/badge.jte", solid);
        assertTrue(solidHtml.contains("var(--lv-color-info)") && !solidHtml.contains("-subtle"),
                "the solid info variant must keep the saturated fill:\n" + solidHtml);
    }

    @Test
    void soft_badge_can_carry_a_leading_dot() {
        Map<String, Object> m = new HashMap<>();
        m.put("variant", "soft-info");
        m.put("label", "Programmata");
        m.put("dot", true);
        String html = render("lievit/badge.jte", m);
        assertTrue(html.contains("background:currentColor"),
                "soft badge dot=true did not render the leading dot:\n" + html);
        assertTrue(html.contains("aria-hidden=\"true\""), "leading dot is not aria-hidden:\n" + html);
    }

    @Test
    void stat_card_plain_variant_omits_the_left_accent_rail() {
        Map<String, Object> plain = new HashMap<>();
        plain.put("title", "Attività totali");
        plain.put("value", "128");
        plain.put("variant", "plain");
        String plainHtml = render("lievit/stat-card.jte", plain);
        assertFalse(plainHtml.contains("border-left-width:3px"),
                "plain stat-card must NOT draw the 3px left accent rail:\n" + plainHtml);

        // The default variant still draws the 3px rail (transparent, but present in the box model).
        Map<String, Object> def = new HashMap<>();
        def.put("title", "Attività totali");
        def.put("value", "128");
        String defHtml = render("lievit/stat-card.jte", def);
        assertTrue(defHtml.contains("border-left-width:3px"),
                "default stat-card lost its left rail (regression):\n" + defHtml);
    }

    @Test
    void selection_footer_renders_a_host_supplied_localized_label() {
        Map<String, Object> m = new HashMap<>();
        m.put("selected", 5);
        m.put("total", 12);
        m.put("label", "5 di 12 attività selezionate.");
        String html = render("lievit/data-table/selection-footer.jte", m);
        assertTrue(html.contains("5 di 12 attività selezionate."),
                "selection footer did not render the host-supplied label:\n" + html);
        assertFalse(html.contains("(s) selected"),
                "selection footer leaked the hardcoded English when a label was supplied:\n" + html);

        // Back-compat: no label supplied -> the legacy English fallback still renders.
        Map<String, Object> legacy = new HashMap<>();
        legacy.put("selected", 1);
        legacy.put("total", 4);
        String legacyHtml = render("lievit/data-table/selection-footer.jte", legacy);
        assertTrue(legacyHtml.contains("1 of 4 row(s) selected."),
                "selection footer broke the no-label back-compat fallback:\n" + legacyHtml);
    }

    @Test
    void selected_table_row_gets_a_left_accent_stripe_and_is_a_group() {
        Map<String, Object> m = new HashMap<>();
        m.put("state", "selected");
        m.put("content", text("<td>row</td>"));
        String html = render("lievit/table/row.jte", m);
        // `group` so a per-row action can reveal on hover (group-hover); selected-state left stripe.
        assertTrue(html.contains("group"), "table row is not a `group` (action reveal impossible):\n" + html);
        assertTrue(html.contains("data-[state=selected]:before:"),
                "selected row missing the left accent stripe (before pseudo):\n" + html);
    }
}
