/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Reflects a {@link Wire}-bound field into the browser's URL query string, and restores it from the
 * URL on the first page load.
 *
 * <p>The field becomes shareable / bookmarkable state. On mount the matching query parameter (if
 * present in the host page request) seeds the field, before the component renders. On every later
 * wire call, after the actions and updates have run, lievit emits a {@code url} effect (the effects
 * channel, ADR-0012) instructing the client to push the new query string via the History API. No
 * full page reload happens; the browser's address bar tracks the component's state.
 *
 * <p>The canonical use is a search box bound to {@code ?search=...}: typing updates the URL, loading
 * a URL with {@code ?search=foo} pre-fills the box, and the back button restores the prior state.
 *
 * <p>{@code @LievitUrl} is applied <em>alongside</em> {@link Wire} on the same field (a non-wired
 * field has no state to reflect). Like {@link LievitProperty}, it is field-level metadata that does
 * not add to the count of lifecycle annotations conceptually owned by the component author; it tunes
 * how an existing {@code @Wire} field crosses the wire.
 *
 * <p><strong>Security.</strong> Only the query string is reflected; lievit never reflects a host,
 * scheme, or path from the field, so a value can never become an open redirect or a navigation
 * target. Values are URL-encoded when written into the query string and URL-decoded (never
 * interpreted as markup or a navigation instruction) when read in. The query string the server emits
 * is data for {@code history.pushState(..., url)} only, never a destination the browser follows.
 */
@Documented
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface LievitUrl {

    /**
     * The query-parameter name this field maps to. Defaults to the field name. Alias for
     * {@link #key()}; set at most one of the two.
     *
     * @return the query-parameter alias, or empty to use the field name
     */
    String as() default "";

    /**
     * The query-parameter name this field maps to. A synonym for {@link #as()} for readers who
     * prefer "key"; set at most one of the two.
     *
     * @return the query-parameter key, or empty to use the field name
     */
    String key() default "";

    /**
     * Whether to keep the parameter in the URL when the field's value is empty or {@code null}.
     *
     * <p>Defaults to {@code false}: an empty value removes the parameter from the query string (the
     * common search-box behaviour, so {@code ?search=} does not linger). Set {@code true} to keep a
     * present-but-empty parameter (for a value whose emptiness is itself meaningful state).
     *
     * @return whether to keep the parameter when the value is empty
     */
    boolean keepEmpty() default false;

    /**
     * Whether a change to this field pushes a new history entry or replaces the current one.
     *
     * <p>{@link History#PUSH} (the default) calls {@code history.pushState}, so the back button
     * returns to the previous state (a deliberate navigation step). {@link History#REPLACE} calls
     * {@code history.replaceState}, so the URL tracks the field without growing the back stack (for
     * high-frequency, incidental updates like a live filter).
     *
     * @return the history mode for changes to this field
     */
    History history() default History.PUSH;

    /** The two History-API modes a {@link LievitUrl} field can use to write the URL. */
    enum History {

        /** {@code history.pushState}: adds a back-stack entry (the default; back-button friendly). */
        PUSH,

        /** {@code history.replaceState}: rewrites the current entry without growing the back stack. */
        REPLACE
    }
}
