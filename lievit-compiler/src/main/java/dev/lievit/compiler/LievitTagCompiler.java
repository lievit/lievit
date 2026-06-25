/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.compiler;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Compiles a {@code <lievit:...>} tag string into a {@link CompiledTag} mount declaration (ADR-0023,
 * issue #175; the lievit analogue of Livewire's {@code LivewireTagPrecompiler}). It handles the four
 * tag forms (opening / self-closing / closing / slot-open), splits bound ({@code :attr}) from literal
 * attributes, kebab-&gt;camel's attribute names to {@code @Wire} field names, extracts the explicit
 * key ({@code wire:key}/{@code l:key}/{@code key}) and the reserved params ({@code lazy},
 * {@code defer}, {@code wire:ref}/{@code l:ref}), recognizes the dynamic-component form
 * ({@code :is="expr"}), and maps the {@code <lievit:styles>}/{@code <lievit:scripts>} asset shortcuts.
 *
 * <p>It is the <strong>parse step only</strong>: it produces a pure-data {@link CompiledTag}, never
 * mounts a component, never evaluates a bound expression, and never emits HTML. Lowering a
 * {@link CompiledTag} to a {@link dev.lievit.component.LievitChildren} child call (with an explicit or
 * a {@link DeterministicKeys}-generated key) is the render layer's job, which keeps the dispatcher,
 * codec, and HTTP edge untouched (ADR-0007/0018). Pure Java, zero Spring, zero reflection.
 */
public final class LievitTagCompiler {

    // <lievit:name ...attrs... />  |  <lievit:name ...attrs...>  |  </lievit:name>
    private static final Pattern TAG =
            Pattern.compile(
                    "^\\s*<\\s*(/)?\\s*lievit:([a-zA-Z][\\w-]*)\\s*(.*?)\\s*(/)?\\s*>\\s*$",
                    Pattern.DOTALL);

    // one attribute: name(:bound, wire:key, or @event etc.) optionally = "value" or = 'value'
    private static final Pattern ATTR =
            Pattern.compile(
                    "([:@a-zA-Z][\\w:.-]*)\\s*(?:=\\s*(?:\"([^\"]*)\"|'([^']*)'))?");

    /**
     * Compiles one {@code <lievit:...>} tag.
     *
     * @param tag the tag source (a single tag, with its angle brackets)
     * @return the parsed mount declaration
     * @throws IllegalArgumentException if {@code tag} is not a {@code lievit:} tag
     */
    public CompiledTag compile(String tag) {
        Matcher m = TAG.matcher(tag);
        if (!m.matches()) {
            throw new IllegalArgumentException(
                    "not a <lievit:...> tag: " + tag);
        }
        boolean closing = m.group(1) != null;
        String name = m.group(2);
        String attrSource = m.group(3) == null ? "" : m.group(3);
        boolean selfClosing = m.group(4) != null;

        // Asset shortcuts: <lievit:styles/> and <lievit:scripts/> are not component mounts.
        if (!closing && "styles".equals(name)) {
            return assetTag(name, CompiledTag.AssetKind.STYLES, selfClosing);
        }
        if (!closing && "scripts".equals(name)) {
            return assetTag(name, CompiledTag.AssetKind.SCRIPTS, selfClosing);
        }

        Map<String, String> literal = new LinkedHashMap<>();
        Map<String, String> bound = new LinkedHashMap<>();
        Map<String, String> events = new LinkedHashMap<>();
        Optional<String> key = Optional.empty();
        Optional<String> ref = Optional.empty();
        Optional<String> isExpr = Optional.empty();
        boolean lazy = false;
        boolean defer = false;

        if (!closing) {
            Matcher a = ATTR.matcher(attrSource);
            while (a.find()) {
                String rawName = a.group(1);
                String value = a.group(2) != null ? a.group(2) : a.group(3); // null for valueless
                switch (rawName) {
                    case "wire:key", "l:key", "key" -> key = Optional.ofNullable(value);
                    case "wire:ref", "l:ref" -> ref = Optional.ofNullable(value);
                    case "lazy", "lazy.bundle" -> lazy = true;
                    case "defer" -> defer = true;
                    case ":is" -> isExpr = Optional.ofNullable(value);
                    default -> {
                        if (rawName.startsWith("@") && rawName.length() > 1) {
                            // Nested-component event listener (#69): @saved="refresh" wires the parent
                            // to handle the child-emitted `saved` event with its `refresh` action. The
                            // event name keeps its authored kebab form (DOM events are case-sensitive).
                            events.put(rawName.substring(1), value == null ? "" : value);
                        } else if (rawName.startsWith(":")) {
                            // Bound expression attribute: :user-id="u.id" -> userId.
                            bound.put(kebabToCamel(rawName.substring(1)), value == null ? "" : value);
                        } else if (!rawName.contains(":")) {
                            // Literal attribute. Reserved-namespaced attrs (wire:*, l:*) we don't
                            // recognize are dropped, not seeded as props.
                            literal.put(kebabToCamel(rawName), value == null ? "" : value);
                        }
                    }
                }
            }
        }

        boolean dynamic = isExpr.isPresent();
        return new CompiledTag(
                name,
                literal,
                bound,
                key,
                ref,
                lazy,
                defer,
                closing,
                selfClosing,
                dynamic,
                isExpr,
                Optional.empty(),
                events);
    }

    private static CompiledTag assetTag(
            String name, CompiledTag.AssetKind kind, boolean selfClosing) {
        return new CompiledTag(
                name,
                Map.of(),
                Map.of(),
                Optional.empty(),
                Optional.empty(),
                false,
                false,
                false,
                selfClosing,
                false,
                Optional.empty(),
                Optional.of(kind),
                Map.of());
    }

    /**
     * Converts a kebab-case attribute name to the camelCase {@code @Wire} field name Livewire's tag
     * precompiler targets ({@code user-id} -&gt; {@code userId}). A name with no dash is unchanged.
     */
    static String kebabToCamel(String name) {
        if (name.indexOf('-') < 0) {
            return name;
        }
        StringBuilder out = new StringBuilder(name.length());
        boolean upper = false;
        for (int i = 0; i < name.length(); i++) {
            char c = name.charAt(i);
            if (c == '-') {
                upper = true;
            } else if (upper) {
                out.append(Character.toUpperCase(c));
                upper = false;
            } else {
                out.append(c);
            }
        }
        return out.toString();
    }
}
