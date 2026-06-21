/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * RENDER gate for the lievit-kit canonical VIEW (detail) chrome (kit/infolist.jte + sub-parts).
 *
 * The precompile smoke (the jte-maven-plugin `generate` goal in this module's pom) proves the
 * template COMPILES against io.lievit.kit + the lievit-ui partials; it cannot prove the detail chrome
 * actually RENDERS. This does: it builds a real layout-bearing Infolist fixture (Tabs -> Section ->
 * Grid + Fieldset + the typed-entry leaves + a KeyValueEntry), resolves it into an AdminViewView (the
 * structured tree path), wraps it in a KitInfolistView (heading + header actions + back href),
 * source-renders kit/infolist.jte on the fly (the same gg.jte 3.2.4 compiler, ContentType.Html,
 * DirectoryCodeResolver over the staged target/jte-src tree), and asserts the chrome lands.
 */
package io.lievit.kit.jtecompile;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import gg.jte.ContentType;
import gg.jte.TemplateEngine;
import gg.jte.output.StringOutput;
import gg.jte.resolve.DirectoryCodeResolver;
import io.lievit.kit.AdminViewView;
import io.lievit.kit.page.KitInfolistView;
import io.lievit.kit.schema.infolist.CodeEntry;
import io.lievit.kit.schema.infolist.ColorEntry;
import io.lievit.kit.schema.infolist.IconEntry;
import io.lievit.kit.schema.infolist.ImageEntry;
import io.lievit.kit.schema.infolist.Infolist;
import io.lievit.kit.schema.infolist.InfolistFieldset;
import io.lievit.kit.schema.infolist.InfolistGrid;
import io.lievit.kit.schema.infolist.InfolistSection;
import io.lievit.kit.schema.infolist.InfolistTab;
import io.lievit.kit.schema.infolist.InfolistTabs;
import io.lievit.kit.schema.infolist.KeyValueEntry;
import io.lievit.kit.schema.infolist.TextEntry;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class KitInfolistRenderTest {

    /** The staged template tree: kit/infolist.jte + the lievit/* partials, under target/jte-src. */
    private static final Path JTE_DIR = Path.of("target", "jte-src");

    private static final TemplateEngine ENGINE =
            TemplateEngine.create(new DirectoryCodeResolver(JTE_DIR), ContentType.Html);

    /** Renders the staged kit/infolist.jte with the given model. */
    private String render(Map<String, Object> model) {
        StringOutput out = new StringOutput();
        ENGINE.render("kit/infolist.jte", model, out);
        return out.toString();
    }

    /**
     * The fixture record: a flat attribute map a real flattened domain object would produce, covering
     * each typed entry kind plus a real map for the KeyValueEntry.
     */
    private static Map<String, Object> record() {
        Map<String, Object> rec = new HashMap<>();
        rec.put("name", "Villa Aurora");
        rec.put("status", "Published");
        rec.put("verified", Boolean.TRUE);
        rec.put("cover", "/img/villa.jpg");
        rec.put("accent", "#1d4ed8");
        rec.put("payload", "{\"ok\":true}");
        Map<String, String> features = new LinkedHashMap<>();
        features.put("Garden", "Yes");
        features.put("Floor", "3");
        rec.put("features", features);
        return rec;
    }

    /**
     * A layout-bearing infolist: a Tabs(Overview, Details). Overview holds a Grid(2) of the typed-entry
     * leaves (text / icon / image / color / code) and a KeyValueEntry; Details holds a titled,
     * collapsible Section wrapping a Fieldset of one text entry.
     */
    private static Infolist infolist() {
        InfolistGrid grid =
                InfolistGrid.make(2)
                        .schema(
                                TextEntry.make("name"),
                                IconEntry.make("verified").booleanIcons("check", "x"),
                                ImageEntry.make("cover").circular(40),
                                ColorEntry.make("accent"),
                                CodeEntry.make("payload").language("json"),
                                KeyValueEntry.make("features").keyLabel("Feature").valueLabel("Has"));

        InfolistFieldset fieldset =
                InfolistFieldset.make("Status").columnSpan(2).schema(TextEntry.make("status"));

        InfolistSection address =
                InfolistSection.make("Address")
                        .description("Where it is")
                        .icon("map-pin")
                        .collapsible()
                        .columns(2)
                        .schema(fieldset);

        InfolistTabs tabs =
                InfolistTabs.make(
                                InfolistTab.make("Overview").columns(2).schema(grid),
                                InfolistTab.make("Details").schema(address))
                        .activeTab("Overview")
                        .contained();

        return Infolist.make().schema(tabs).columns(2);
    }

    /** Builds the populated detail model: the resolved view-model wrapped in a KitInfolistView. */
    private Map<String, Object> populatedModel() {
        AdminViewView view =
                AdminViewView.of(
                        "Property",
                        "42",
                        infolist(),
                        record(),
                        List.of(
                                AdminViewView.HeaderAction.primary("Edit", "/admin/properties/42/edit"),
                                AdminViewView.HeaderAction.secondary("Back", "/admin/properties")));
        KitInfolistView bundle = KitInfolistView.of(view).withBackHref("/admin/properties");

        Map<String, Object> model = new HashMap<>();
        model.put("infolist", bundle);
        return model;
    }

    /**
     * @spec.given a resolved detail view-model with a heading + primary/secondary header actions
     * @spec.when  the kit infolist chrome is rendered
     * @spec.then  the heading + the Edit (primary) and Back (secondary) header-action <a href> buttons land
     */
    @Test
    void renders_the_heading_and_the_header_action_toolbar() {
        String html = render(populatedModel());

        assertTrue(html.contains("data-slot=\"kit-infolist\""), "kit-infolist root missing:\n" + html);
        assertTrue(html.contains("Property"), "heading missing:\n" + html);
        assertTrue(html.contains("/admin/properties/42/edit"), "edit header-action href missing");
        assertTrue(html.contains("admin-view-action=\"Edit\""), "edit action marker missing");
        assertTrue(html.contains("Back"), "back action label missing");
    }

    /**
     * @spec.given a layout-bearing infolist whose root is a contained Tabs(Overview, Details)
     * @spec.when  the chrome is rendered
     * @spec.then  the server-first tabs strip lands with both tab triggers and Overview the active tab
     */
    @Test
    void renders_the_tabs_layout_through_the_lievit_tabs_partial() {
        String html = render(populatedModel());

        assertTrue(html.contains("role=\"tablist\""), "tabs strip missing:\n" + html);
        assertTrue(html.contains("data-slot=\"tabs-trigger\""), "a tab trigger missing");
        assertTrue(html.contains("Overview"), "Overview tab label missing");
        assertTrue(html.contains("Details"), "Details tab label missing");
        // Overview is the active tab (server-owned active state).
        assertTrue(
                html.contains("id=\"lv-tab-overview\"") && html.contains("aria-selected=\"true\""),
                "active tab state missing:\n" + html);
    }

    /**
     * @spec.given the Overview tab holds a Grid of typed-entry leaves laid out as a description-list
     * @spec.when  the chrome is rendered
     * @spec.then  the description-list grid + the typed infolist-entry leaves (icon / image / color /
     *     code) all land through the lievit-ui partials, not bare text
     */
    @Test
    void renders_the_typed_entry_leaves_through_the_infolist_entry_partial() {
        String html = render(populatedModel());

        // The grid of leaves is a real <dl> description list.
        assertTrue(html.contains("data-slot=\"description-list\""), "description-list missing:\n" + html);
        assertTrue(html.contains("data-slot=\"description-list-term\""), "a dt term missing");
        // The typed leaves dispatch by kind through the infolist-entry partial.
        assertTrue(html.contains("data-type=\"icon\""), "icon entry not rendered through infolist-entry");
        assertTrue(html.contains("data-type=\"image\""), "image entry not rendered through infolist-entry");
        assertTrue(html.contains("data-type=\"color\""), "color entry not rendered through infolist-entry");
        assertTrue(html.contains("data-type=\"code\""), "code entry not rendered through infolist-entry");
        // The plain text leaf carries its projected value.
        assertTrue(html.contains("Villa Aurora"), "text leaf value missing");
    }

    /**
     * @spec.given a KeyValueEntry over a record whose "features" attribute is a real map
     * @spec.when  the chrome resolves through the structured tree and renders
     * @spec.then  the key-value table lands with the configured headers and one row per map entry,
     *     proving resolveMap is reached end-to-end (not flattened to String.valueOf(map))
     */
    @Test
    void renders_the_keyvalue_entry_map_as_a_two_column_table() {
        String html = render(populatedModel());

        assertTrue(html.contains("data-slot=\"infolist-keyvalue\""), "key-value table missing:\n" + html);
        assertTrue(html.contains("Feature"), "key column header missing");
        assertTrue(html.contains("Garden"), "a key-value key missing");
        assertTrue(html.contains("Yes"), "a key-value value missing");
        // NOT flattened to a java map toString.
        assertFalse(html.contains("{Garden=Yes"), "the map was flattened, resolveMap not reached:\n" + html);
    }

    /**
     * @spec.given the Details tab holds a titled, collapsible Section wrapping a Fieldset
     * @spec.when  the chrome is rendered
     * @spec.then  the Section heading + description + the collapsible <details> disclosure land, and
     *     the nested Fieldset renders its legend: proving the section/fieldset containers compose
     */
    @Test
    void renders_the_section_and_fieldset_containers() {
        String html = render(populatedModel());

        assertTrue(html.contains("data-slot=\"section\""), "section container missing:\n" + html);
        assertTrue(html.contains("Address"), "section heading missing");
        assertTrue(html.contains("Where it is"), "section description missing");
        // Collapsible section is a native <details> disclosure.
        assertTrue(html.contains("<details"), "collapsible section not a <details> disclosure");
        // The nested fieldset legend.
        assertTrue(html.contains("data-slot=\"infolist-fieldset\""), "fieldset container missing");
        assertTrue(html.contains("Status"), "fieldset legend missing");
    }

    /**
     * @spec.given a view-model built without a structured tree (an empty tree) but with flat sections
     * @spec.when  the chrome is rendered
     * @spec.then  it falls back to the flat sections path: a description-list of the label->value
     *     entries, proving the chrome degrades when a host supplied only the flat projection
     */
    @Test
    void falls_back_to_the_flat_sections_when_no_tree_is_present() {
        Map<String, String> entries = new LinkedHashMap<>();
        entries.put("Name", "Villa Aurora");
        entries.put("Status", "Published");
        AdminViewView.Section section = new AdminViewView.Section(null, entries, 1);
        // The 4-arg constructor builds an empty tree (the back-compat path).
        AdminViewView view = new AdminViewView("Property", "42", List.of(section), List.of());
        KitInfolistView bundle = KitInfolistView.of(view).withBackHref("/admin/properties");

        Map<String, Object> model = new HashMap<>();
        model.put("infolist", bundle);
        String html = render(model);

        assertFalse(view.hasTree(), "the fixture should carry no tree");
        assertTrue(html.contains("data-slot=\"description-list\""), "flat description-list missing:\n" + html);
        assertTrue(html.contains("Villa Aurora"), "flat entry value missing");
        // No header actions => the implicit back button shows.
        assertTrue(html.contains("admin-view-action=\"Back\""), "implicit back button missing");
    }
}
