/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.support;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A safe-subset Markdown renderer (the filament-support {@code Markdown} +
 * {@code CanConfigureCommonMark} carried over to the Java idiom): renders helper text, placeholders,
 * and infolist text to sanitized HTML.
 *
 * <p>Sanitize-first by construction: the source is HTML-escaped <em>before</em> any markdown
 * transform runs, so author-or-user HTML (including a {@code <script>}) can never survive into the
 * output verbatim. Only the curated tags this renderer itself emits ({@code <p> <strong> <em> <code>
 * <h1..6> <ul> <li> <a>}) appear. This keeps rich helper text consistent with the strict CSP (which
 * refuses inline script anyway) without dragging in a full CommonMark engine.
 *
 * <p>The supported subset is deliberate, not a full CommonMark implementation: ATX headings,
 * unordered lists, paragraphs, and the inline spans bold / italic / inline-code / links. Anything
 * outside the subset renders as escaped text. A clean, documented subset beats a half-wired
 * dependency for the "one line of rich helper text" job this serves.
 */
public final class Markdown {

    private static final Pattern LINK = Pattern.compile("\\[([^\\]]+)\\]\\(([^)]+)\\)");
    private static final Pattern BOLD = Pattern.compile("\\*\\*([^*]+)\\*\\*");
    private static final Pattern ITALIC = Pattern.compile("\\*([^*]+)\\*");
    private static final Pattern CODE = Pattern.compile("`([^`]+)`");

    private Markdown() {}

    /**
     * Renders a markdown source to sanitized HTML.
     *
     * @param source the markdown source (may be {@code null}, treated as empty)
     * @return the rendered HTML, with every non-emitted character HTML-escaped
     */
    public static String toHtml(String source) {
        if (source == null || source.isBlank()) {
            return "";
        }
        String[] lines = source.replace("\r\n", "\n").split("\n", -1);
        List<String> blocks = new ArrayList<>();
        List<String> paragraph = new ArrayList<>();
        List<String> listItems = new ArrayList<>();

        for (String line : lines) {
            String trimmed = line.strip();
            if (trimmed.isEmpty()) {
                flushParagraph(paragraph, blocks);
                flushList(listItems, blocks);
            } else if (trimmed.startsWith("#")) {
                flushParagraph(paragraph, blocks);
                flushList(listItems, blocks);
                blocks.add(heading(trimmed));
            } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                flushParagraph(paragraph, blocks);
                listItems.add("<li>" + inline(trimmed.substring(2).strip()) + "</li>");
            } else {
                flushList(listItems, blocks);
                paragraph.add(trimmed);
            }
        }
        flushParagraph(paragraph, blocks);
        flushList(listItems, blocks);
        return String.join("", blocks);
    }

    private static void flushParagraph(List<String> paragraph, List<String> blocks) {
        if (!paragraph.isEmpty()) {
            blocks.add("<p>" + inline(String.join(" ", paragraph)) + "</p>");
            paragraph.clear();
        }
    }

    private static void flushList(List<String> listItems, List<String> blocks) {
        if (!listItems.isEmpty()) {
            blocks.add("<ul>" + String.join("", listItems) + "</ul>");
            listItems.clear();
        }
    }

    private static String heading(String line) {
        int level = 0;
        while (level < line.length() && line.charAt(level) == '#' && level < 6) {
            level++;
        }
        String text = inline(line.substring(level).strip());
        return "<h" + level + ">" + text + "</h" + level + ">";
    }

    /**
     * Renders the inline subset over already-escaped text: escape first, then promote the curated
     * spans. Because escaping runs before any tag is introduced, the spans the renderer emits are the
     * only tags that can appear.
     */
    private static String inline(String text) {
        String escaped = escapeHtml(text);
        escaped = replace(LINK, escaped, m -> "<a href=\"" + m.group(2) + "\">" + m.group(1) + "</a>");
        escaped = replace(CODE, escaped, m -> "<code>" + m.group(1) + "</code>");
        escaped = replace(BOLD, escaped, m -> "<strong>" + m.group(1) + "</strong>");
        escaped = replace(ITALIC, escaped, m -> "<em>" + m.group(1) + "</em>");
        return escaped;
    }

    private interface Replacer {
        String apply(Matcher m);
    }

    private static String replace(Pattern pattern, String input, Replacer replacer) {
        Matcher m = pattern.matcher(input);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            m.appendReplacement(out, Matcher.quoteReplacement(replacer.apply(m)));
        }
        m.appendTail(out);
        return out.toString();
    }

    private static String escapeHtml(String text) {
        Objects.requireNonNull(text, "text");
        StringBuilder out = new StringBuilder(text.length());
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            switch (c) {
                case '&' -> out.append("&amp;");
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                case '"' -> out.append("&quot;");
                case '\'' -> out.append("&#39;");
                default -> out.append(c);
            }
        }
        return out.toString();
    }
}
