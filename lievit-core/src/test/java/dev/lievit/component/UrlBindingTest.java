/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import dev.lievit.LievitAction;
import dev.lievit.LievitComponent;
import dev.lievit.LievitUrl;
import dev.lievit.LievitUrl.History;
import dev.lievit.Wire;

/**
 * Specifies {@code @LievitUrl} reflection (ADR-0001 phase 1, ADR-0012): a mount seeds a URL-bound
 * field from the host page's query parameters (honoring the {@code as} / {@code key} alias), and a
 * wire call emits the {@code url} effect carrying the new query string, dropping empty parameters
 * unless {@code keepEmpty} keeps them and choosing the history mode from the binding.
 */
class UrlBindingTest {

    private final WireDispatcher dispatcher = new WireDispatcher();

    @LievitComponent
    static class SearchBox {
        @Wire @LievitUrl String search = "";

        @LievitAction
        void clear() {
            this.search = "";
        }
    }

    @LievitComponent
    static class AliasedSearch {
        @Wire @LievitUrl(as = "q") String search = "";
    }

    @LievitComponent
    static class KeptEmpty {
        @Wire @LievitUrl(keepEmpty = true) String filter = "";
    }

    @LievitComponent
    static class Replacing {
        @Wire @LievitUrl(history = History.REPLACE) String tab = "";
    }

    /**
     * @spec.given a SearchBox mounted with a query string carrying {@code search=foo}
     * @spec.when  the dispatcher mounts it with that query-parameter map
     * @spec.then  the @LievitUrl field is initialized from the URL before render: search == "foo"
     * @spec.adr   ADR-0001
     * @spec.us    US-url-mount-from-query
     */
    @Test
    void mount_seeds_a_url_bound_field_from_the_query() {
        ComponentMetadata meta = ComponentMetadata.of(SearchBox.class);
        SearchBox instance = new SearchBox();

        dispatcher.mount(meta, instance, Map.of(), Map.of("search", "foo"));

        assertThat(instance.search).isEqualTo("foo");
    }

    /**
     * @spec.given a SearchBox mounted from a request with no matching query parameter
     * @spec.when  the dispatcher mounts it with an empty query-parameter map
     * @spec.then  the field keeps its mount-default (empty), not overwritten by an absent parameter
     * @spec.adr   ADR-0001
     * @spec.us    US-url-mount-from-query
     */
    @Test
    void mount_leaves_the_default_when_the_query_param_is_absent() {
        ComponentMetadata meta = ComponentMetadata.of(SearchBox.class);
        SearchBox instance = new SearchBox();

        dispatcher.mount(meta, instance, Map.of(), Map.of());

        assertThat(instance.search).isEmpty();
    }

    /**
     * @spec.given an AliasedSearch whose field maps to the alias {@code as = "q"}
     * @spec.when  the dispatcher mounts it with a query carrying {@code q=bar}
     * @spec.then  the alias is honored: the {@code q} parameter seeds the {@code search} field
     * @spec.adr   ADR-0012
     * @spec.us    US-url-alias
     */
    @Test
    void mount_honors_the_query_param_alias() {
        ComponentMetadata meta = ComponentMetadata.of(AliasedSearch.class);
        AliasedSearch instance = new AliasedSearch();

        dispatcher.mount(meta, instance, Map.of(), Map.of("q", "bar"));

        assertThat(instance.search).isEqualTo("bar");
    }

    /**
     * @spec.given a SearchBox whose search field changed to "spring" over a wire call
     * @spec.when  the dispatcher runs the call
     * @spec.then  the url effect carries the encoded query {@code search=spring}, push by default
     * @spec.adr   ADR-0012
     * @spec.us    US-url-update-effect
     */
    @Test
    void call_emits_the_url_effect_for_a_changed_field() {
        ComponentMetadata meta = ComponentMetadata.of(SearchBox.class);

        WireCall result =
                dispatcher.call(
                        meta,
                        new SearchBox(),
                        Map.of("search", ""),
                        Map.of("search", "spring"),
                        List.of());

        UrlEffect url = result.effects().url();
        assertThat(url).isNotNull();
        assertThat(url.query()).isEqualTo("search=spring");
        assertThat(url.history()).isEqualTo(History.PUSH);
        assertThat(result.effects().isEmpty()).isFalse();
    }

