/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.compiler.convert;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The whole-component source transform across the single-file (SFC) and multi-file (MFC) authoring
 * shapes (issue #141, ADR-0072), the facade the CLI {@code convert} command drives. It composes the
 * view parsers/writers (the markup) with a targeted rewrite of the Java class source (the wiring):
 *
 * <ul>
 *   <li><strong>SFC -&gt; MFC</strong>: the {@code @LievitRender Html view()} render expression is
 *       parsed to a {@link ViewNode}, written to a JTE body with a {@code @param} header derived from
 *       the {@code @Wire} fields, and the class is rewritten to declare {@code template="kebab-name"}
 *       and drop the render method + the DSL imports.
 *   <li><strong>MFC -&gt; SFC</strong>: the template body is parsed to a {@link ViewNode}, written to
 *       a DSL expression, and the class is rewritten to drop the {@code template} attribute, add the
 *       DSL imports, and declare an {@code @LievitRender Html view()} returning the expression.
 * </ul>
 *
 * <p>The two directions are inverses on a faithful component, so a double-convert is idempotent (the
 * round-trip the issue requires). A construct the parser cannot map faithfully is warn-and-skipped:
 * the rewrite still happens for the safe parts, and the caller surfaces the warnings.
 *
 * <p>The class rewrite is a targeted text edit, not a full Java reparse: it edits the
 * {@code @LievitComponent} annotation, the (single) render method, and the import block, which is all
 * the convert touches; everything else (fields, actions, lifecycle hooks, javadoc) is preserved
 * verbatim. Pure Java, zero Spring.
 */
public final class ViewConverter {

    /** The two authoring shapes a component source can be in. */
    public enum Shape {
        /** No {@code template}; markup lives inline in an {@code @LievitRender} returning {@code Html}. */
        SINGLE_FILE,
        /** A {@code @LievitComponent(template = "...")}; markup lives in a separate JTE template. */
        MULTI_FILE,
        /** Neither shape recognized (no render method and no template attribute). */
        UNKNOWN
    }

    private static final Pattern TEMPLATE_ATTR =
            Pattern.compile("@LievitComponent\\s*\\(\\s*template\\s*=\\s*\"([^\"]*)\"\\s*\\)");
    private static final Pattern BARE_COMPONENT =
            Pattern.compile("@LievitComponent(?!\\s*\\()");
    // A @Wire field: optional @LievitProperty etc. then `@Wire <type> <name>[ = ...];`
    private static final Pattern WIRE_FIELD =
            Pattern.compile("@Wire\\b[^;]*?\\s([A-Za-z_$][\\w$.<>\\[\\]]*)\\s+([A-Za-z_$]\\w*)\\s*(?:=[^;]*)?;");
    // The render method: `@LievitRender ... <ret> <name>(...) { return <expr>; }`
    private static final Pattern RENDER_METHOD =
            Pattern.compile(
                    "(?:/\\*\\*.*?\\*/\\s*)?@LievitRender\\s+(?:[\\w.<>]+\\s+)*?\\w[\\w.<>]*\\s+\\w+\\s*\\(\\s*\\)\\s*\\{\\s*return\\s*(.*?);\\s*}",
                    Pattern.DOTALL);

    private final DslViewParser dslParser = new DslViewParser();
    private final DslViewWriter dslWriter = new DslViewWriter();
    private final JteViewParser jteParser = new JteViewParser();
    private final JteViewWriter jteWriter = new JteViewWriter();

    /**
     * Detects the authoring shape of a component source.
     *
     * @param classSource the {@code .java} source
     * @return SINGLE_FILE, MULTI_FILE, or UNKNOWN
     */
    public Shape detectShape(String classSource) {
        if (TEMPLATE_ATTR.matcher(classSource).find()) {
            return Shape.MULTI_FILE;
        }
        if (RENDER_METHOD.matcher(classSource).find()) {
            return Shape.SINGLE_FILE;
        }
        return Shape.UNKNOWN;
    }

    /**
     * Converts a single-file component to multi-file: extracts the render expression, writes a JTE
     * template (with a {@code @param} header from the {@code @Wire} fields), and rewrites the class to
     * a {@code template=}-declaring class with no render method or DSL imports.
     *
     * @param classSource the single-file class source
     * @param className the component class name (its kebab form names the template)
     * @return the rewritten class, the new template, and any warn-and-skip notes
     */
    public ConvertResult toMultiFile(String classSource, String className) {
        List<ConversionWarning> warnings = new ArrayList<>();
        Matcher render = RENDER_METHOD.matcher(classSource);
        if (!render.find()) {
            warnings.add(
                    new ConversionWarning(
                            "no-render",
                            "no @LievitRender method returning a DSL expression found; nothing to"
                                    + " convert"));
            return new ConvertResult(classSource, Optional.empty(), warnings);
        }
        ParsedView view = dslParser.parse(render.group(1));
        warnings.addAll(view.warnings());
        if (view.root().isEmpty()) {
            return new ConvertResult(classSource, Optional.empty(), warnings);
        }

        String templateName = kebab(className);
        String body = jteWriter.write(view.root().orElseThrow());
        String template = header(wireFields(classSource)) + body;

        // 1) drop the render method
        String rewritten = classSource.substring(0, render.start()) + classSource.substring(render.end());
        // 2) declare the template on the annotation
        rewritten =
                BARE_COMPONENT
                        .matcher(rewritten)
                        .replaceFirst("@LievitComponent(template = \"" + templateName + "\")");
        // 3) drop the DSL imports (no longer referenced)
        rewritten = dropDslImports(rewritten);
        rewritten = tidyBlankLines(rewritten);

        return new ConvertResult(rewritten, Optional.of(template), warnings);
    }

    /**
     * Converts a multi-file component to single-file: parses the template, writes a DSL render
     * expression, and rewrites the class to drop the {@code template} attribute, add the DSL imports,
     * and declare an {@code @LievitRender Html view()} returning the expression. The template file is
     * dropped (single-file colocates the markup).
     *
     * @param classSource the multi-file class source
     * @param templateSource the JTE template body
     * @return the rewritten class (no template), and any warn-and-skip notes
     */
    public ConvertResult toSingleFile(String classSource, String templateSource) {
        List<ConversionWarning> warnings = new ArrayList<>();
        ParsedView view = jteParser.parse(templateSource);
        warnings.addAll(view.warnings());
        if (view.root().isEmpty()) {
            return new ConvertResult(classSource, Optional.empty(), warnings);
        }
        String expr = dslWriter.write(view.root().orElseThrow());

        // 1) drop the template attribute -> bare @LievitComponent
        String rewritten = TEMPLATE_ATTR.matcher(classSource).replaceFirst("@LievitComponent");
        // 2) add the DSL imports if missing
        rewritten = ensureDslImports(rewritten);
        // 3) insert the render method before the final closing brace
        rewritten = insertRenderMethod(rewritten, expr);
        rewritten = tidyBlankLines(rewritten);

        return new ConvertResult(rewritten, Optional.empty(), warnings);
    }

    // --- class rewriting helpers ---------------------------------------------------------------

    /** Extracts the {@code @Wire} fields as an ordered name-&gt;type map for the {@code @param} header. */
    static Map<String, String> wireFields(String classSource) {
        Map<String, String> fields = new LinkedHashMap<>();
        Matcher m = WIRE_FIELD.matcher(classSource);
        while (m.find()) {
            fields.put(m.group(2), m.group(1));
        }
        return fields;
    }

    /** Builds the JTE {@code @param} header from the {@code @Wire} fields, in declaration order. */
    private static String header(Map<String, String> fields) {
        StringBuilder h = new StringBuilder();
        for (Map.Entry<String, String> e : fields.entrySet()) {
            h.append("@param ").append(e.getValue()).append(' ').append(e.getKey()).append('\n');
        }
        return h.toString();
    }

    private static String dropDslImports(String src) {
        return src.replaceAll("(?m)^import static dev\\.lievit\\.dsl\\.H\\..*$\\n?", "")
                .replaceAll("(?m)^import dev\\.lievit\\.dsl\\.Html;.*$\\n?", "")
                .replaceAll("(?m)^import dev\\.lievit\\.LievitRender;.*$\\n?", "");
    }

    private static String ensureDslImports(String src) {
        if (!src.contains("import static dev.lievit.dsl.H.*;")) {
            // place the static import right after the package line
            src = src.replaceFirst("(package [^;]+;\\n)", "$1\nimport static dev.lievit.dsl.H.*;\n");
        }
        if (!src.contains("import dev.lievit.dsl.Html;")) {
            src = addImport(src, "import dev.lievit.dsl.Html;");
        }
        if (!src.contains("import dev.lievit.LievitRender;")) {
            src = addImport(src, "import dev.lievit.LievitRender;");
        }
        return src;
    }

    /** Adds a non-static import after the last existing non-static import (keeps the block together). */
    private static String addImport(String src, String importLine) {
        Matcher m = Pattern.compile("(?m)^import (?!static).*;$").matcher(src);
        int last = -1;
        int lastEnd = -1;
        while (m.find()) {
            last = m.start();
            lastEnd = m.end();
        }
        if (last < 0) {
            return src.replaceFirst("(package [^;]+;\\n)", "$1\n" + Matcher.quoteReplacement(importLine) + "\n");
        }
        return src.substring(0, lastEnd) + "\n" + importLine + src.substring(lastEnd);
    }

    /** Inserts the {@code @LievitRender Html view()} method before the class's final closing brace. */
    private static String insertRenderMethod(String src, String expr) {
        int lastBrace = src.lastIndexOf('}');
        String method =
                "\n    @LievitRender\n"
                        + "    Html view() {\n"
                        + "        return "
                        + expr
                        + ";\n"
                        + "    }\n";
        return src.substring(0, lastBrace) + method + src.substring(lastBrace);
    }

    /**
     * Tidies the whitespace left where an import or the render method was removed: drops
     * whitespace-only lines down to a single blank line, so the rewrite leaves no dangling indented
     * blank line and never more than one consecutive blank line.
     */
    private static String tidyBlankLines(String src) {
        // collapse a run of (blank-or-whitespace-only) lines to a single empty line
        return src.replaceAll("(?m)(\\n[ \\t]*){3,}", "\n\n");
    }

    /** PascalCase -&gt; kebab-case (Counter -&gt; counter, UserList -&gt; user-list). */
    static String kebab(String pascal) {
        return pascal.replaceAll("([a-z0-9])([A-Z])", "$1-$2").toLowerCase();
    }
}
