/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.jspecify.annotations.Nullable;

import dev.lievit.LievitUrl.History;

/**
 * The two halves of {@code @LievitUrl} reflection, as pure data transforms (no reflection beyond the
 * already-reflected {@link WireField}, no Spring, no servlet types): seed URL-bound fields from a
 * query-parameter map on mount, and build the {@link UrlEffect} from the fields' current values
 * after a wire call (ADR-0001, ADR-0012).
 *
 * <p>The web layer in the starter owns turning an {@code HttpServletRequest}'s query parameters into
 * the {@code Map<String,String>} this class consumes, and turning the {@link UrlEffect} into the
 * {@code Lievit-Effects} header; this class is the engine-agnostic core so it is unit-testable
 * headless (the harness invariant).
 *
 * <p><strong>Security.</strong> {@link #seedFromQuery} only ever writes a String into a String field
 * (a query parameter is text); it never coerces a query value into another type, never interprets it
 * as a navigation target, and never touches a non-{@code @LievitUrl} field. {@link #buildEffect}
 * URL-encodes every emitted key and value, so a value containing {@code &}, {@code =}, {@code #}, or
 * a CRLF cannot break out of its parameter or inject a header (the effect is header-encoded
 * downstream).
 */
public final class UrlQueryBinder {

    private UrlQueryBinder() {}

    /**
     * Seeds the component's {@code @LievitUrl} String fields from the host page's query parameters,
     * during mount and before render. A field whose query parameter is absent keeps its
     * mount-default; a present parameter (even empty) overwrites it.
     *
     * <p>Only String-typed URL-bound fields are seeded in v0.1: a query parameter is text, and
     * binding it straight to a String avoids any client-driven type coercion (the canonical {@code
     * ?search=...} case). A URL-bound field of another type is left to its mount-default (a future
     * typed-conversion hook can extend this without changing the contract).
     *
     * @param metadata the component metadata
     * @param instance the freshly constructed component instance (post-{@code @LievitMount})
     * @param queryParams the host request's query parameters (first value per key), never null
     */
    public static void seedFromQuery(
            ComponentMetadata metadata, Object instance, Map<String, String> queryParams) {
        for (WireField field : metadata.urlBoundFields().values()) {
            UrlBinding binding = field.url();
            if (binding == null) {
                continue;
            }
            if (!queryParams.containsKey(binding.key())) {
                continue;
            }
            if (field.field().getType() != String.class) {
                // Only String fields are seeded from the query in v0.1 (see javadoc); leave others.
                continue;
            }
            field.write(instance, queryParams.get(binding.key()));
        }
    }

    /**
     * Builds the {@link UrlEffect} describing the query string the client should reflect after this
     * call, from the current values of the component's {@code @LievitUrl} fields. Returns {@code
     * null} when the component has no URL-bound field (so no effect, no header).
     *
     * <p>An empty / null field value drops its parameter unless the binding sets {@code keepEmpty}.
     * The history mode is taken from the bindings: if any participating field requests {@code PUSH},
     * the effect pushes (a real navigation step wins over a silent replace); only when every emitted
     * field is {@code REPLACE} does the effect replace.
     *
     * @param metadata the component metadata
     * @param instance the component instance after the actions / updates have run
     * @return the URL effect to emit, or {@code null} if the component reflects nothing into the URL
     */
    public static @Nullable UrlEffect buildEffect(ComponentMetadata metadata, Object instance) {
        Map<String, WireField> bound = metadata.urlBoundFields();
        if (bound.isEmpty()) {
            return null;
        }
        StringBuilder query = new StringBuilder();
        History history = History.REPLACE;
        for (WireField field : bound.values()) {
            UrlBinding binding = field.url();
            if (binding == null) {
                continue;
            }
            Object raw = field.read(instance);
            String value = raw == null ? "" : raw.toString();
            boolean empty = value.isEmpty();
            if (empty && !binding.keepEmpty()) {
                continue;
            }
            if (binding.history() == History.PUSH) {
                history = History.PUSH;
            }
            if (query.length() > 0) {
                query.append('&');
            }
            query.append(encode(binding.key())).append('=').append(encode(value));
        }
        return new UrlEffect(query.toString(), history);
    }

    private static String encode(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }
}
