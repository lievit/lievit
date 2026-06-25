/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import java.util.List;

import org.jspecify.annotations.Nullable;

/**
 * One parsed framework-provided magic action from the client {@code _calls} list (ADR-0030, Livewire
 * {@code SupportMagicActions} parity). A magic action is a call whose name starts with {@code $}
 * ({@code $set}, {@code $toggle}, {@code $refresh}, {@code $get}, {@code $parent}): instead of
 * routing to an {@code @LievitAction} method, the {@link MagicActionListener} resolves it on the
 * server and the dispatcher early-returns, so the {@code @LievitAction} allowlist never sees the
 * synthetic name (it would otherwise be {@code UNKNOWN_COMPONENT}).
 *
 * <p>The call string carries its arguments inline the way a template expression writes them, e.g.
 * {@code $set('open', true)} or {@code $toggle('open')}. {@link #parse(String)} splits the bare name
 * from its argument list; the magic action only ever reads {@code @Wire} field names and JSON-scalar
 * literals from those arguments, so it cannot reach a non-{@code @Wire} field (the same settable
 * allowlist a client update obeys, ADR-0013).
 *
 * @param name the bare magic name including the leading {@code $} ({@code "$set"}, {@code "$toggle"})
 * @param args the parsed argument literals, in order (a property name string, a JSON scalar value)
 */
public record MagicAction(String name, List<Object> args) {

    /** The well-known magic names lievit recognises (Livewire parity). */
    public static final String REFRESH = "$refresh";

    public static final String SET = "$set";

    public static final String TOGGLE = "$toggle";

    public static final String GET = "$get";

    public static final String PARENT = "$parent";

    /**
     * @param call a raw {@code _calls} entry
     * @return true if the call names a magic action (its first non-blank char is {@code $})
     */
    public static boolean isMagic(String call) {
        return call != null && call.stripLeading().startsWith("$");
    }

    /**
     * Parses a raw call string into a magic action, or returns {@code null} if it is not magic.
     *
     * <p>Accepts the bare form ({@code $refresh}, {@code $parent}) and the call form
     * ({@code $set('count', 5)}, {@code $toggle('open')}). Arguments are parsed as either a quoted
     * string (single or double quotes) or a JSON scalar literal ({@code true}, {@code false},
     * {@code null}, an integer, a decimal). An unparseable argument is dropped (the magic action then
     * sees fewer args and no-ops, never a code path that could touch a non-{@code @Wire} field).
     *
     * @param call the raw call string from {@code _calls}
     * @return the parsed magic action, or {@code null} if the call is not magic
     */
    public static @Nullable MagicAction parse(String call) {
        if (!isMagic(call)) {
            return null;
        }
        String trimmed = call.strip();
        int open = trimmed.indexOf('(');
        if (open < 0) {
            // Bare form: "$refresh", "$parent".
            return new MagicAction(trimmed, List.of());
        }
        String name = trimmed.substring(0, open).strip();
        int close = trimmed.lastIndexOf(')');
        if (close < open) {
            return new MagicAction(name, List.of());
        }
        String argText = trimmed.substring(open + 1, close);
        return new MagicAction(name, parseArgs(argText));
    }

    private static List<Object> parseArgs(String argText) {
        if (argText.isBlank()) {
            return List.of();
        }
        List<Object> parsed = new java.util.ArrayList<>();
        for (String raw : splitTopLevel(argText)) {
            String token = raw.strip();
            if (token.isEmpty()) {
                continue;
            }
            parsed.add(parseScalar(token));
        }
        return List.copyOf(parsed);
    }

    /**
     * Splits an argument list on top-level commas, ignoring commas inside quotes. Nested structures
     * are not supported (a magic action takes scalar args only); a comma inside a quoted string is
     * preserved.
     */
    private static List<String> splitTopLevel(String argText) {
        List<String> parts = new java.util.ArrayList<>();
        StringBuilder current = new StringBuilder();
        char quote = 0;
        for (int i = 0; i < argText.length(); i++) {
            char c = argText.charAt(i);
            if (quote != 0) {
                current.append(c);
                if (c == quote) {
                    quote = 0;
                }
            } else if (c == '\'' || c == '"') {
                quote = c;
                current.append(c);
            } else if (c == ',') {
                parts.add(current.toString());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        if (current.length() > 0) {
            parts.add(current.toString());
        }
        return parts;
    }

    private static @Nullable Object parseScalar(String token) {
        if ((token.startsWith("'") && token.endsWith("'") && token.length() >= 2)
                || (token.startsWith("\"") && token.endsWith("\"") && token.length() >= 2)) {
            return token.substring(1, token.length() - 1);
        }
        if (token.equals("true")) {
            return Boolean.TRUE;
        }
        if (token.equals("false")) {
            return Boolean.FALSE;
        }
        if (token.equals("null")) {
            return null;
        }
        try {
            if (token.indexOf('.') >= 0) {
                return Double.parseDouble(token);
            }
            return Long.parseLong(token);
        } catch (NumberFormatException e) {
            // Not a recognised scalar literal: keep the raw token as a string (it may be a property
            // name passed unquoted, which the magic action treats as a field name).
            return token;
        }
    }
}
