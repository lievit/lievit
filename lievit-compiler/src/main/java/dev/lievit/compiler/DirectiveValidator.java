/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.compiler;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The unknown-{@code l:}-directive poka-yoke: scans an authored template's source for
 * {@code l:<name>[.modifiers]} attributes and reports any whose bare {@code <name>} is not a known
 * lievit directive ({@link DirectiveNames#BUILTIN} plus an app's allowlisted custom names). This is
 * the validation that turns a class of silent runtime no-op into a loud failure.
 *
 * <h2>The bug it prevents</h2>
 *
 * The client runtime's {@code DirectiveRegistry.bindElement} ignores an unknown {@code l:*}
 * attribute (a forward-compatible no-op so a not-yet-loaded directive does not error in the
 * browser). The cost of that leniency is that a typo or a non-existent directive
 * ({@code <button l:value="${id}">}) binds nothing and fails silently: the markup looks wired, the
 * server ITs pass (they push the model update directly), and the broken button ships. This
 * validator closes the gap by failing the build/startup the first time an unknown directive name
 * appears in a template.
 *
 * <h2>What it validates, and what it deliberately does not</h2>
 *
 * <ul>
 *   <li><strong>The directive NAME</strong> ({@code l:value} → error, {@code l:click} → ok),
 *       optionally with modifiers ({@code l:model.live}, {@code l:keydown.enter},
 *       {@code l:debounce.500ms}, {@code l:bind.disabled}). Only the bare name (the segment before
 *       the first {@code .}) is checked against the known set; modifiers are open per directive and
 *       are not enumerated.
 *   <li><strong>Not the VALUE.</strong> Magic actions ({@code l:click="$set('field', v)"},
 *       {@code $refresh}, {@code $call}) live in the attribute value; the directive is {@code click}
 *       (valid). The value is never inspected here.
 *   <li><strong>Not {@code wire:*}.</strong> Only the {@code l:} namespace is lievit's directive
 *       surface; {@code wire:key}/{@code wire:ref} are handled by the tag compiler, not here.
 * </ul>
 *
 * Pure Java, zero Spring, zero reflection: the starter feeds it classpath template sources at
 * startup, and a future compile-time pass (a Maven mojo / the CLI {@code doctor}) can feed it the
 * same source files for the true build-time poka-yoke. The valid-name set is
 * {@link DirectiveNames}; custom app-registered directives ({@code runtime.directives.register})
 * are invisible to a static scan, so they are passed in as an allowlist.
 */
public final class DirectiveValidator {

    /**
     * Comments that must be removed before the tag scan so directive-looking text inside them is not
     * flagged: JTE comments ({@code <%-- ... --%>}) and HTML comments ({@code <!-- ... -->}). A
     * lievit template's own docs often mention {@code l:value} ("there is no l:value directive") and
     * must not trip the validator. Replaced with spaces (length-preserving) so line numbers survive.
     */
    private static final Pattern COMMENT =
            Pattern.compile("<%--.*?--%>|<!--.*?-->", Pattern.DOTALL);

    /**
     * Matches an HTML/JTE start tag (up to the first {@code >}), so the directive scan runs only
     * <em>inside tags</em> and never on prose, text content, or a URL that happens to contain
     * {@code l:}. Closing tags ({@code </...>}) and JTE/HTML directives are skipped by the leading
     * {@code [^/!%]} after {@code <}.
     */
    private static final Pattern START_TAG = Pattern.compile("<[^/!%][^>]*>", Pattern.DOTALL);

    /**
     * Matches an {@code l:<name>[.modifiers]} attribute name <em>within a start tag</em>. The name is
     * a lowercase-led token (letters, digits, hyphens) so {@code l:preserve-scroll} matches; the
     * modifier tail (everything after the first {@code .}) is captured but its segments are not
     * validated by name (modifiers are open per directive). A leading boundary
     * ({@code <}, whitespace, or quote) plus a trailing separator ({@code =}, {@code /}, {@code >},
     * whitespace, quote) keep it from matching a mid-word {@code l:}.
     */
    private static final Pattern DIRECTIVE_ATTR =
            Pattern.compile("(?<=[\\s\"'<])l:([a-z][a-z0-9-]*)((?:\\.[A-Za-z0-9_-]+)*)(?=[\\s=/>\"'])");

    private final Set<String> known;

    /**
     * Builds a validator whose valid directive set is the built-ins plus the given custom names.
     *
     * @param extraDirectives app-registered custom directive names (the {@code lievit.directives.extra}
     *     allowlist), without the {@code l:} prefix; a static scan cannot see
     *     {@code runtime.directives.register} calls, so the app declares them here. May be empty.
     */
    public DirectiveValidator(Set<String> extraDirectives) {
        Set<String> all = new LinkedHashSet<>(DirectiveNames.BUILTIN);
        all.addAll(extraDirectives);
        this.known = Set.copyOf(all);
    }

    /** Builds a validator with no custom directives (only the lievit built-ins). */
    public DirectiveValidator() {
        this(Set.of());
    }

    /**
     * Validates one template's source, returning a violation per unknown {@code l:} directive
     * occurrence (in source order). An empty list means the template uses only known directives.
     *
     * @param templateName the template identifier for the error message (e.g. {@code jte/admin/list.jte})
     * @param source the template source text
     * @return the violations found (possibly empty), never {@code null}
     */
    public List<Violation> validate(String templateName, String source) {
        String scanned = blankComments(source);
        List<Violation> violations = new ArrayList<>();
        Matcher tag = START_TAG.matcher(scanned);
        while (tag.find()) {
            Matcher m = DIRECTIVE_ATTR.matcher(tag.group());
            while (m.find()) {
                String name = m.group(1);
                if (known.contains(name)) {
                    continue;
                }
                int line = lineNumber(source, tag.start() + m.start());
                violations.add(new Violation(templateName, line, "l:" + name, hintFor(name)));
            }
        }
        return violations;
    }

    /**
     * Replaces every JTE/HTML comment with same-length blanks (newlines preserved), so commented-out
     * or documented directive text is not scanned while line numbers stay exact for the real markup.
     */
    private static String blankComments(String source) {
        Matcher m = COMMENT.matcher(source);
        StringBuilder out = new StringBuilder(source);
        while (m.find()) {
            for (int i = m.start(); i < m.end(); i++) {
                if (out.charAt(i) != '\n') {
                    out.setCharAt(i, ' ');
                }
            }
        }
        return out.toString();
    }

    /** The 1-based line number of a character offset in {@code source}. */
    private static int lineNumber(String source, int offset) {
        int line = 1;
        for (int i = 0; i < offset && i < source.length(); i++) {
            if (source.charAt(i) == '\n') {
                line++;
            }
        }
        return line;
    }

    /**
     * A targeted hint for the most common unknown directives, falling back to the canonical advice
     * (set a field with {@code $set} on the {@code l:click}, not a made-up directive). The
     * {@code l:value} case is the exact bug that motivated this validator.
     */
    private static String hintFor(String name) {
        return switch (name) {
            case "value" ->
                    "there is no l:value directive; to set a field on an action use "
                            + "l:click=\"$set('field', value)\" (the canonical row-arm), "
                            + "or l:model/l:bind on an input. See docs/wire-protocol.md §5.";
            case "if", "for", "else", "elseif", "foreach" ->
                    "control flow is the template engine's job (JTE @if/@for), not an l: directive.";
            default ->
                    "unknown lievit directive 'l:" + name + "'. Known directives: "
                            + sortedKnownHint()
                            + ". For setting a field on an action use l:click=\"$set('field', value)\"; "
                            + "for a custom directive registered via runtime.directives.register, "
                            + "allowlist it with lievit.directives.extra=" + name + ".";
        };
    }

    /** A stable, sorted rendering of the built-in directive names for the catch-all hint. */
    private static String sortedKnownHint() {
        return DirectiveNames.BUILTIN.stream().sorted().reduce((a, b) -> a + ", " + b).orElse("");
    }

    /**
     * One unknown-directive finding: where it is and what to do about it.
     *
     * @param templateName the template the directive appears in
     * @param line the 1-based line number
     * @param directive the offending attribute name as authored (e.g. {@code l:value})
     * @param hint an actionable suggestion
     */
    public record Violation(String templateName, int line, String directive, String hint) {

        /** A single-line, reviewer-actionable message: where, what, and the fix. */
        public String message() {
            return templateName + ":" + line + ": unknown lievit directive '" + directive + "': " + hint;
        }
    }
}
