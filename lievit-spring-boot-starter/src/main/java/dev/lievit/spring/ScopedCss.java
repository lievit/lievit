/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.zip.CRC32;

/**
 * The server half of scoped CSS modules (issue #129, ADR-0063): wraps a component's colocated CSS in
 * a per-component scope selector so its rules apply only to that component's subtree, and derives a
 * content hash for cache-busting the served stylesheet. This pairs with the shipped client feature
 * {@code runtime/features/scoped-css.ts}, which hoists inline {@code <style l:scope>} blocks; here the
 * CSS is served over a dedicated route ({@code /lievit/css/{component}}) instead, the transport this
 * issue adds. Both use the same scope convention: every rule is constrained to
 * {@code [data-lievit-scope="<scopeId>"]}, which the client stamps on every root of the component.
 *
 * <p>The scope id matches the client's {@code scopeId()}: the component name with non-token
 * characters replaced by {@code -}, so a deeply-namespaced name ({@code com.acme.ui.Modal}) resolves
 * to its own scope and a sibling sharing a class is never matched. The rewrite is a small,
 * deterministic, CSP-safe transform (no eval, no full CSS parser): each top-level selector in a rule
 * gets the scope prefixed; at-rule bodies ({@code @media} etc.) are scoped recursively; {@code :scope}
 * / {@code &} map to the root element itself. Global CSS (served verbatim, no scope) is the caller's
 * choice, not this helper's.
 *
 * <p>Pure, stateless, no Spring.
 */
public final class ScopedCss {

    private static final String SCOPE_ATTR = "data-lievit-scope";

    private ScopedCss() {}

    /**
     * The scope id for a component name (matches the client {@code scopeId()}): non-token characters
     * become {@code -}, so the id is attribute-safe and stable, and a namespaced name keeps its own
     * scope.
     *
     * @param componentName the component name (the {@code data-lievit-component} value)
     * @return the attribute-safe scope id
     */
    public static String scopeId(String componentName) {
        return componentName.replaceAll("[^A-Za-z0-9_-]", "-");
    }

    /**
     * Scopes a stylesheet to a component: every selector is constrained to the component's scope
     * attribute.
     *
     * @param css the raw stylesheet text
     * @param componentName the component name the rules are scoped to
     * @return the scoped stylesheet text
     */
    public static String scope(String css, String componentName) {
        String prefix = "[" + SCOPE_ATTR + "=\"" + scopeId(componentName) + "\"]";
        return rewriteBlock(css, prefix);
    }

    /**
     * A short content hash for cache-busting the served CSS (the {@code styleModule} effect's mtime/
     * content hash, issue #129): a stable token over the served bytes, so the URL changes only when
     * the CSS changes and the browser can cache the stylesheet indefinitely otherwise.
     *
     * @param css the served stylesheet text
     * @return a lowercase-hex CRC-32 of the bytes
     */
    public static String contentHash(String css) {
        CRC32 crc = new CRC32();
        crc.update(css.getBytes(StandardCharsets.UTF_8));
        return Long.toHexString(crc.getValue());
    }

    private static String rewriteBlock(String css, String prefix) {
        StringBuilder out = new StringBuilder();
        int i = 0;
        while (i < css.length()) {
            int open = css.indexOf('{', i);
            if (open < 0) {
                out.append(css, i, css.length());
                break;
            }
            String head = css.substring(i, open).trim();
            int close = matchingBrace(css, open);
            String body = css.substring(open + 1, close);
            if (head.startsWith("@")) {
                String lower = head.toLowerCase(Locale.ROOT);
                boolean nestsRules =
                        lower.startsWith("@media")
                                || lower.startsWith("@supports")
                                || lower.startsWith("@container")
                                || lower.startsWith("@layer");
                String nested = nestsRules ? rewriteBlock(body, prefix) : body;
                out.append(head).append(" {").append(nested).append('}');
            } else if (!head.isEmpty()) {
                out.append(scopeSelectorList(head, prefix)).append(" {").append(body).append('}');
            } else {
                out.append('{').append(body).append('}');
            }
            i = close + 1;
        }
        return out.toString();
    }

    private static String scopeSelectorList(String selectorList, String prefix) {
        String[] selectors = selectorList.split(",");
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < selectors.length; i++) {
            if (i > 0) {
                out.append(", ");
            }
            out.append(scopeSelector(selectors[i].trim(), prefix));
        }
        return out.toString();
    }

    private static String scopeSelector(String selector, String prefix) {
        if (selector.equals(":scope") || selector.equals("&")) {
            return prefix;
        }
        if (selector.startsWith(":scope")) {
            return prefix + selector.substring(":scope".length());
        }
        if (selector.startsWith("&")) {
            return prefix + selector.substring(1);
        }
        return prefix + " " + selector;
    }

    private static int matchingBrace(String css, int open) {
        int depth = 0;
        for (int i = open; i < css.length(); i++) {
            char c = css.charAt(i);
            if (c == '{') {
                depth++;
            } else if (c == '}') {
                depth--;
                if (depth == 0) {
                    return i;
                }
            }
        }
        return css.length() - 1;
    }
}
