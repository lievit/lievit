/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.wire;

import java.util.LinkedHashMap;
import java.util.Map;

import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

import io.lievit.kit.schema.infolist.Infolist;
import io.lievit.kit.schema.infolist.InfolistFieldset;
import io.lievit.kit.schema.infolist.InfolistGrid;
import io.lievit.kit.schema.infolist.InfolistSection;
import io.lievit.kit.schema.infolist.InfolistTab;
import io.lievit.kit.schema.infolist.InfolistTabs;
import io.lievit.kit.schema.infolist.KeyValueEntry;
import io.lievit.kit.schema.infolist.TextEntry;

/**
 * Minimal Spring Boot app for the layout-bearing infolist (Section / Tabs / Fieldset / Grid /
 * KeyValue) wire end-to-end test. It wires a single {@link InfolistViewComponent} (prototype, the
 * stateless wire contract) over a fixed infolist + record fixture that exercises every node kind in
 * one tree, so {@link InfolistLayoutComponentIT} can assert the nested render through the real
 * runtime (codec + registry + dispatcher + JTE adapter).
 */
@SpringBootApplication
public class InfolistTreeWireTestApp {

    /**
     * The fixture infolist: a tabs container (Overview + Details) where Details holds a section with
     * a 2-column grid + a fieldset + a key-value entry. Exercises Section / Tabs / Fieldset / Grid /
     * KeyValueEntry + per-entry columnSpan in one tree.
     *
     * @return the layout-bearing infolist
     */
    static Infolist fixtureInfolist() {
        return Infolist.make()
                .schema(
                        InfolistTabs.make(
                                        InfolistTab.make("Overview")
                                                .icon("info")
                                                .columns(2)
                                                .schema(
                                                        TextEntry.make("ref"),
                                                        TextEntry.make("city").placeholder("-")),
                                        InfolistTab.make("Details")
                                                .schema(
                                                        InfolistSection.make("Address")
                                                                .description("Where it is")
                                                                .icon("map-pin")
                                                                .collapsible()
                                                                .columns(2)
                                                                .schema(
                                                                        InfolistGrid.make(2)
                                                                                .schema(
                                                                                        TextEntry.make("street"),
                                                                                        TextEntry.make("zip")),
                                                                        InfolistFieldset.make("Pricing")
                                                                                .columns(1)
                                                                                .columnSpan(2)
                                                                                .schema(
                                                                                        TextEntry.make("price")
                                                                                                .columnSpan(2)),
                                                                        KeyValueEntry.make("features")
                                                                                .keyLabel("Feature")
                                                                                .valueLabel("Detail")
                                                                                .columnSpan(2))))
                                .activeTab("Overview")
                                .persistTabInQueryString()
                                .contained());
    }

    /**
     * The fixture record the infolist resolves against.
     *
     * @return the record attributes keyed by path
     */
    static Map<String, @Nullable Object> fixtureRecord() {
        Map<String, @Nullable Object> record = new LinkedHashMap<>();
        record.put("ref", "1");
        record.put("city", "Parma");
        record.put("street", "Via Roma 1");
        record.put("zip", "43121");
        record.put("price", "250000");
        Map<String, String> features = new LinkedHashMap<>();
        features.put("Garden", "Yes");
        features.put("Floor", "3");
        record.put("features", features);
        return record;
    }

    /**
     * @return a fresh infolist-view component per wire call, over the fixture
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    InfolistViewComponent infolistViewComponent() {
        return new InfolistViewComponent(fixtureInfolist(), fixtureRecord());
    }
}
