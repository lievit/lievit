/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/**
 * Specifies the third-party plugin lookup contract layered on {@link Panel}: {@code hasPlugin} is a
 * boolean probe, {@code requirePlugin} fails loudly for an unknown id (the cross-plugin wiring
 * path), and a plugin can be configured fluently before registration.
 */
class PluginApiTest {

    /** A fluently-configurable plugin (the {@code TagsPlugin.make().separator(",")} shape). */
    static final class ConfigurablePlugin implements Plugin {
        private String separator = ";";

        static ConfigurablePlugin make() {
            return new ConfigurablePlugin();
        }

        ConfigurablePlugin separator(String separator) {
            this.separator = separator;
            return this;
        }

        String separator() {
            return separator;
        }

        @Override
        public String getId() {
            return "configurable";
        }

        @Override
        public void register(Panel panel) {}
    }

    /**
     * @spec.given a plugin configured fluently before registration
     * @spec.when  it is applied to a panel and looked up
     * @spec.then  hasPlugin is true and the looked-up plugin carries the configured value
     */
    @Test
    void a_plugin_is_configured_fluently_then_registered() {
        ConfigurablePlugin plugin = ConfigurablePlugin.make().separator(",");
        Panel panel = Panel.create("admin").plugin(plugin);

        assertThat(panel.hasPlugin("configurable")).isTrue();
        assertThat(((ConfigurablePlugin) panel.requirePlugin("configurable")).separator())
                .isEqualTo(",");
    }

    /**
     * @spec.given a panel with no plugin under an id
     * @spec.when  requirePlugin is called for that id
     * @spec.then  it throws a clear "not registered for panel" error
     */
    @Test
    void require_plugin_fails_loudly_for_an_unknown_id() {
        Panel panel = Panel.create("admin");

        assertThat(panel.hasPlugin("missing")).isFalse();
        assertThatThrownBy(() -> panel.requirePlugin("missing"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not registered for panel");
    }

    /**
     * @spec.given a plugin that reads an earlier-registered plugin in its boot phase
     * @spec.when  it is applied to a panel that already has the dependency
     * @spec.then  boot resolves the dependency via requirePlugin (cross-plugin wiring works)
     */
    @Test
    void a_plugin_reads_an_earlier_plugin_during_boot() {
        Panel panel = Panel.create("admin").plugin(ConfigurablePlugin.make().separator("|"));
        String[] seen = new String[1];

        panel.plugin(
                new Plugin() {
                    @Override
                    public String getId() {
                        return "dependent";
                    }

                    @Override
                    public void register(Panel p) {}

                    @Override
                    public void boot(Panel p) {
                        seen[0] = ((ConfigurablePlugin) p.requirePlugin("configurable")).separator();
                    }
                });

        assertThat(seen[0]).isEqualTo("|");
    }
}