    /**
     * @spec.given a value containing reserved URL characters ({@code a & b = c})
     * @spec.when  the dispatcher emits the url effect for the changed field
     * @spec.then  the value is URL-encoded so it cannot break out of its parameter (injection-safe)
     * @spec.adr   ADR-0012
     * @spec.us    US-url-update-effect
     */
    @Test
    void call_url_encodes_the_emitted_value() {
        ComponentMetadata meta = ComponentMetadata.of(SearchBox.class);

        WireCall result =
                dispatcher.call(
                        meta,
                        new SearchBox(),
                        Map.of("search", ""),
                        Map.of("search", "a & b = c"),
                        List.of());

        UrlEffect url = result.effects().url();
        assertThat(url).isNotNull();
        assertThat(url.query()).isEqualTo("search=a+%26+b+%3D+c");
    }

    /**
     * @spec.given a SearchBox whose search is cleared to empty (keepEmpty defaults to false)
     * @spec.when  the dispatcher runs the clear action
     * @spec.then  the empty parameter is removed: the url effect query is empty (no {@code search=})
     * @spec.adr   ADR-0012
     * @spec.us    US-url-keep-empty
     */
    @Test
    void call_drops_an_empty_param_when_keep_empty_is_false() {
        ComponentMetadata meta = ComponentMetadata.of(SearchBox.class);

        WireCall result =
                dispatcher.call(
                        meta,
                        new SearchBox(),
                        Map.of("search", "foo"),
                        Map.of(),
                        List.of("clear"));

        UrlEffect url = result.effects().url();
        assertThat(url).isNotNull();
        assertThat(url.query()).isEmpty();
    }

    /**
     * @spec.given a KeptEmpty whose @LievitUrl sets keepEmpty=true and whose value is empty
     * @spec.when  the dispatcher runs a no-op call leaving the field empty
     * @spec.then  the empty parameter is kept: the url effect query is {@code filter=}
     * @spec.adr   ADR-0012
     * @spec.us    US-url-keep-empty
     */
    @Test
    void call_keeps_an_empty_param_when_keep_empty_is_true() {
        ComponentMetadata meta = ComponentMetadata.of(KeptEmpty.class);

        WireCall result =
                dispatcher.call(
                        meta, new KeptEmpty(), Map.of("filter", ""), Map.of(), List.of());

        UrlEffect url = result.effects().url();
        assertThat(url).isNotNull();
        assertThat(url.query()).isEqualTo("filter=");
    }

    /**
     * @spec.given a Replacing component whose @LievitUrl uses history = REPLACE
     * @spec.when  the dispatcher emits the url effect for the changed field
     * @spec.then  the effect requests replaceState (no new back-stack entry)
     * @spec.adr   ADR-0012
     * @spec.us    US-url-history-mode
     */
    @Test
    void call_emits_replace_history_when_the_binding_requests_it() {
        ComponentMetadata meta = ComponentMetadata.of(Replacing.class);

        WireCall result =
                dispatcher.call(
                        meta,
                        new Replacing(),
                        Map.of("tab", ""),
                        Map.of("tab", "details"),
                        List.of());

        UrlEffect url = result.effects().url();
        assertThat(url).isNotNull();
        assertThat(url.query()).isEqualTo("tab=details");
        assertThat(url.history()).isEqualTo(History.REPLACE);
    }

    /**
     * @spec.given a component with no @LievitUrl field (the plain Counter shape)
     * @spec.when  the dispatcher runs a call
     * @spec.then  no url effect is produced: the effects sink stays empty for an URL-less component
     * @spec.adr   ADR-0012
     * @spec.us    US-url-update-effect
     */
    @Test
    void call_emits_no_url_effect_for_a_component_without_url_fields() {
        ComponentMetadata meta = ComponentMetadata.of(WireDispatcherTest.Counter.class);

        WireCall result =
                dispatcher.call(
                        meta,
                        new WireDispatcherTest.Counter(),
                        Map.of("count", 0),
                        Map.of(),
                        List.of("increment"));

        assertThat(result.effects().url()).isNull();
        assertThat(result.effects().isEmpty()).isTrue();
    }

    /**
     * @spec.given a component class with two @LievitUrl fields, one aliased
     * @spec.when  its metadata is reflected
     * @spec.then  urlBoundFields lists exactly the URL-bound fields with their resolved keys
     * @spec.adr   ADR-0012
     * @spec.us    US-url-metadata
     */
    @Test
    void metadata_lists_url_bound_fields_with_resolved_keys() {
        ComponentMetadata meta = ComponentMetadata.of(AliasedSearch.class);

        Map<String, WireField> bound = meta.urlBoundFields();

        assertThat(bound).containsOnlyKeys("search");
        UrlBinding binding = bound.get("search").url();
        assertThat(binding).isNotNull();
        assertThat(binding.key()).isEqualTo("q");
        assertThat(binding.keepEmpty()).isFalse();
        assertThat(binding.history()).isEqualTo(History.PUSH);
    }
}
