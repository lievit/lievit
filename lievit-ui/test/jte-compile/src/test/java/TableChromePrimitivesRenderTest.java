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
}
