/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.compiler.convert;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Parses a single-file DSL render expression (the {@code dev.lievit.dsl.H} builder, ADR-0018) into the
 * neutral convert AST (issue #141, ADR-0070), the forward half of the SFC-&gt;MFC convert. It reads
 * the {@code return} expression of an {@code @LievitRender} method as a tree of factory calls
 * ({@code div(...)}, {@code el("tag", ...)}, {@code text(...)}, {@code raw(...)}) each optionally
 * followed by a fluent attribute chain ({@code .attr(...)}, {@code .wireClick(...)}, ...), and maps
 * each to a {@link ViewNode} / {@link ViewAttribute}.
 *
 * <p>It is a small, purpose-built expression reader for exactly the DSL surface, <em>not</em> a Java
 * parser: a construct outside that surface (a {@code fragment(...)} root, a non-DSL method call, a
 * conditional) is <strong>warn-and-skipped</strong> so the convert never emits wrong markup. Pure
 * Java, zero Spring, zero reflection.
 */
public final class DslViewParser {

    // Fluent element factories that take children and map 1:1 to a tag of the same name.
    private static final Map<String, String> ELEMENT_FACTORIES =
            Map.ofEntries(
                    Map.entry("div", "div"),
                    Map.entry("span", "span"),
                    Map.entry("p", "p"),
                    Map.entry("button", "button"),
                    Map.entry("a", "a"),
                    Map.entry("ul", "ul"),
                    Map.entry("ol", "ol"),
                    Map.entry("li", "li"),
                    Map.entry("form", "form"),
                    Map.entry("label", "label"),
                    Map.entry("h1", "h1"),
                    Map.entry("h2", "h2"),
                    Map.entry("h3", "h3"),
                    Map.entry("section", "section"),
                    Map.entry("strong", "strong"),
                    Map.entry("input", "input"),
                    Map.entry("br", "br"),
                    Map.entry("img", "img"),
                    Map.entry("hr", "hr"));

    // The wire-binding fluent helpers and the l:* attribute each emits.
    private static final Map<String, String> WIRE_HELPERS =
            Map.of(
                    "wireClick", "l:click",
                    "wireSubmit", "l:submit",
                    "wireKeydownEnter", "l:keydown.enter",
                    "wireModel", "l:model",
                    "wireModelLive", "l:model.live");

    /**
     * Parses a DSL render expression into the neutral view AST.
     *
     * @param expression the render method's {@code return} expression (no {@code return}/{@code ;})
     * @return the parsed root plus any warn-and-skip notes
     */
    public ParsedView parse(String expression) {
        List<ConversionWarning> warnings = new ArrayList<>();
        ViewNode root = parseNode(stripStaticPrefix(expression.strip()), warnings);
        return new ParsedView(Optional.ofNullable(root), warnings);
    }

    /** Parses one node expression (a factory call + its fluent chain), or null when skipped. */
    private ViewNode parseNode(String expr, List<ConversionWarning> warnings) {
        expr = expr.strip();
        // Split the leading factory call from any trailing .attr(...).wireX(...) chain.
        int callEnd = endOfFirstCall(expr);
        if (callEnd < 0) {
            warnings.add(
                    new ConversionWarning(
                            "expression", "not a DSL factory call, skipped: " + brief(expr)));
            return null;
        }
        String head = expr.substring(0, callEnd);
        String chain = expr.substring(callEnd);
        String name = head.substring(0, head.indexOf('('));
        String args = inside(head);

        ViewNode node = parseFactory(name, args, warnings);
        if (node instanceof ViewNode.Element element) {
            return applyChain(element, chain, warnings);
        }
        if (!chain.isBlank()) {
            warnings.add(
                    new ConversionWarning(
                            "chain", "fluent chain on a non-element node ignored: " + brief(chain)));
        }
        return node;
    }

    /** Builds the node for a factory name + raw argument source. */
    private ViewNode parseFactory(String name, String args, List<ConversionWarning> warnings) {
        switch (name) {
            case "text" -> {
                String a = args.strip();
                return isStringLiteral(a)
                        ? new ViewNode.Literal(unquote(a))
                        : new ViewNode.Expression(a);
            }
            case "raw" -> {
                String a = args.strip();
                return isStringLiteral(a) ? new ViewNode.Raw(unquote(a)) : new ViewNode.Raw(a);
            }
            case "el" -> {
                List<String> parts = splitArgs(args);
                if (parts.isEmpty() || !isStringLiteral(parts.get(0).strip())) {
                    warnings.add(
                            new ConversionWarning(
                                    "el", "el(...) without a literal tag name, skipped"));
                    return null;
                }
                String tag = unquote(parts.get(0).strip());
                return new ViewNode.Element(
                        tag, List.of(), parseChildren(parts.subList(1, parts.size()), warnings));
            }
            case "fragment" -> {
                warnings.add(
                        new ConversionWarning(
                                "fragment",
                                "fragment(...) has no single root element; cannot convert to a"
                                        + " template root"));
                return null;
            }
            default -> {
                String tag = ELEMENT_FACTORIES.get(name);
                if (tag == null) {
                    warnings.add(
                            new ConversionWarning(
                                    "factory", "unknown DSL factory '" + name + "', skipped"));
                    return null;
                }
                return new ViewNode.Element(
                        tag, List.of(), parseChildren(splitArgs(args), warnings));
            }
        }
    }

    private List<ViewNode> parseChildren(List<String> argExprs, List<ConversionWarning> warnings) {
        List<ViewNode> children = new ArrayList<>();
        for (String arg : argExprs) {
            if (arg.isBlank()) {
                continue;
            }
            ViewNode child = parseNode(arg, warnings);
            if (child != null) {
                children.add(child);
            }
        }
        return children;
    }

    /** Applies a {@code .attr(...)/.wireX(...)} chain to an element, returning the enriched element. */
    private ViewNode.Element applyChain(
            ViewNode.Element element, String chain, List<ConversionWarning> warnings) {
        List<ViewAttribute> attrs = new ArrayList<>(element.attributes());
        String rest = chain.strip();
        while (rest.startsWith(".")) {
            rest = rest.substring(1);
            int open = rest.indexOf('(');
            if (open < 0) {
                break;
            }
            String method = rest.substring(0, open).strip();
            int close = matchingParen(rest, open);
            String callArgs = rest.substring(open + 1, close);
            rest = rest.substring(close + 1).strip();
            String wireAttr = WIRE_HELPERS.get(method);
            if (wireAttr != null) {
                attrs.add(ViewAttribute.literal(wireAttr, unquote(callArgs.strip())));
            } else if (method.equals("attr")) {
                attrs.add(parseAttrCall(callArgs));
            } else {
                warnings.add(
                        new ConversionWarning(
                                "method", "unknown DSL builder method '" + method + "', skipped"));
            }
        }
        return new ViewNode.Element(element.tag(), attrs, element.children());
    }

    /** Parses an {@code attr("name", value)} / {@code attr("name")} call into a {@link ViewAttribute}. */
    private static ViewAttribute parseAttrCall(String callArgs) {
        List<String> parts = splitArgs(callArgs);
        String name = unquote(parts.get(0).strip());
        if (parts.size() == 1) {
            return ViewAttribute.bool(name);
        }
        String value = parts.get(1).strip();
        return isStringLiteral(value)
                ? ViewAttribute.literal(name, unquote(value))
                : ViewAttribute.dynamic(name, value);
    }

    // --- lexing helpers ------------------------------------------------------------------------

    /** Drops a leading {@code H.} static qualifier if the author wrote {@code H.div(...)}. */
    private static String stripStaticPrefix(String expr) {
        return expr.startsWith("H.") ? expr.substring(2) : expr;
    }

    /** End index (exclusive) of the first {@code name(...)} call at the start of {@code expr}. */
    private static int endOfFirstCall(String expr) {
        int open = expr.indexOf('(');
        if (open <= 0) {
            return -1;
        }
        for (int i = 0; i < open; i++) {
            char c = expr.charAt(i);
            if (!Character.isJavaIdentifierPart(c)) {
                return -1;
            }
        }
        int close = matchingParen(expr, open);
        return close < 0 ? -1 : close + 1;
    }

    /** The substring inside the outermost parentheses of a {@code name(...)} head. */
    private static String inside(String call) {
        int open = call.indexOf('(');
        int close = matchingParen(call, open);
        return call.substring(open + 1, close);
    }

    /** Splits a top-level comma-separated argument list, respecting nesting and string literals. */
    private static List<String> splitArgs(String args) {
        List<String> parts = new ArrayList<>();
        int depth = 0;
        boolean inString = false;
        char quote = 0;
        StringBuilder current = new StringBuilder();
        for (int i = 0; i < args.length(); i++) {
            char c = args.charAt(i);
            if (inString) {
                current.append(c);
                if (c == '\\' && i + 1 < args.length()) {
                    current.append(args.charAt(++i));
                } else if (c == quote) {
                    inString = false;
                }
                continue;
            }
            switch (c) {
                case '"', '\'' -> {
                    inString = true;
                    quote = c;
                    current.append(c);
                }
                case '(', '[', '{' -> {
                    depth++;
                    current.append(c);
                }
                case ')', ']', '}' -> {
                    depth--;
                    current.append(c);
                }
                case ',' -> {
                    if (depth == 0) {
                        parts.add(current.toString());
                        current.setLength(0);
                    } else {
                        current.append(c);
                    }
                }
                default -> current.append(c);
            }
        }
        if (!current.toString().isBlank() || !parts.isEmpty()) {
            parts.add(current.toString());
        }
        return parts;
    }

    /** Index of the {@code )} matching the {@code (} at {@code open}, respecting strings/nesting. */
    private static int matchingParen(String s, int open) {
        int depth = 0;
        boolean inString = false;
        char quote = 0;
        for (int i = open; i < s.length(); i++) {
            char c = s.charAt(i);
            if (inString) {
                if (c == '\\') {
                    i++;
                } else if (c == quote) {
                    inString = false;
                }
                continue;
            }
            if (c == '"' || c == '\'') {
                inString = true;
                quote = c;
            } else if (c == '(') {
                depth++;
            } else if (c == ')') {
                depth--;
                if (depth == 0) {
                    return i;
                }
            }
        }
        return -1;
    }

    private static boolean isStringLiteral(String s) {
        return s.length() >= 2 && s.startsWith("\"") && s.endsWith("\"");
    }

    private static String unquote(String s) {
        if (!isStringLiteral(s)) {
            return s;
        }
        return s.substring(1, s.length() - 1)
                .replace("\\\"", "\"")
                .replace("\\n", "\n")
                .replace("\\t", "\t")
                .replace("\\\\", "\\");
    }

    private static String brief(String s) {
        String one = s.strip().replaceAll("\\s+", " ");
        return one.length() > 60 ? one.substring(0, 57) + "..." : one;
    }
}
