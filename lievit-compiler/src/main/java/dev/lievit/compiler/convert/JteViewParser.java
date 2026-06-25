/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.compiler.convert;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses a multi-file JTE template body into the neutral convert AST (issue #141, ADR-0071), the
 * forward half of the MFC-&gt;SFC convert. It is a small, purpose-built recursive-descent HTML reader,
 * <em>not</em> a general JTE/HTML engine: it covers exactly the markup a lievit component template
 * uses (elements, text, {@code ${expr}}, {@code $unsafe{expr}}, {@code l:*} / literal / dynamic
 * attributes) and <strong>warn-and-skips</strong> anything outside that set (JTE control blocks
 * {@code @if}/{@code @for}/{@code @template.*}) rather than emit wrong output.
 *
 * <p>The {@code @import}/{@code @param} header is dropped: on the way back to a template the params are
 * re-derived from the component's {@code @Wire} fields, so carrying them here would only let the two
 * shapes drift. Insignificant whitespace between elements is collapsed so a round-trip
 * (parse-write-parse) is a fixed point.
 *
 * <p>Pure Java, zero Spring, zero reflection.
 */
public final class JteViewParser {

    // A void element renders self-closing and has no close tag (HTML spec subset the DSL also uses).
    private static final Set<String> VOID_ELEMENTS =
            Set.of(
                    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
                    "param", "source", "track", "wbr");

    // A JTE control / directive line we cannot map to the AST: warn and skip its line.
    private static final Pattern CONTROL_LINE =
            Pattern.compile("^\\s*@(if|elseif|else|endif|for|endfor|template\\.|raw|endraw|`).*");

    // One attribute inside a start tag: name optionally = "value" | 'value'. Value may hold ${...}.
    private static final Pattern ATTR =
            Pattern.compile("([a-zA-Z_:][\\w:.\\-]*)\\s*(?:=\\s*(?:\"([^\"]*)\"|'([^']*)'))?");

    /**
     * Parses a JTE template body into the neutral view AST.
     *
     * @param jte the full template source (header lines included; they are dropped)
     * @return the parsed root (the single root element) plus any warn-and-skip notes
     */
    public ParsedView parse(String jte) {
        List<ConversionWarning> warnings = new ArrayList<>();
        String body = stripHeaderAndControl(jte, warnings);
        List<ViewNode> roots = new Reader(body, warnings).readNodes();
        // A component template has one root element; ignore stray top-level text/whitespace.
        Optional<ViewNode> root =
                roots.stream().filter(n -> n instanceof ViewNode.Element).findFirst();
        if (root.isEmpty()) {
            warnings.add(
                    new ConversionWarning(
                            "no-root", "the template has no single root element to convert"));
        }
        return new ParsedView(root, warnings);
    }

    /** Drops {@code @import}/{@code @param} headers and warn-skips JTE control lines. */
    private static String stripHeaderAndControl(String jte, List<ConversionWarning> warnings) {
        StringBuilder out = new StringBuilder();
        for (String line : jte.split("\n", -1)) {
            String trimmed = line.strip();
            if (trimmed.startsWith("@import") || trimmed.startsWith("@param")) {
                continue;
            }
            Matcher control = CONTROL_LINE.matcher(line);
            if (control.matches()) {
                String kw = "@" + control.group(1).replace(".", "").replace("`", "raw-block");
                // Normalize @endif/@elseif under @if, @endfor under @for for a single grouped warning.
                String construct =
                        kw.startsWith("@end") || kw.equals("@elseif") || kw.equals("@else")
                                ? canonicalControl(kw)
                                : kw;
                warnings.add(
                        new ConversionWarning(
                                construct,
                                "JTE control block dropped (no faithful single-file equivalent): "
                                        + trimmed));
                continue;
            }
            out.append(line).append('\n');
        }
        return out.toString();
    }

    private static String canonicalControl(String kw) {
        return switch (kw) {
            case "@endif", "@elseif", "@else" -> "@if";
            case "@endfor" -> "@for";
            default -> kw;
        };
    }

    /** A cursor over the body that reads a flat list of sibling nodes, recursing into elements. */
    private static final class Reader {
        private final String src;
        private final List<ConversionWarning> warnings;
        private int pos;

        Reader(String src, List<ConversionWarning> warnings) {
            this.src = src;
            this.warnings = warnings;
        }

        /** Reads siblings until end-of-input or the next token is a close tag (consumed by caller). */
        List<ViewNode> readNodes() {
            List<ViewNode> nodes = new ArrayList<>();
            while (pos < src.length()) {
                if (lookingAtCloseTag()) {
                    break;
                }
                if (src.charAt(pos) == '<') {
                    ViewNode el = readElement();
                    if (el != null) {
                        nodes.add(el);
                    }
                } else {
                    readText(nodes);
                }
            }
            return nodes;
        }

        private boolean lookingAtCloseTag() {
            return pos + 1 < src.length() && src.charAt(pos) == '<' && src.charAt(pos + 1) == '/';
        }

        /** Reads one element (start tag, children, close tag), or null for a comment we skip. */
        private ViewNode readElement() {
            int gt = src.indexOf('>', pos);
            if (gt < 0) {
                pos = src.length();
                return null;
            }
            String startTag = src.substring(pos + 1, gt).strip();
            pos = gt + 1;
            if (startTag.startsWith("!--")) {
                return null; // HTML comment: skip
            }
            boolean selfClosed = startTag.endsWith("/");
            if (selfClosed) {
                startTag = startTag.substring(0, startTag.length() - 1).strip();
            }
            int sp = firstWhitespace(startTag);
            String tag = (sp < 0 ? startTag : startTag.substring(0, sp)).toLowerCase();
            String attrSrc = sp < 0 ? "" : startTag.substring(sp);
            List<ViewAttribute> attrs = parseAttributes(attrSrc);
            if (selfClosed || VOID_ELEMENTS.contains(tag)) {
                return new ViewNode.Element(tag, attrs, List.of());
            }
            List<ViewNode> children = readNodes();
            // consume the matching close tag if present
            if (lookingAtCloseTag()) {
                int closeGt = src.indexOf('>', pos);
                pos = closeGt < 0 ? src.length() : closeGt + 1;
            }
            return new ViewNode.Element(tag, attrs, children);
        }

        /** Reads a text run up to the next {@code <}, splitting out {@code ${}}/{@code $unsafe{}}. */
        private void readText(List<ViewNode> nodes) {
            int next = src.indexOf('<', pos);
            String chunk = next < 0 ? src.substring(pos) : src.substring(pos, next);
            pos = next < 0 ? src.length() : next;
            emitTextRun(chunk, nodes);
        }

        private void emitTextRun(String chunk, List<ViewNode> nodes) {
            int i = 0;
            StringBuilder literal = new StringBuilder();
            while (i < chunk.length()) {
                if (chunk.startsWith("$unsafe{", i)) {
                    flushLiteral(literal, nodes);
                    int close = matchingBrace(chunk, i + "$unsafe{".length() - 1);
                    nodes.add(new ViewNode.Raw(chunk.substring(i + "$unsafe{".length(), close).strip()));
                    i = close + 1;
                } else if (chunk.startsWith("${", i)) {
                    flushLiteral(literal, nodes);
                    int close = matchingBrace(chunk, i + 1);
                    nodes.add(new ViewNode.Expression(chunk.substring(i + 2, close).strip()));
                    i = close + 1;
                } else {
                    literal.append(chunk.charAt(i));
                    i++;
                }
            }
            flushLiteral(literal, nodes);
        }

        private void flushLiteral(StringBuilder literal, List<ViewNode> nodes) {
            String text = collapse(literal.toString());
            if (!text.isEmpty()) {
                nodes.add(new ViewNode.Literal(text));
            }
            literal.setLength(0);
        }
    }

    /** Parses the attribute source of a start tag into ordered {@link ViewAttribute}s. */
    private static List<ViewAttribute> parseAttributes(String attrSrc) {
        List<ViewAttribute> attrs = new ArrayList<>();
        Matcher m = ATTR.matcher(attrSrc);
        while (m.find()) {
            String name = m.group(1);
            String value = m.group(2) != null ? m.group(2) : m.group(3);
            if (value == null) {
                attrs.add(ViewAttribute.bool(name));
            } else if (value.startsWith("${") && value.endsWith("}") && value.indexOf("${", 2) < 0) {
                attrs.add(ViewAttribute.dynamic(name, value.substring(2, value.length() - 1).strip()));
            } else {
                attrs.add(ViewAttribute.literal(name, value));
            }
        }
        return attrs;
    }

    private static int firstWhitespace(String s) {
        for (int i = 0; i < s.length(); i++) {
            if (Character.isWhitespace(s.charAt(i))) {
                return i;
            }
        }
        return -1;
    }

    /** Index of the brace matching the {@code {} at or after {@code open}. */
    private static int matchingBrace(String s, int open) {
        int brace = s.indexOf('{', open);
        int depth = 0;
        for (int i = brace; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '{') {
                depth++;
            } else if (c == '}') {
                depth--;
                if (depth == 0) {
                    return i;
                }
            }
        }
        return s.length() - 1;
    }

    /** Collapses runs of whitespace to a single space (insignificant whitespace, round-trip stable). */
    private static String collapse(String text) {
        String collapsed = text.replaceAll("\\s+", " ");
        return collapsed.equals(" ") ? "" : collapsed.strip();
    }
}
