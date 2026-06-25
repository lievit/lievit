/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.dsl;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import org.jspecify.annotations.Nullable;

/**
 * An HTML element: a tag name, an ordered list of {@link Attr}, and an ordered list of {@link Html}
 * children (ADR-0018). Immutable; the fluent {@code attr(...)} / {@code attrs(...)} methods return a
 * <em>new</em> element with the attribute appended, so an element value can be shared and reused
 * without aliasing surprises.
 *
 * <p>A {@code void} element (one of {@code area base br col embed hr img input link meta param source
 * track wbr}) renders self-closing and rejects children at render time; everything else renders an
 * open tag, its children, and a close tag. The tag name is validated at construction (the same
 * grammar as {@link Attr} names), so an attacker-influenced tag cannot break the markup.
 */
public final class Element implements Html {

    private static final Set<String> VOID_ELEMENTS =
            Set.of(
                    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
                    "param", "source", "track", "wbr");

    private final String tag;
    private final List<Attr> attributes;
    private final List<Html> children;

    Element(String tag, List<Attr> attributes, List<Html> children) {
        if (!isValidName(tag)) {
            throw new IllegalArgumentException("invalid HTML tag name: \"" + tag + "\"");
        }
        this.tag = tag;
        this.attributes = List.copyOf(attributes);
        this.children = List.copyOf(children);
    }

    /**
     * Returns a copy of this element with one more attribute appended.
     *
     * @param name the attribute name (validated)
     * @param value the attribute value (escaped on render); {@code null} for a boolean attribute
     * @return a new element carrying the attribute
     */
    public Element attr(String name, @Nullable String value) {
        List<Attr> next = new ArrayList<>(attributes);
        next.add(new Attr(name, value));
        return new Element(tag, next, children);
    }

    /**
     * Returns a copy of this element with a boolean (value-less) attribute appended, e.g. {@code
     * disabled}.
     *
     * @param name the attribute name (validated)
     * @return a new element carrying the attribute
     */
    public Element attr(String name) {
        return attr(name, null);
    }

    /**
     * Binds a click to a {@code @LievitAction} ({@code l:click="action"}, wire-protocol.md §5). The
     * action name is the value; it crosses the wire as a {@code _calls} entry the dispatcher resolves
     * against the {@code @LievitAction} allowlist (ADR-0013), so a non-action name is refused server
     * side, never executed.
     *
     * @param action the {@code @LievitAction} method name to invoke on click
     * @return a new element carrying {@code l:click}
     */
    public Element wireClick(String action) {
        return attr("l:click", action);
    }

    /**
     * Binds a form submit to a {@code @LievitAction} ({@code l:submit="action"}). The client prevents
     * the native submit and issues the wire call.
     *
     * @param action the {@code @LievitAction} method name to invoke on submit
     * @return a new element carrying {@code l:submit}
     */
    public Element wireSubmit(String action) {
        return attr("l:submit", action);
    }

    /**
     * Binds Enter-keydown to a {@code @LievitAction} ({@code l:keydown.enter="action"}).
     *
     * @param action the {@code @LievitAction} method name to invoke on Enter
     * @return a new element carrying {@code l:keydown.enter}
     */
    public Element wireKeydownEnter(String action) {
        return attr("l:keydown.enter", action);
    }

    /**
     * Two-way binds an input to a {@code @Wire} field ({@code l:model="field"}, deferred by default,
     * wire-protocol.md §5). The field name crosses the wire as an {@code _updates} key the dispatcher
     * binds only if it names a {@code @Wire} field (the settable allowlist, ADR-0013).
     *
     * @param field the {@code @Wire} field name to bind
     * @return a new element carrying {@code l:model}
     */
    public Element wireModel(String field) {
        return attr("l:model", field);
    }

    /**
     * Two-way binds an input live ({@code l:model.live="field"}: sends on every input event,
     * debounced ~150 ms; use sparingly, wire-protocol.md §5).
     *
     * @param field the {@code @Wire} field name to bind
     * @return a new element carrying {@code l:model.live}
     */
    public Element wireModelLive(String field) {
        return attr("l:model.live", field);
    }

    /**
     * @return the tag name
     */
    public String tag() {
        return tag;
    }

    /**
     * @return the attributes, in order (unmodifiable)
     */
    public List<Attr> attributes() {
        return attributes;
    }

    /**
     * @return the children, in order (unmodifiable)
     */
    public List<Html> children() {
        return children;
    }

    @Override
    public void renderTo(StringBuilder out) {
        out.append('<').append(tag);
        for (Attr attr : attributes) {
            attr.renderTo(out);
        }
        if (VOID_ELEMENTS.contains(tag)) {
            if (!children.isEmpty()) {
                throw new IllegalStateException(
                        "void element <" + tag + "> cannot have children");
            }
            out.append('>');
            return;
        }
        out.append('>');
        for (Html child : children) {
            child.renderTo(out);
        }
        out.append("</").append(tag).append('>');
    }

    private static boolean isValidName(String name) {
        if (name == null || name.isEmpty()) {
            return false;
        }
        for (int i = 0; i < name.length(); i++) {
            char c = name.charAt(i);
            if (c <= ' '
                    || c == '='
                    || c == '"'
                    || c == '\''
                    || c == '/'
                    || c == '<'
                    || c == '>'
                    || c == '&'
                    || c == 0x7F) {
                return false;
            }
        }
        return true;
    }
}
