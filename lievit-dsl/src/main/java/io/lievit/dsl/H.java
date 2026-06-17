/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.dsl;

import java.util.List;

/**
 * The single-file DSL factory: the static entry points an author imports to build a type-safe HTML
 * tree (ADR-0003, ADR-0018). Import statically and write the view inline:
 *
 * <pre>{@code
 * import static io.lievit.dsl.H.*;
 *
 * @LievitRender
 * Html view() {
 *     return div(
 *         button(text("-")).wireClick("decrement"),
 *         span(text(count)).attr("data-lievit-count", ""),
 *         button(text("+")).wireClick("increment")
 *     );
 * }
 * }</pre>
 *
 * <p>{@link #text(Object)} is the escaped content path (a {@code @Wire} value carrying markup is
 * shown inert); {@link #raw(String)} is the single explicit escape hatch. The factories cover the
 * common HTML elements; {@link #el(String, Html...)} builds any other tag, with the same
 * name-validation and escaping. There is deliberately <strong>no</strong> factory for an inline
 * {@code <script>} body or an {@code on*} handler attribute path: page behaviour lives in client
 * modules, which keeps the output CSP-safe by construction (ADR-0018), the same rule the JTE
 * templates obey.
 *
 * <p>Pure data, zero Spring, zero reflection (ADR-0006).
 */
public final class H {

    private H() {}

    // --- content -------------------------------------------------------------------------------

    /**
     * Escaped text content. The value's {@code String.valueOf} is escaped for element position, so a
     * {@code @Wire String} carrying {@code <script>} is rendered inert (ADR-0018).
     *
     * @param value any value (numbers, booleans, a {@code @Wire} field); {@code null} renders empty
     * @return a text node
     */
    public static Html text(Object value) {
        return new TextNode(value == null ? "" : String.valueOf(value));
    }

    /**
     * Pre-trusted markup, emitted verbatim with no escaping: the single audit-visible escape hatch
     * (ADR-0018). Pass only server-provenance / already-sanitized markup.
     *
     * @param html the trusted markup
     * @return a raw node
     */
    public static Html raw(String html) {
        return new RawNode(html);
    }

    /**
     * A group of sibling nodes with no wrapping element (the React-fragment analogue).
     *
     * @param children the siblings, in order
     * @return a fragment
     */
    public static Html fragment(Html... children) {
        return new Fragment(List.of(children));
    }

    // --- generic element -----------------------------------------------------------------------

    /**
     * Any element by tag name, with children. The tag is validated; use this for tags without a
     * dedicated factory below.
     *
     * @param tag the tag name
     * @param children the child nodes
     * @return the element
     */
    public static Element el(String tag, Html... children) {
        return new Element(tag, List.of(), List.of(children));
    }

    // --- common elements (curated, not exhaustive) ---------------------------------------------

    /** {@code <div>}. */
    public static Element div(Html... children) {
        return el("div", children);
    }

    /** {@code <span>}. */
    public static Element span(Html... children) {
        return el("span", children);
    }

    /** {@code <p>}. */
    public static Element p(Html... children) {
        return el("p", children);
    }

    /** {@code <button>} (type defaults to the browser default; set {@code type} via {@code attr}). */
    public static Element button(Html... children) {
        return el("button", children);
    }

    /** {@code <a>}. */
    public static Element a(Html... children) {
        return el("a", children);
    }

    /** {@code <ul>}. */
    public static Element ul(Html... children) {
        return el("ul", children);
    }

    /** {@code <ol>}. */
    public static Element ol(Html... children) {
        return el("ol", children);
    }

    /** {@code <li>}. */
    public static Element li(Html... children) {
        return el("li", children);
    }

    /** {@code <form>}. */
    public static Element form(Html... children) {
        return el("form", children);
    }

    /** {@code <label>}. */
    public static Element label(Html... children) {
        return el("label", children);
    }

    /** {@code <h1>}. */
    public static Element h1(Html... children) {
        return el("h1", children);
    }

    /** {@code <h2>}. */
    public static Element h2(Html... children) {
        return el("h2", children);
    }

    /** {@code <h3>}. */
    public static Element h3(Html... children) {
        return el("h3", children);
    }

    /** {@code <section>}. */
    public static Element section(Html... children) {
        return el("section", children);
    }

    /** {@code <strong>}. */
    public static Element strong(Html... children) {
        return el("strong", children);
    }

    // --- void elements (self-closing, no children) ---------------------------------------------

    /** {@code <input>} (void). Add {@code type}, {@code value}, {@code l:model} via {@code attr}. */
    public static Element input() {
        return el("input");
    }

    /** {@code <br>} (void). */
    public static Element br() {
        return el("br");
    }

    /** {@code <img>} (void). */
    public static Element img() {
        return el("img");
    }

    /** {@code <hr>} (void). */
    public static Element hr() {
        return el("hr");
    }
}
